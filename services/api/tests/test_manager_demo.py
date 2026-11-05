from collections.abc import Iterator
from unittest.mock import patch
from uuid import uuid4

import psycopg
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from psycopg import sql
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import Settings
from app.core.database import build_engine
from app.main import create_app
from app.manager_demo import run
from app.modules.intake.models import IntakeAssessment
from app.modules.submissions.models import (
    StudentRecordVersion,
    SubmissionBatch,
    SubmissionScope,
)
from app.seed import seed_demo


@pytest.fixture
def isolated_settings(postgres_url: str, demo_settings: Settings) -> Iterator[Settings]:
    source = make_url(postgres_url)
    database = f"sih26263_m1_test_{uuid4().hex[:12]}"
    target = source.set(database=database)
    admin = source.set(drivername="postgresql", database="postgres")
    with psycopg.connect(
        admin.render_as_string(hide_password=False), autocommit=True
    ) as connection:
        connection.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database))
        )
        try:
            url = target.render_as_string(hide_password=False)
            config = Config("alembic.ini")
            config.attributes["test_url"] = url
            with patch.dict("os.environ", {"DATABASE_URL": url}):
                command.upgrade(config, "head")
            yield demo_settings.model_copy(
                update={"database_url": SecretStr(url), "rate_limit_enabled": False}
            )
        finally:
            connection.execute(
                sql.SQL("DROP DATABASE {}").format(sql.Identifier(database))
            )


def test_manager_demo_repeatable(isolated_settings: Settings) -> None:
    settings = isolated_settings
    engine = build_engine(settings)
    try:
        with Session(engine) as session, session.begin():
            seed_demo(session, settings)
        assert run(settings)["new_activated_snapshots"] == 14
        with Session(engine) as session:
            before = session.scalar(
                select(func.count()).select_from(StudentRecordVersion)
            )
            assert before == 230
            assessments = session.scalar(
                select(func.count()).select_from(IntakeAssessment)
            )
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(SubmissionBatch)
                    .where(
                        SubmissionBatch.idempotency_key
                        == "manager-demo-cedar-correction-v1"
                    )
                )
                == 1
            )
            assert (
                session.scalar(
                    select(func.count())
                    .select_from(SubmissionScope)
                    .where(SubmissionScope.current_batch_id.is_not(None))
                )
                == 13
            )
        assert run(settings)["new_activated_snapshots"] == 0
        with Session(engine) as session:
            assert (
                session.scalar(select(func.count()).select_from(StudentRecordVersion))
                == before
            )
            assert (
                session.scalar(select(func.count()).select_from(IntakeAssessment))
                == assessments
            )
        with TestClient(
            create_app(settings),
            base_url="http://localhost",
            client=("127.0.0.1", 50000),
        ) as client:
            token = client.post(
                "/api/v1/auth/demo-login", json={"demo_alias": "demo_manager"}
            ).json()["access_token"]
            response = client.get(
                "/api/v1/analytics/enrolment-trends",
                headers={"Authorization": f"Bearer {token}"},
                params={"academic_year": "2026-27"},
            )
            assert response.status_code == 200
            assert response.json()["data"][0]["active_records"] == 105
            headers = {"Authorization": f"Bearer {token}"}
            cases = client.get(
                "/api/v1/analytics/case-performance", headers=headers
            ).json()
            assert cases["totals"]["open"] == 3
            assert cases["totals"]["overdue"] == 1
            assert (
                next(
                    item
                    for item in cases["by_status"]
                    if item["status"] == "UNDER_REVIEW"
                )["total"]
                == 1
            )
            assert (
                next(
                    item
                    for item in cases["by_status"]
                    if item["status"] == "AWAITING_CORRECTION"
                )["total"]
                == 1
            )
            assert (
                next(
                    item
                    for item in cases["resolution_days"]
                    if item["priority"] == "ALL"
                )["resolved_count"]
                >= 1
            )
            completeness = client.get(
                "/api/v1/analytics/submission-completeness",
                headers=headers,
                params={"academic_year": "2026-27"},
            ).json()
            assert any((item["shortfall"] or 0) > 0 for item in completeness["data"])
            monitoring = client.get(
                "/api/v1/oversight/institutions",
                headers=headers,
                params={"academic_year": "2026-27", "page_size": 100},
            ).json()
            assert (
                sum(item["current_active_records"] or 0 for item in monitoring["data"])
                == 105
            )
            assert any((item["shortfall"] or 0) > 0 for item in monitoring["data"])
            assert any(item["exceeded_categories"] > 0 for item in monitoring["data"])
            findings = client.get(
                "/api/v1/oversight/findings",
                headers=headers,
                params={"academic_year": "2026-27"},
            ).json()
            assert findings["snapshots"] == findings["validated_snapshots"] == 7
            assert any(item["count"] > 0 for item in findings["findings"])
    finally:
        engine.dispose()
