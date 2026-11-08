"""Manager-only, deliberately redacted oversight views."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.http import AppSettings, Now, error_responses, no_store, not_found
from app.core.pagination import (
    Page,
    PageNumber,
    PageSize,
    Pagination,
    count_rows,
    paginate_list,
    window,
)
from app.modules.analytics import services as analytics
from app.modules.analytics.schemas import CompletenessRow
from app.modules.audit.models import AuditEvent
from app.modules.auth.dependencies import CurrentUser, DatabaseSession, require_roles
from app.modules.auth.models import Role, User
from app.modules.cases.models import CLOSED_STATUSES, CaseEvent, CaseRecord, ReviewCase
from app.modules.institutions.models import Institution
from app.modules.institutions.schemas import AcademicYear
from app.modules.integrity.schemas import Band
from app.modules.integrity.services import Compute, compute_signals, overview
from app.modules.validation.models import ValidationFinding
from app.modules.validation.services import selected_runs_bulk

router = APIRouter(
    prefix="/api/v1/oversight",
    tags=["Manager oversight"],
    responses=error_responses(401, 403, 404, 422, 503),
)


def manager(user: CurrentUser) -> User:
    require_roles(user, {Role.AICTE_MANAGER})
    return user


Manager = Annotated[User, Depends(manager)]


class CaseSummary(BaseModel):
    id: UUID
    institution_id: UUID
    institution_name: str
    status: str
    category: str
    priority: str
    severity: str
    opened_at: datetime
    due_at: datetime | None
    resolved_at: datetime | None
    overdue: bool
    evidence_count: int


class TimelineEntry(BaseModel):
    action: str
    created_at: datetime


class CaseDetail(CaseSummary):
    timeline: list[TimelineEntry]


class CaseDistribution(BaseModel):
    priority: str
    severity: str
    count: int


class FindingCount(BaseModel):
    rule_code: str
    severity: str
    count: int


class FindingSummary(BaseModel):
    snapshots: int
    validated_snapshots: int
    findings: list[FindingCount]


@router.get("/findings", response_model=FindingSummary)
def finding_summary(
    response: Response,
    _: Manager,
    session: DatabaseSession,
    academic_year: AcademicYear,
) -> FindingSummary:
    filters = analytics.Filters(academic_year=academic_year)
    units = analytics.programme_units(session, filters)
    scopes = analytics.load_scopes(session, units, academic_year)
    batch_ids = [
        scope.current_batch_id
        for scope in scopes.values()
        if scope.current_batch_id is not None
    ]
    runs = selected_runs_bulk(session, batch_ids)
    rows = session.execute(
        select(ValidationFinding.rule_code, ValidationFinding.severity, func.count())
        .where(ValidationFinding.run_id.in_(runs.values()))
        .group_by(ValidationFinding.rule_code, ValidationFinding.severity)
        .order_by(ValidationFinding.rule_code, ValidationFinding.severity)
    ).all()
    no_store(response)
    return FindingSummary(
        snapshots=len(batch_ids),
        validated_snapshots=len(runs),
        findings=[
            FindingCount(rule_code=rule, severity=severity, count=count)
            for rule, severity, count in rows
        ],
    )


class InstitutionMonitoringRow(CompletenessRow):
    institution_code: str
    current_active_records: int | None
    exceeded_categories: int
    known_capacity_categories: int
    priority_band: str
    active_signals: int


@router.get("/institutions", response_model=Page[InstitutionMonitoringRow])
def institution_monitoring(
    response: Response,
    _: Manager,
    session: DatabaseSession,
    now: Now,
    settings: AppSettings,
    academic_year: AcademicYear,
    institution_id: UUID | None = None,
    region: Annotated[str | None, Query(max_length=64)] = None,
    programme_code: Annotated[str | None, Query(max_length=64)] = None,
    band: Band | None = None,
    page: PageNumber = 1,
    page_size: PageSize = 25,
) -> Page[InstitutionMonitoringRow]:
    filters = analytics.Filters(
        academic_year, institution_id, region, programme_code, "LEGACY"
    )
    _meta, completeness, _rollups = analytics.submission_completeness(
        session, filters, settings, now
    )
    _trend_meta, trends = analytics.enrolment_trends(session, filters, "programme", now)
    _intake_meta, intake = analytics.intake_utilisation(session, filters, settings, now)
    priorities = overview(session, settings, now, academic_year, None, 1, 1000000).data
    by_programme = {row.programme_id: row for row in trends}
    by_institution = {row.institution_id: row for row in priorities}
    institutions = {
        item.id: item
        for item in session.scalars(
            select(Institution).where(Institution.active.is_(True))
        )
    }
    result = []
    for row in completeness:
        institution = institutions.get(row.institution_id)
        priority = by_institution.get(row.institution_id)
        if (
            institution is None
            or priority is None
            or (band and priority.score.band != band)
        ):
            continue
        capacity = [
            item
            for item in intake
            if item.programme_id == row.programme_id
            and item.academic_year == row.academic_year
        ]
        trend = by_programme.get(row.programme_id)
        result.append(
            InstitutionMonitoringRow(
                **row.model_dump(),
                institution_code=institution.permanent_id,
                current_active_records=trend.active_records if trend else None,
                exceeded_categories=sum(item.exceeded is True for item in capacity),
                known_capacity_categories=sum(item.status == "OK" for item in capacity),
                priority_band=priority.score.band,
                active_signals=priority.active_count,
            )
        )
    no_store(response)
    return paginate_list(result, page, page_size)


@router.get("/case-distribution", response_model=list[CaseDistribution])
def case_distribution(
    response: Response, _: Manager, session: DatabaseSession
) -> list[CaseDistribution]:
    rows = session.execute(
        select(ReviewCase.priority, ReviewCase.severity, func.count())
        .where(ReviewCase.status.not_in(CLOSED_STATUSES))
        .group_by(ReviewCase.priority, ReviewCase.severity)
        .order_by(ReviewCase.priority, ReviewCase.severity)
    ).all()
    no_store(response)
    return [
        CaseDistribution(priority=priority, severity=severity, count=count)
        for priority, severity, count in rows
    ]


def summary(
    session: DatabaseSession, case: ReviewCase, name: str, now: datetime
) -> CaseSummary:
    count = (
        session.scalar(
            select(func.count())
            .select_from(CaseRecord)
            .where(CaseRecord.case_id == case.id)
        )
        or 0
    )
    return CaseSummary(
        id=case.id,
        institution_id=case.institution_id,
        institution_name=name,
        status=case.status,
        category=case.category,
        priority=case.priority,
        severity=case.severity,
        opened_at=case.opened_at,
        due_at=case.due_at,
        resolved_at=case.resolved_at,
        overdue=case.due_at is not None
        and case.due_at < now
        and case.status not in CLOSED_STATUSES,
        evidence_count=count,
    )


@router.get("/cases", response_model=Page[CaseSummary])
def cases(
    response: Response,
    _: Manager,
    session: DatabaseSession,
    now: Now,
    page: PageNumber = 1,
    page_size: PageSize = 25,
) -> Page[CaseSummary]:
    statement = (
        select(ReviewCase, Institution.name)
        .join(Institution, Institution.id == ReviewCase.institution_id)
        .order_by(ReviewCase.opened_at.desc(), ReviewCase.id)
    )
    total = count_rows(session, statement)
    rows = session.execute(window(statement, page, page_size)).all()
    no_store(response)
    return Page(
        data=[summary(session, case, name, now) for case, name in rows],
        pagination=Pagination(page=page, page_size=page_size, total=total),
    )


@router.get("/cases/{case_id}", response_model=CaseDetail)
def case_detail(
    case_id: UUID, response: Response, _: Manager, session: DatabaseSession, now: Now
) -> CaseDetail:
    row = session.execute(
        select(ReviewCase, Institution.name)
        .join(Institution, Institution.id == ReviewCase.institution_id)
        .where(ReviewCase.id == case_id)
    ).first()
    if row is None:
        raise not_found()
    case, name = row
    events = session.scalars(
        select(CaseEvent)
        .where(CaseEvent.case_id == case_id)
        .order_by(CaseEvent.ordinal)
    ).all()
    no_store(response)
    return CaseDetail(
        **summary(session, case, name, now).model_dump(),
        timeline=[
            TimelineEntry(action=e.action, created_at=e.created_at) for e in events
        ],
    )


class ActivityCount(BaseModel):
    action: str
    count: int


class MonthlyActivity(BaseModel):
    month: datetime
    action: str
    count: int


class GovernanceSummary(BaseModel):
    activities: list[ActivityCount]
    monthly: list[MonthlyActivity]
    notice: str = (
        "SIMULATED / DEMO DATA. Counts include audit events; "
        "no event payloads are exposed."
    )


class SignalSummary(BaseModel):
    rule_id: str
    title: str
    severity: str
    calculation: str
    dismissed: bool


@router.get(
    "/institutions/{institution_id}/signals", response_model=list[SignalSummary]
)
def institution_signals(
    institution_id: UUID,
    response: Response,
    _: Manager,
    session: DatabaseSession,
    now: Now,
    settings: AppSettings,
    academic_year: AcademicYear | None = None,
) -> list[SignalSummary]:
    if session.get(Institution, institution_id) is None:
        raise not_found()
    signals = compute_signals(
        Compute(session, settings, institution_id, now, academic_year)
    )
    no_store(response)
    return [
        SignalSummary(
            rule_id=s.rule_id,
            title=s.title,
            severity=s.severity,
            calculation=s.calculation,
            dismissed=s.dismissed,
        )
        for s in signals
    ]


@router.get("/governance", response_model=GovernanceSummary)
def governance(
    response: Response, _: Manager, session: DatabaseSession
) -> GovernanceSummary:
    rows = session.execute(
        select(AuditEvent.action, func.count())
        .group_by(AuditEvent.action)
        .order_by(AuditEvent.action)
    ).all()
    month = func.date_trunc("month", AuditEvent.occurred_at)
    monthly = session.execute(
        select(month, AuditEvent.action, func.count())
        .group_by(month, AuditEvent.action)
        .order_by(month.desc(), AuditEvent.action)
    ).all()
    no_store(response)
    return GovernanceSummary(
        activities=[
            ActivityCount(action=action, count=count) for action, count in rows
        ],
        monthly=[
            MonthlyActivity(month=month, action=action, count=count)
            for month, action, count in monthly
        ],
    )
