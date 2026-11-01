from datetime import date, datetime
from typing import Any, Literal, get_args
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

ReconciliationStatus = Literal[
    "OPEN",
    "UNDER_REVIEW",
    "AWAITING_INSTITUTION",
    "TRANSFER_SUPPORTED",
    "UNRESOLVED_OVERLAP",
    "DISMISSED",
]
ReconciliationAction = Literal[
    "OPENED",
    "ASSIGN",
    "START_REVIEW",
    "REQUEST_EVIDENCE",
    "TRANSFER_EVIDENCE_SUBMITTED",
    "DECIDE_TRANSFER",
    "DECIDE_OVERLAP",
    "DISMISS",
]
EvidenceType = Literal["TRANSFER_RECORD", "WITHDRAWAL_RECORD", "OTHER"]


def one_of(column: str, literal: Any) -> str:
    return f"{column} IN ({', '.join(repr(value) for value in get_args(literal))})"


class Reconciliation(Base):
    __tablename__ = "cross_institution_reconciliations"
    __table_args__ = (
        CheckConstraint(
            one_of("status", ReconciliationStatus), name="ck_reconciliation_status"
        ),
        CheckConstraint(
            "left_record_version_id <> right_record_version_id",
            name="ck_reconciliation_distinct_records",
        ),
        CheckConstraint(
            "resolution_reason IS NULL OR "
            "char_length(resolution_reason) BETWEEN 3 AND 2000",
            name="ck_reconciliation_resolution_reason",
        ),
        ForeignKeyConstraint(
            ["left_record_version_id", "left_batch_id"],
            ["student_record_versions.id", "student_record_versions.batch_id"],
            name="fk_reconciliation_left_record",
        ),
        ForeignKeyConstraint(
            ["right_record_version_id", "right_batch_id"],
            ["student_record_versions.id", "student_record_versions.batch_id"],
            name="fk_reconciliation_right_record",
        ),
        UniqueConstraint(
            "left_record_version_id",
            "right_record_version_id",
            name="uq_reconciliation_record_pair",
        ),
        Index("ix_reconciliation_status_opened", "status", "opened_at", "id"),
        Index("ix_reconciliation_left", "left_record_version_id"),
        Index("ix_reconciliation_right", "right_record_version_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    finding_id: Mapped[UUID] = mapped_column(
        ForeignKey("validation_findings.id"), index=True
    )
    left_record_version_id: Mapped[UUID]
    left_batch_id: Mapped[UUID]
    right_record_version_id: Mapped[UUID]
    right_batch_id: Mapped[UUID]
    status: Mapped[ReconciliationStatus] = mapped_column(
        String(32), server_default="OPEN"
    )
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    requested_institution_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("institutions.id")
    )
    resolution_reason: Mapped[str | None] = mapped_column(Text)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReconciliationEvent(Base):
    __tablename__ = "reconciliation_events"
    __table_args__ = (
        CheckConstraint(
            one_of("action", ReconciliationAction),
            name="ck_reconciliation_event_action",
        ),
        CheckConstraint(
            "status_after IN ('OPEN', 'UNDER_REVIEW', 'AWAITING_INSTITUTION', "
            "'TRANSFER_SUPPORTED', 'UNRESOLVED_OVERLAP', 'DISMISSED')",
            name="ck_reconciliation_event_status",
        ),
        CheckConstraint(
            "evidence_type IS NULL OR " + one_of("evidence_type", EvidenceType),
            name="ck_reconciliation_evidence_type",
        ),
        CheckConstraint(
            "comment IS NULL OR char_length(comment) BETWEEN 1 AND 2000",
            name="ck_reconciliation_event_comment",
        ),
        CheckConstraint(
            "evidence_reference IS NULL OR "
            "char_length(evidence_reference) BETWEEN 1 AND 120",
            name="ck_reconciliation_evidence_reference",
        ),
        Index(
            "ix_reconciliation_event_timeline", "reconciliation_id", "created_at", "id"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reconciliation_id: Mapped[UUID] = mapped_column(
        ForeignKey("cross_institution_reconciliations.id")
    )
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    # Null means the event is visible to both participants; otherwise it is
    # visible only to the named institution and authorized officers.
    institution_id: Mapped[UUID | None] = mapped_column(ForeignKey("institutions.id"))
    action: Mapped[ReconciliationAction] = mapped_column(String(40))
    status_after: Mapped[ReconciliationStatus] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)
    evidence_type: Mapped[EvidenceType | None] = mapped_column(String(32))
    transfer_date: Mapped[date | None] = mapped_column(Date)
    withdrawal_date: Mapped[date | None] = mapped_column(Date)
    evidence_reference: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
