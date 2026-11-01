from uuid import UUID

from fastapi import APIRouter, Response

from app.core.http import AppSettings, error_responses, no_store
from app.core.pagination import Page, PageNumber, PageSize
from app.core.rate_limit import rate_limit
from app.modules.auth.dependencies import CurrentUser, DatabaseSession
from app.modules.reconciliations.schemas import (
    ReconciliationActionRequest,
    ReconciliationCreate,
    ReconciliationEvidence,
    ReconciliationResponse,
)
from app.modules.reconciliations.services import (
    apply_action,
    create_reconciliation,
    get_reconciliation,
    list_reconciliations,
    submit_evidence,
)
from app.modules.validation.services import matching_key

router = APIRouter(
    prefix="/api/v1/reconciliations",
    tags=["Cross-institution reconciliation"],
    responses=error_responses(401, 403, 404, 409, 422, 500, 503),
)


@router.get("", response_model=Page[ReconciliationResponse])
def list_(
    response: Response,
    user: CurrentUser,
    session: DatabaseSession,
    page: PageNumber = 1,
    page_size: PageSize = 20,
) -> Page[ReconciliationResponse]:
    result = list_reconciliations(session, user, page, page_size)
    no_store(response)
    return result


@router.post(
    "", response_model=ReconciliationResponse, dependencies=[rate_limit("cases")]
)
def create(
    body: ReconciliationCreate,
    response: Response,
    user: CurrentUser,
    session: DatabaseSession,
    settings: AppSettings,
) -> ReconciliationResponse:
    result, created = create_reconciliation(
        session, user, body, matching_key(settings), settings.apaar_format_length
    )
    response.status_code = 201 if created else 200
    no_store(response)
    return result


@router.get("/{reconciliation_id}", response_model=ReconciliationResponse)
def detail(
    reconciliation_id: UUID,
    response: Response,
    user: CurrentUser,
    session: DatabaseSession,
) -> ReconciliationResponse:
    result = get_reconciliation(session, user, reconciliation_id)
    no_store(response)
    return result


@router.post(
    "/{reconciliation_id}/evidence",
    response_model=ReconciliationResponse,
    status_code=201,
    dependencies=[rate_limit("cases")],
)
def evidence(
    reconciliation_id: UUID,
    body: ReconciliationEvidence,
    response: Response,
    user: CurrentUser,
    session: DatabaseSession,
) -> ReconciliationResponse:
    result = submit_evidence(session, user, reconciliation_id, body)
    no_store(response)
    return result


@router.post(
    "/{reconciliation_id}/actions",
    response_model=ReconciliationResponse,
    status_code=201,
    dependencies=[rate_limit("cases")],
)
def action(
    reconciliation_id: UUID,
    body: ReconciliationActionRequest,
    response: Response,
    user: CurrentUser,
    session: DatabaseSession,
) -> ReconciliationResponse:
    result = apply_action(session, user, reconciliation_id, body)
    no_store(response)
    return result
