from datetime import UTC, datetime
from typing import cast
from unittest.mock import Mock
from uuid import uuid4

from sqlalchemy.orm import Session

from app.modules.analytics.services import Counts, ScopeData, empty_counts, load_counts
from app.modules.submissions.models import StudentRecordVersion


def record(
    batch_id: object, category: str | None, pwd: bool | None
) -> StudentRecordVersion:
    return StudentRecordVersion(
        batch_id=batch_id,
        enrollment_status="ACTIVE",
        reservation_category=category,
        is_pwd=pwd,
    )


def test_reservation_counts_preserve_headcount_and_pwd_overlap() -> None:
    batch_id = uuid4()
    session = Mock(spec=Session)
    session.scalars.return_value = [
        record(batch_id, "OBC", True),
        record(batch_id, "GENERAL_OPEN", False),
    ]
    scopes = {(uuid4(), "2026-27"): ScopeData(batch_id, datetime.now(UTC))}
    counts = load_counts(cast(Session, session), scopes, "RESERVATION")[batch_id]
    assert counts.declared == counts.active == 2
    assert counts.categories["OBC"].active_records == 1
    assert counts.categories["PWD"].active_records == 1
    assert (
        sum(
            counts.categories[c].active_records or 0
            for c in ("GENERAL_OPEN", "SC_ST", "NT", "OBC")
        )
        == 2
    )


def test_legacy_records_keep_reservation_counts_unknown_in_rollups() -> None:
    batch_id = uuid4()
    session = Mock(spec=Session)
    session.scalars.return_value = [record(batch_id, None, None)]
    scopes = {(uuid4(), "2026-27"): ScopeData(batch_id, datetime.now(UTC))}
    counts = load_counts(cast(Session, session), scopes, "RESERVATION")[batch_id]
    assert counts.active == 1
    assert counts.unclassified_active == 1
    assert all(c.active_records is None for c in counts.categories.values())
    total: Counts = empty_counts("RESERVATION")
    total.add(counts)
    total.add(empty_counts("RESERVATION"))
    assert total.active == 1
    assert all(c.active_records is None for c in total.categories.values())


def test_reservation_export_includes_overlap_note_and_scheme() -> None:
    from app.modules.analytics.services import Filters
    from app.modules.auth.models import Role, User
    from app.modules.reports.services import ReportParams, document, table

    user = User(role=Role.AICTE_OFFICER, demo_alias="synthetic_officer")
    params = ReportParams(Filters(category_scheme="RESERVATION"))
    report = document(
        "enrolment-summary",
        "Enrolment",
        user,
        datetime.now(UTC),
        params,
        "2026-27",
        "DEMO coverage",
        table("Totals", [], []),
        table("Rows", [], []),
    )
    assert report.filters["category_scheme"] == "RESERVATION"
    assert "PwD overlaps main categories" in report.coverage
    assert "never add PwD to student headcount" in report.coverage
