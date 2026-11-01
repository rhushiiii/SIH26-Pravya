from datetime import date, datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.reconciliations.models import (
    EvidenceType,
    ReconciliationAction,
    ReconciliationStatus,
)


class ReconciliationCreate(BaseModel):
    finding_id: UUID
    local_record_version_id: UUID
    peer_record_version_id: UUID


class ReconciliationEvidence(BaseModel):
    evidence_type: EvidenceType
    comment: str = Field(min_length=3, max_length=2000)
    transfer_date: date | None = None
    withdrawal_date: date | None = None
    evidence_reference: str | None = Field(default=None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def date_matches_evidence(self) -> Self:
        if self.evidence_type == "TRANSFER_RECORD" and self.transfer_date is None:
            raise ValueError("Transfer evidence requires a transfer date")
        if self.evidence_type == "WITHDRAWAL_RECORD" and self.withdrawal_date is None:
            raise ValueError("Withdrawal evidence requires a withdrawal date")
        return self


class ReconciliationActionRequest(BaseModel):
    action: Literal[
        "ASSIGN",
        "START_REVIEW",
        "REQUEST_EVIDENCE",
        "DECIDE_TRANSFER",
        "DECIDE_OVERLAP",
        "DISMISS",
    ]
    assigned_to: UUID | None = None
    institution_id: UUID | None = None
    reason: str | None = Field(default=None, min_length=3, max_length=2000)

    @model_validator(mode="after")
    def fields_match_action(self) -> Self:
        if (
            (self.action == "ASSIGN") != (self.assigned_to is not None)
            or (self.action == "REQUEST_EVIDENCE") != (self.institution_id is not None)
            or (self.action in {"DECIDE_TRANSFER", "DECIDE_OVERLAP", "DISMISS"})
            != (self.reason is not None)
        ):
            raise ValueError("Fields do not match the requested action")
        return self


class ReconciliationRecord(BaseModel):
    record_version_id: UUID
    institution_id: UUID
    institution_name: str
    college_student_id: str
    apaar_id_masked: str
    enrollment_status: str
    enrollment_date: date | None
    academic_year: str


class ReconciliationEventResponse(BaseModel):
    id: UUID
    actor_id: UUID | None
    action: ReconciliationAction
    status_after: ReconciliationStatus
    institution_id: UUID | None
    comment: str | None
    evidence_type: EvidenceType | None
    transfer_date: date | None
    withdrawal_date: date | None
    evidence_reference: str | None
    created_at: datetime


class ReconciliationResponse(BaseModel):
    id: UUID
    finding_id: UUID
    status: ReconciliationStatus
    assigned_to: UUID | None
    opened_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolution_reason: str | None
    requested_institution_name: str | None
    evidence_requested_for_you: bool
    records: list[ReconciliationRecord]
    events: list[ReconciliationEventResponse]
