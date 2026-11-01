"""Reservation validation preserves primary headcounts and overlapping PwD."""

import csv
import io
from collections.abc import Callable
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.modules.submissions.models import StudentRecordVersion, SubmissionBatch
from app.modules.submissions.parsing import HEADERS_V2
from app.modules.validation.rules import evaluate, structural_findings
from app.seed import seed_id


def record(category: str = "OBC", pwd: str = "YES") -> StudentRecordVersion:
    values = dict(
        zip(
            HEADERS_V2,
            [
                "SYN-1",
                "Synthetic Learner",
                "900000000001",
                "2026-27",
                "DEMO-COMP",
                category,
                pwd,
                "ACTIVE",
                "2026-08-01",
            ],
            strict=True,
        )
    )
    values["admission_category"] = ""
    return StudentRecordVersion(
        id=uuid4(),
        college_student_id="SYN-1",
        source_row_number=2,
        normalized_json=values,
        reservation_category=category,
        is_pwd=True if pwd == "YES" else False if pwd == "NO" else None,
        enrollment_date=date(2026, 8, 1),
        enrollment_status="ACTIVE",
    )


def test_pwd_is_overlapping_and_legacy_category_not_required() -> None:
    row = record()
    batch = SubmissionBatch(schema_version="v2", academic_year="2026-27")
    findings, summary = evaluate(
        [row],
        batch,
        "DEMO-COMP",
        [],
        [],
        set(),
        key=b"x" * 32,
        format_length=12,
        check_budget=lambda: None,
    )
    assert not [f for f in findings if f.classification == "ACTIVATION_BLOCKING"]
    assert summary["candidate_demo_active_records"] == 1
    assert summary["category_allocated_active_records"]["OBC"] == 1
    assert summary["category_allocated_active_records"]["PWD"] == 1
    assert {
        f.evidence["category"] for f in findings if f.code == "MISSING_INTAKE_RULE"
    } == {"GENERAL_OPEN", "SC_ST", "NT", "OBC", "PWD"}


@pytest.mark.parametrize(
    ("category", "pwd", "code", "field"),
    [
        ("NRI", "YES", "INVALID_RESERVATION_CATEGORY", "reservation_category"),
        ("OBC", "maybe", "INVALID_PWD_STATUS", "is_pwd"),
        ("OBC", "", "REQUIRED_FIELD_MISSING", "is_pwd"),
        ("", "NO", "REQUIRED_FIELD_MISSING", "reservation_category"),
    ],
)
def test_invalid_reservation_values_block(
    category: str, pwd: str, code: str, field: str
) -> None:
    findings = structural_findings(
        [record(category, pwd)],
        SubmissionBatch(schema_version="v2", academic_year="2026-27"),
        "DEMO-COMP",
    )
    assert any(
        f.code == code
        and f.field_name == field
        and f.classification == "ACTIVATION_BLOCKING"
        for f in findings
    )


def test_v2_upload_validation_and_feedback(
    client: TestClient, auth_headers: Callable[[str], dict[str, str]]
) -> None:
    headers = auth_headers("cedar_admin")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(HEADERS_V2)
    writer.writerow([record().normalized_json[key] for key in HEADERS_V2])
    response = client.post(
        "/api/v1/submissions",
        headers=headers,
        data={
            "institution_id": str(seed_id("institutions", "cedar")),
            "programme_id": str(seed_id("programmes", "cedar/DEMO-COMP")),
            "academic_year": "2026-27",
            "schema_version": "v2",
        },
        files={"file": ("synthetic.csv", output.getvalue().encode(), "text/csv")},
    )
    assert response.status_code == 201, response.text
    identifier = response.json()["id"]
    validation = client.post(
        f"/api/v1/submissions/{identifier}/validate", headers=headers
    )
    assert validation.status_code == 201, validation.text
    snapshot = validation.json()["ruleset_snapshot"]
    assert snapshot["structural_ruleset_version"] == "LOCAL-STRUCTURE-DEMO-v2"
    assert snapshot["category_scheme"] == "RESERVATION"
    feedback = client.get(
        f"/api/v1/submissions/{identifier}/feedback.csv", headers=headers
    )
    assert feedback.status_code == 200
    assert "reservation_category,is_pwd" in feedback.text


def test_structural_versions_cannot_cross_category_schemes() -> None:
    from datetime import UTC, datetime

    from app.modules.institutions.models import Programme
    from app.modules.validation.models import ValidationRun
    from app.modules.validation.rules import CATEGORIES, STATUSES
    from app.modules.validation.services import structurally_compatible

    batch = SubmissionBatch(schema_version="v2", academic_year="2026-27")
    programme = Programme(code="DEMO-COMP")
    run = ValidationRun(
        ruleset_version="LOCAL-DEMO-v1",
        completed_at=datetime.now(UTC),
        ruleset_snapshot_json={
            "categories": list(CATEGORIES),
            "enrollment_statuses": list(STATUSES),
            "programme_code": "DEMO-COMP",
            "academic_year": "2026-27",
        },
    )
    assert not structurally_compatible(run, batch, programme)
    batch.schema_version = "v1"
    assert structurally_compatible(run, batch, programme)
