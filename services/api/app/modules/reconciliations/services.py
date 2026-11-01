import hmac
import re
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.http import APIError, not_found
from app.core.pagination import Page, paginate_rows
from app.modules.audit.services import record_action
from app.modules.auth.dependencies import require_roles
from app.modules.auth.models import Role, User
from app.modules.institutions.models import Institution
from app.modules.reconciliations.models import (
    Reconciliation,
    ReconciliationEvent,
)
from app.modules.reconciliations.schemas import (
    ReconciliationActionRequest,
    ReconciliationCreate,
    ReconciliationEventResponse,
    ReconciliationEvidence,
    ReconciliationRecord,
    ReconciliationResponse,
)
from app.modules.submissions.models import (
    ProcessingStatus,
    StudentRecordVersion,
    SubmissionBatch,
    SubmissionScope,
)
from app.modules.validation.models import ValidationFinding
from app.modules.validation.rules import token_hash, valid_token

APAAR_LIKE_VALUE = re.compile(r"(?<!\d)(?:\d[ -]?){11,}\d(?!\d)")
CLOSED = {"TRANSFER_SUPPORTED", "UNRESOLVED_OVERLAP", "DISMISSED"}


def require_reconciliation_role(user: User, *, officer_only: bool = False) -> None:
    require_roles(
        user,
        {Role.AICTE_OFFICER}
        if officer_only
        else {Role.AICTE_OFFICER, Role.INSTITUTION_ADMIN},
    )


def safe_comment(value: str) -> str:
    clean = value.strip()
    if not clean or APAAR_LIKE_VALUE.search(clean):
        raise APIError(
            422,
            "INVALID_REQUEST",
            "Comments must be meaningful and must not contain student identifiers",
        )
    return clean


def _pair_records(
    session: Session, item: Reconciliation
) -> tuple[StudentRecordVersion, StudentRecordVersion]:
    left = session.get(StudentRecordVersion, item.left_record_version_id)
    right = session.get(StudentRecordVersion, item.right_record_version_id)
    if left is None or right is None:
        raise not_found()
    return left, right


def _record_view(session: Session, row: StudentRecordVersion) -> ReconciliationRecord:
    institution = session.get(Institution, row.institution_id)
    identifier = row.apaar_identifier_encrypted_or_demo_token
    masked = (
        "*" * len(identifier)
        if len(identifier) <= 4
        else "*" * (len(identifier) - 4) + identifier[-4:]
    )
    return ReconciliationRecord(
        record_version_id=row.id,
        institution_id=row.institution_id,
        institution_name=institution.name if institution else "Institution unavailable",
        college_student_id=row.college_student_id,
        apaar_id_masked=masked,
        enrollment_status=row.enrollment_status,
        enrollment_date=row.enrollment_date,
        academic_year=row.academic_year,
    )


def _accessible(
    session: Session, user: User, item: Reconciliation
) -> tuple[StudentRecordVersion, StudentRecordVersion]:
    require_reconciliation_role(user)
    left, right = _pair_records(session, item)
    if user.role == Role.INSTITUTION_ADMIN and user.institution_id not in {
        left.institution_id,
        right.institution_id,
    }:
        raise not_found()
    return left, right


def reconciliation_response(
    session: Session, user: User, item: Reconciliation
) -> ReconciliationResponse:
    left, right = _accessible(session, user, item)
    officer = user.role == Role.AICTE_OFFICER
    rows = (
        [left, right]
        if officer
        else [row for row in (left, right) if row.institution_id == user.institution_id]
    )
    events = list(
        session.scalars(
            select(ReconciliationEvent)
            .where(ReconciliationEvent.reconciliation_id == item.id)
            .order_by(ReconciliationEvent.created_at, ReconciliationEvent.id)
        )
    )
    if not officer:
        events = [
            event
            for event in events
            if event.institution_id is None
            or event.institution_id == user.institution_id
        ]
    requested_name = None
    if officer and item.requested_institution_id is not None:
        institution = session.get(Institution, item.requested_institution_id)
        requested_name = institution.name if institution else None
    return ReconciliationResponse(
        id=item.id,
        finding_id=item.finding_id,
        status=item.status,
        assigned_to=item.assigned_to if officer else None,
        opened_at=item.opened_at,
        updated_at=item.updated_at,
        resolved_at=item.resolved_at,
        resolution_reason=item.resolution_reason,
        requested_institution_name=requested_name,
        evidence_requested_for_you=(
            not officer and item.requested_institution_id == user.institution_id
        ),
        records=[_record_view(session, row) for row in rows],
        events=[
            ReconciliationEventResponse(
                id=event.id,
                actor_id=event.actor_id if officer else None,
                action=event.action,
                status_after=event.status_after,
                institution_id=event.institution_id
                if officer or event.institution_id == user.institution_id
                else None,
                comment=event.comment,
                evidence_type=event.evidence_type,
                transfer_date=event.transfer_date,
                withdrawal_date=event.withdrawal_date,
                evidence_reference=event.evidence_reference,
                created_at=event.created_at,
            )
            for event in events
        ],
    )


def list_reconciliations(
    session: Session, user: User, page: int, page_size: int
) -> Page[ReconciliationResponse]:
    require_reconciliation_role(user)
    statement = select(Reconciliation)
    if user.role == Role.INSTITUTION_ADMIN:
        assert user.institution_id is not None
        statement = statement.join(
            StudentRecordVersion,
            or_(
                Reconciliation.left_record_version_id == StudentRecordVersion.id,
                Reconciliation.right_record_version_id == StudentRecordVersion.id,
            ),
        ).where(StudentRecordVersion.institution_id == user.institution_id)
    statement = statement.order_by(Reconciliation.opened_at.desc(), Reconciliation.id)
    return paginate_rows(
        session,
        statement,
        lambda item: reconciliation_response(session, user, item),
        page,
        page_size,
    )


def get_reconciliation(
    session: Session, user: User, reconciliation_id: UUID
) -> ReconciliationResponse:
    require_reconciliation_role(user)
    item = session.get(Reconciliation, reconciliation_id)
    if item is None:
        raise not_found()
    return reconciliation_response(session, user, item)


def create_reconciliation(
    session: Session,
    user: User,
    body: ReconciliationCreate,
    matching_key: bytes,
    format_length: int,
) -> tuple[ReconciliationResponse, bool]:
    require_reconciliation_role(user, officer_only=True)
    finding = session.get(ValidationFinding, body.finding_id)
    if (
        finding is None
        or finding.rule_code != "POTENTIAL_CROSS_INSTITUTION_DUPLICATE"
        or finding.evidence_json_redacted.get("match_context") != "CURRENT_ACTIVE"
        or str(body.local_record_version_id)
        not in finding.evidence_json_redacted.get("affected_record_ids", [])
        or str(body.peer_record_version_id)
        not in {
            reference.get("record_version_id")
            for reference in finding.evidence_json_redacted.get("peer_references", [])
        }
    ):
        raise not_found()
    local = session.get(StudentRecordVersion, body.local_record_version_id)
    peer = session.get(StudentRecordVersion, body.peer_record_version_id)
    local_batch = session.get(SubmissionBatch, local.batch_id) if local else None
    peer_batch = session.get(SubmissionBatch, peer.batch_id) if peer else None
    if (
        local is None
        or peer is None
        or local_batch is None
        or peer_batch is None
        or local.institution_id == peer.institution_id
        or local.academic_year != peer.academic_year
        or local.enrollment_status != "ACTIVE"
        or peer.enrollment_status != "ACTIVE"
        or local_batch.status != ProcessingStatus.COMPLETED
        or peer_batch.status != ProcessingStatus.COMPLETED
    ):
        raise not_found()
    peer_scope = session.get(SubmissionScope, peer_batch.scope_id)
    if peer_scope is None or peer_scope.current_batch_id != peer.batch_id:
        raise APIError(
            409, "RECONCILIATION_STALE_MATCH", "The active match has changed"
        )
    left_id, right_id = sorted((local.id, peer.id), key=str)
    existing = session.scalar(
        select(Reconciliation).where(
            Reconciliation.left_record_version_id == left_id,
            Reconciliation.right_record_version_id == right_id,
        )
    )
    if existing is not None:
        return reconciliation_response(session, user, existing), False
    local_token = local.apaar_identifier_encrypted_or_demo_token
    peer_token = peer.apaar_identifier_encrypted_or_demo_token
    if (
        not valid_token(local_token, format_length)
        or not valid_token(peer_token, format_length)
        or not hmac.compare_digest(
            token_hash(local_token, matching_key), token_hash(peer_token, matching_key)
        )
    ):
        raise APIError(409, "RECONCILIATION_STALE_MATCH", "The records no longer match")
    now = datetime.now(UTC)
    item = Reconciliation(
        id=uuid4(),
        finding_id=finding.id,
        left_record_version_id=left_id,
        left_batch_id=local.batch_id if local.id == left_id else peer.batch_id,
        right_record_version_id=right_id,
        right_batch_id=peer.batch_id if peer.id == right_id else local.batch_id,
        status="OPEN",
        created_by=user.id,
        assigned_to=user.id,
        opened_at=now,
        updated_at=now,
    )
    session.add(item)
    session.flush()
    session.add(
        ReconciliationEvent(
            id=uuid4(),
            reconciliation_id=item.id,
            actor_id=user.id,
            action="OPENED",
            status_after="OPEN",
            comment="Officer opened a review of a potential cross-institution match.",
        )
    )
    record_action(
        session,
        actor_id=user.id,
        institution_id=None,
        action="RECONCILIATION_OPENED",
        entity_type="cross_institution_reconciliations",
        entity_id=item.id,
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.scalar(
            select(Reconciliation).where(
                Reconciliation.left_record_version_id == left_id,
                Reconciliation.right_record_version_id == right_id,
            )
        )
        if existing is None:
            raise
        return reconciliation_response(session, user, existing), False
    return reconciliation_response(session, user, item), True


def submit_evidence(
    session: Session,
    user: User,
    reconciliation_id: UUID,
    body: ReconciliationEvidence,
) -> ReconciliationResponse:
    require_reconciliation_role(user)
    if user.role != Role.INSTITUTION_ADMIN:
        raise APIError(403, "FORBIDDEN_ROLE", "Institution account required")
    item = session.scalar(
        select(Reconciliation)
        .where(Reconciliation.id == reconciliation_id)
        .with_for_update()
    )
    if item is None:
        raise not_found()
    left, right = _accessible(session, user, item)
    assert user.institution_id is not None
    if (
        item.status != "AWAITING_INSTITUTION"
        or item.requested_institution_id != user.institution_id
    ):
        raise APIError(
            409,
            "EVIDENCE_NOT_REQUESTED",
            "No evidence is requested from this institution",
        )
    comment = safe_comment(body.comment)
    if body.evidence_reference and APAAR_LIKE_VALUE.search(body.evidence_reference):
        raise APIError(
            422,
            "INVALID_REQUEST",
            "Evidence reference must not contain student identifiers",
        )
    item.status = "UNDER_REVIEW"
    item.requested_institution_id = None
    item.updated_at = datetime.now(UTC)
    session.add(
        ReconciliationEvent(
            id=uuid4(),
            reconciliation_id=item.id,
            actor_id=user.id,
            institution_id=user.institution_id,
            action="TRANSFER_EVIDENCE_SUBMITTED",
            status_after=item.status,
            comment=comment,
            evidence_type=body.evidence_type,
            transfer_date=body.transfer_date,
            withdrawal_date=body.withdrawal_date,
            evidence_reference=body.evidence_reference,
        )
    )
    record_action(
        session,
        actor_id=user.id,
        institution_id=user.institution_id,
        action="RECONCILIATION_EVIDENCE_SUBMITTED",
        entity_type="cross_institution_reconciliations",
        entity_id=item.id,
    )
    session.commit()
    return reconciliation_response(session, user, item)


def apply_action(
    session: Session,
    user: User,
    reconciliation_id: UUID,
    body: ReconciliationActionRequest,
) -> ReconciliationResponse:
    require_reconciliation_role(user, officer_only=True)
    item = session.scalar(
        select(Reconciliation)
        .where(Reconciliation.id == reconciliation_id)
        .with_for_update()
    )
    if item is None:
        raise not_found()
    left, right = _pair_records(session, item)
    if item.status in CLOSED:
        raise APIError(409, "RECONCILIATION_CLOSED", "This reconciliation is closed")
    now = datetime.now(UTC)
    action = body.action
    target = item.status
    comment = body.reason
    institution_id: UUID | None = None
    if action == "ASSIGN":
        assignee = session.get(User, body.assigned_to)
        if (
            assignee is None
            or not assignee.active
            or assignee.role != Role.AICTE_OFFICER
        ):
            raise APIError(422, "INVALID_REQUEST", "Assignee must be an active officer")
        item.assigned_to = assignee.id
        comment = "Reconciliation assigned to an officer."
    elif action == "START_REVIEW":
        if item.status != "OPEN":
            raise APIError(
                409,
                "INVALID_RECONCILIATION_TRANSITION",
                "Review can start only from OPEN",
            )
        item.status = target = "UNDER_REVIEW"
        comment = "Officer started the reconciliation review."
    elif action == "REQUEST_EVIDENCE":
        if item.status != "UNDER_REVIEW" or body.institution_id not in {
            left.institution_id,
            right.institution_id,
        }:
            raise APIError(
                409,
                "INVALID_RECONCILIATION_TRANSITION",
                "Evidence can be requested from a participant during review",
            )
        item.status = target = "AWAITING_INSTITUTION"
        item.requested_institution_id = body.institution_id
        institution_id = body.institution_id
        comment = "Transfer or withdrawal evidence requested by an officer."
    else:
        if item.status != "UNDER_REVIEW":
            raise APIError(
                409,
                "INVALID_RECONCILIATION_TRANSITION",
                "A decision requires an active review",
            )
        comment = safe_comment(body.reason or "")
        if action == "DECIDE_TRANSFER":
            has_transfer = session.scalar(
                select(ReconciliationEvent.id)
                .where(
                    ReconciliationEvent.reconciliation_id == item.id,
                    ReconciliationEvent.evidence_type == "TRANSFER_RECORD",
                )
                .limit(1)
            )
            if has_transfer is None:
                raise APIError(
                    409,
                    "TRANSFER_EVIDENCE_REQUIRED",
                    "Submit transfer evidence before recording this outcome",
                )
            item.status = target = "TRANSFER_SUPPORTED"
        elif action == "DECIDE_OVERLAP":
            item.status = target = "UNRESOLVED_OVERLAP"
        else:
            item.status = target = "DISMISSED"
        item.resolution_reason = comment
        item.resolved_at = now
    item.updated_at = now
    session.add(
        ReconciliationEvent(
            id=uuid4(),
            reconciliation_id=item.id,
            actor_id=user.id,
            institution_id=institution_id,
            action=action,
            status_after=target,
            comment=comment,
        )
    )
    record_action(
        session,
        actor_id=user.id,
        institution_id=None,
        action=f"RECONCILIATION_{action}",
        entity_type="cross_institution_reconciliations",
        entity_id=item.id,
    )
    session.commit()
    return reconciliation_response(session, user, item)
