"""Reservation counts preserve overlapping PwD and unknown legacy coverage."""

from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.intake.schemas import SimulationRequest
from app.modules.intake.services import active_by_category, capacity_line, snapshot_diff
from app.modules.submissions.models import StudentRecordVersion


def record(category: str | None, pwd: bool | None) -> StudentRecordVersion:
    return cast(
        StudentRecordVersion,
        SimpleNamespace(
            college_student_id="SYNTHETIC-1",
            reservation_category=category,
            is_pwd=pwd,
            enrollment_status="ACTIVE",
            normalized_json={
                "college_student_id": "SYNTHETIC-1",
                "reservation_category": category,
                "is_pwd": pwd,
            },
        ),
    )


def test_pwd_overlaps_primary_headcount() -> None:
    rows = [record("OBC", True), record("OBC", False), record("OBC", False)]
    counts = active_by_category(rows, "RESERVATION")
    assert counts["OBC"] == 3
    assert counts["PWD"] == 1
    assert sum(counts[c] or 0 for c in ("GENERAL_OPEN", "SC_ST", "NT", "OBC")) == 3


def test_unknown_legacy_does_not_claim_capacity() -> None:
    counts = active_by_category([record(None, None)], "RESERVATION")
    assert all(count is None for count in counts.values())
    line = capacity_line("OBC", None, counts["OBC"], "candidate ACTIVE")
    assert line["remaining_capacity"] is None
    assert line["exceeded"] is False


def test_reservation_request_validates_independent_pwd() -> None:
    body = {
        "programme_id": str(uuid4()),
        "academic_year": "2026-27",
        "category_scheme": "RESERVATION",
        "pwd_additions": 1,
        "additions": [{"category": "OBC", "count": 3}],
    }
    assert SimulationRequest.model_validate(body).pwd_additions == 1
    with pytest.raises(ValidationError):
        SimulationRequest.model_validate({**body, "pwd_additions": 4})
    with pytest.raises(ValidationError):
        SimulationRequest.model_validate({**body, "category_scheme": "LEGACY"})
    with pytest.raises(ValidationError):
        SimulationRequest.model_validate(
            {**body, "additions": [{"category": "PWD", "count": 3}]}
        )


def test_diff_includes_reservation_and_pwd_changes() -> None:
    diff = snapshot_diff([record("OBC", False)], [record("NT", True)])
    assert diff["changed_count"] == 1
    assert diff["changes"][0]["changed_fields"] == ["reservation_category", "is_pwd"]
