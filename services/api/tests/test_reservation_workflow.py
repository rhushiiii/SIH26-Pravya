"""Real PostgreSQL path: new categories never rewrite a legacy submission."""

import csv
import io
from collections.abc import Callable
from time import monotonic
from typing import Any
from uuid import UUID

from conftest import admission_csv
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.submissions.models import StudentRecordVersion
from app.modules.submissions.parsing import HEADERS_V2, parse_xlsx
from app.seed import seed_id, seed_reservation_rules


def reservation_csv(pwd: str = "YES") -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(HEADERS_V2)
    writer.writerow(
        [
            "SYN-RES-1",
            "Synthetic Alpha",
            "900000000001",
            "2026-27",
            "DEMO-COMP",
            "OBC",
            pwd,
            "ACTIVE",
            "2026-07-01",
        ]
    )
    writer.writerow(
        [
            "SYN-RES-2",
            "Synthetic Beta",
            "900000000002",
            "2026-27",
            "DEMO-COMP",
            "GENERAL_OPEN",
            "NO",
            "ACTIVE",
            "2026-07-02",
        ]
    )
    return output.getvalue().encode()


def test_v2_workflow_keeps_legacy_history_and_pwd_overlap(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    seeded_session: Session,
) -> None:
    admin = auth_headers("cedar_admin")
    officer = auth_headers("demo_officer")
    institution = str(seed_id("institutions", "cedar"))
    programme = str(seed_id("programmes", "cedar/DEMO-COMP"))
    assert seed_reservation_rules(seeded_session) == 30
    assert seed_reservation_rules(seeded_session) == 0
    seeded_session.commit()

    def upload(version: str, content: bytes) -> str:
        response = client.post(
            "/api/v1/submissions",
            headers=admin,
            data={
                "institution_id": institution,
                "programme_id": programme,
                "academic_year": "2026-27",
                "schema_version": version,
            },
            files={"file": ("synthetic.csv", content, "text/csv")},
        )
        assert response.status_code == 201, response.text
        return str(response.json()["id"])

    def activate(batch: str) -> dict[str, Any]:
        validation = client.post(f"/api/v1/submissions/{batch}/validate", headers=admin)
        assert validation.status_code == 201, validation.text
        review = client.post(
            f"/api/v1/submissions/{batch}/reviews",
            headers=admin,
            json={"validation_run_id": validation.json()["id"]},
        )
        assert review.status_code == 201, review.text
        response = client.post(
            f"/api/v1/submissions/{batch}/activate",
            headers=admin,
            json={
                "review_id": review.json()["id"],
                "expected_scope_revision": review.json()["expected_scope_revision"],
                "confirm_complete_replacement": True,
                "acknowledge_review_warnings": True,
                "acknowledge_omissions": True,
            },
        )
        assert response.status_code == 200, response.text
        return dict(review.json())

    legacy = upload("v1", admission_csv({}))
    activate(legacy)
    original = seeded_session.scalar(
        select(StudentRecordVersion).where(
            StudentRecordVersion.batch_id == UUID(legacy)
        )
    )
    assert original is not None
    legacy_json = dict(original.original_json)
    assert original.reservation_category is None and original.is_pwd is None
    unknown = client.get(
        f"/api/v1/institutions/{institution}/summary",
        headers=officer,
        params={"academic_year": "2026-27", "category_scheme": "RESERVATION"},
    )
    assert all(
        c["declared_records"] is None
        for c in unknown.json()["totals"]["categories"].values()
    )

    batch = upload("v2", reservation_csv())
    review = activate(batch)
    assert (
        review["snapshot"]["delta_counts"]["categories"]["OBC"]["declared_records"]
        is None
    )
    summary = client.get(
        f"/api/v1/institutions/{institution}/summary",
        headers=officer,
        params={"academic_year": "2026-27", "category_scheme": "RESERVATION"},
    ).json()["totals"]
    assert summary["declared_records"] == summary["demo_active_records"] == 2
    assert summary["categories"]["OBC"]["declared_records"] == 1
    assert summary["categories"]["PWD"]["declared_records"] == 1
    assert set(summary["categories"]) == {"GENERAL_OPEN", "SC_ST", "NT", "OBC", "PWD"}
    rows = client.get(f"/api/v1/submissions/{batch}/rows", headers=admin).json()["data"]
    assert rows[0]["reservation_category"] == "OBC" and rows[0]["is_pwd"] is True
    seeded_session.refresh(original)
    assert original.original_json == legacy_json
    assert original.admission_category == "REGULAR"
    assert original.reservation_category is None and original.is_pwd is None
    rules = client.get(
        f"/api/v1/institutions/{institution}/intake",
        headers=officer,
        params={
            "academic_year": "2026-27",
            "category_scheme": "RESERVATION",
            "programme_id": programme,
        },
    ).json()
    assert {row["category"] for row in rules["data"]} == set(summary["categories"])
    export = client.get(
        "/api/v1/reports/enrolment-summary",
        headers=officer,
        params={
            "category_scheme": "RESERVATION",
            "institution_id": institution,
            "academic_year": "2026-27",
            "format": "csv",
        },
    )
    assert export.status_code == 200, export.text
    assert "OBC" in export.text and "PWD" in export.text
    assert "PwD overlaps" in export.text


def test_default_policy_and_xlsx_v2(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    settings: Settings,
) -> None:
    policy = client.get(
        "/api/v1/submissions/upload-policy", headers=auth_headers("cedar_admin")
    )
    assert policy.json()["schema_version"] == "v2"
    assert policy.json()["required_headers"] == list(HEADERS_V2)
    assert policy.json()["reservation_categories"] == [
        "GENERAL_OPEN",
        "SC_ST",
        "NT",
        "OBC",
    ]
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    for row in csv.reader(io.StringIO(reservation_csv().decode())):
        sheet.append(row)
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    rows = parse_xlsx(output.getvalue(), settings, monotonic() + 30, "v2")
    assert rows[0].original["reservation_category"] == "OBC"
    assert rows[0].normalized["is_pwd"] == "YES"
