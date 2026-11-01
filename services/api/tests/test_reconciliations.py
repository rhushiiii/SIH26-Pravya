from collections.abc import Callable
from typing import Any
from uuid import UUID

import pytest
from conftest import admission_csv
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.modules.reconciliations.models import ReconciliationEvent
from app.modules.submissions.models import StudentRecordVersion
from app.modules.validation.models import ValidationFinding
from app.seed import seed_id

Headers = Callable[[str], dict[str, str]]


def fields(institution: str) -> dict[str, str]:
    return {
        "institution_id": str(seed_id("institutions", institution)),
        "programme_id": str(seed_id("programmes", f"{institution}/DEMO-COMP")),
        "academic_year": "2026-27",
        "schema_version": "v1",
    }


def upload(
    client: TestClient,
    headers: dict[str, str],
    institution: str,
) -> str:
    response = client.post(
        "/api/v1/submissions",
        headers=headers,
        data=fields(institution),
        files={"file": ("synthetic.csv", admission_csv({}), "text/csv")},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def activate(client: TestClient, headers: dict[str, str], batch_id: str) -> None:
    run = client.post(
        f"/api/v1/submissions/{batch_id}/validate", headers=headers
    ).json()
    review = client.post(
        f"/api/v1/submissions/{batch_id}/reviews",
        headers=headers,
        json={"validation_run_id": run["id"]},
    ).json()
    response = client.post(
        f"/api/v1/submissions/{batch_id}/activate",
        headers=headers,
        json={
            "review_id": review["id"],
            "expected_scope_revision": review["expected_scope_revision"],
            "confirm_complete_replacement": True,
            "acknowledge_review_warnings": True,
            "acknowledge_omissions": True,
        },
    )
    assert response.status_code == 200, response.text


def open_match(
    client: TestClient, auth_headers: Headers, seeded_session: Session
) -> tuple[dict[str, Any], dict[str, str], dict[str, str]]:
    maple = auth_headers("maple_admin")
    cedar = auth_headers("cedar_admin")
    officer = auth_headers("demo_officer")
    peer_batch = upload(client, maple, "maple")
    activate(client, maple, peer_batch)
    local_batch = upload(client, cedar, "cedar")
    run_response = client.post(
        f"/api/v1/submissions/{local_batch}/validate", headers=cedar
    )
    assert run_response.status_code == 201, run_response.text
    finding_response = client.get(
        f"/api/v1/submissions/{local_batch}/findings?page_size=100",
        headers=officer,
    )
    finding = next(
        item
        for item in finding_response.json()["data"]
        if item["rule_code"] == "POTENTIAL_CROSS_INSTITUTION_DUPLICATE"
        and item["evidence"].get("match_context") == "CURRENT_ACTIVE"
    )
    peer_id = finding["evidence"]["peer_references"][0]["record_version_id"]
    local_id = finding["evidence"]["affected_record_ids"][0]
    request = {
        "finding_id": finding["id"],
        "local_record_version_id": local_id,
        "peer_record_version_id": peer_id,
    }
    created = client.post("/api/v1/reconciliations", headers=officer, json=request)
    assert created.status_code == 201, created.text
    return created.json(), request, {"cedar": local_id, "maple": peer_id}


def test_reconciliation_creates_from_a_current_match_and_is_idempotent(
    client: TestClient, auth_headers: Headers, seeded_session: Session
) -> None:
    body, request, _ = open_match(client, auth_headers, seeded_session)
    assert body["status"] == "OPEN"
    assert len(body["records"]) == 2
    assert all(row["apaar_id_masked"].endswith("0001") for row in body["records"])
    replay = client.post(
        "/api/v1/reconciliations", headers=auth_headers("demo_officer"), json=request
    )
    assert replay.status_code == 200
    assert replay.json()["id"] == body["id"]
    assert "900000000001" not in replay.text


def test_reconciliation_reads_are_scoped_and_peer_data_is_hidden(
    client: TestClient, auth_headers: Headers, seeded_session: Session
) -> None:
    body, _, ids = open_match(client, auth_headers, seeded_session)
    cedar = client.get(
        f"/api/v1/reconciliations/{body['id']}",
        headers=auth_headers("cedar_admin"),
    )
    assert cedar.status_code == 200
    assert len(cedar.json()["records"]) == 1
    assert cedar.json()["records"][0]["record_version_id"] == ids["cedar"]
    assert (
        "Maplewood College of Engineering" not in cedar.text
        and ids["maple"] not in cedar.text
    )

    maple = client.get(
        f"/api/v1/reconciliations/{body['id']}",
        headers=auth_headers("maple_admin"),
    )
    assert maple.status_code == 200
    assert len(maple.json()["records"]) == 1
    assert maple.json()["records"][0]["record_version_id"] == ids["maple"]

    assert (
        client.get(
            f"/api/v1/reconciliations/{body['id']}",
            headers=auth_headers("willow_admin"),
        ).status_code
        == 404
    )
    assert (
        client.get(
            "/api/v1/reconciliations", headers=auth_headers("demo_manager")
        ).status_code
        == 403
    )


def test_transfer_evidence_and_officer_decision_are_audited_and_scoped(
    client: TestClient,
    auth_headers: Headers,
    seeded_session: Session,
) -> None:
    body, _, _ = open_match(client, auth_headers, seeded_session)
    reconciliation_id = body["id"]
    officer = auth_headers("demo_officer")

    start = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/actions",
        headers=officer,
        json={"action": "START_REVIEW"},
    )
    assert start.status_code == 201 and start.json()["status"] == "UNDER_REVIEW"
    no_evidence = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/actions",
        headers=officer,
        json={"action": "DECIDE_TRANSFER", "reason": "Transfer confirmed"},
    )
    assert no_evidence.status_code == 409
    assert no_evidence.json()["error"]["code"] == "TRANSFER_EVIDENCE_REQUIRED"

    requested = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/actions",
        headers=officer,
        json={
            "action": "REQUEST_EVIDENCE",
            "institution_id": str(seed_id("institutions", "maple")),
        },
    )
    assert requested.status_code == 201
    assert (
        requested.json()["requested_institution_name"]
        == "Maplewood College of Engineering"
    )
    assert requested.json()["evidence_requested_for_you"] is False

    evidence = {
        "evidence_type": "TRANSFER_RECORD",
        "comment": "Synthetic transfer record TR-DEMO-01 was reviewed.",
        "transfer_date": "2026-07-15",
        "withdrawal_date": "2026-07-14",
        "evidence_reference": "TR-DEMO-01",
    }
    wrong_institution = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/evidence",
        headers=auth_headers("cedar_admin"),
        json=evidence,
    )
    assert wrong_institution.status_code == 409
    submitted = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/evidence",
        headers=auth_headers("maple_admin"),
        json=evidence,
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["status"] == "UNDER_REVIEW"
    assert any(
        event["action"] == "TRANSFER_EVIDENCE_SUBMITTED"
        for event in submitted.json()["events"]
    )
    cedar_view = client.get(
        f"/api/v1/reconciliations/{reconciliation_id}",
        headers=auth_headers("cedar_admin"),
    )
    assert "TR-DEMO-01" not in cedar_view.text

    resolved = client.post(
        f"/api/v1/reconciliations/{reconciliation_id}/actions",
        headers=officer,
        json={
            "action": "DECIDE_TRANSFER",
            "reason": "Dates support a documented synthetic transfer.",
        },
    )
    assert resolved.status_code == 201, resolved.text
    assert resolved.json()["status"] == "TRANSFER_SUPPORTED"
    assert resolved.json()["resolution_reason"] == (
        "Dates support a documented synthetic transfer."
    )
    assert "900000000001" not in resolved.text

    event_id = UUID(
        next(
            event["id"]
            for event in resolved.json()["events"]
            if event["action"] == "TRANSFER_EVIDENCE_SUBMITTED"
        )
    )
    for statement in (
        update(ReconciliationEvent)
        .where(ReconciliationEvent.id == event_id)
        .values(comment="tampered"),
        delete(ReconciliationEvent).where(ReconciliationEvent.id == event_id),
    ):
        with pytest.raises(DBAPIError), seeded_session.begin_nested():
            seeded_session.execute(statement)


def test_reconciliation_rejects_unlinked_peer_and_identifier_in_notes(
    client: TestClient, auth_headers: Headers, seeded_session: Session
) -> None:
    body, request, _ = open_match(client, auth_headers, seeded_session)
    finding = seeded_session.get(ValidationFinding, UUID(request["finding_id"]))
    assert finding is not None
    wrong_record = seeded_session.scalar(
        select(StudentRecordVersion.id).where(
            StudentRecordVersion.institution_id == seed_id("institutions", "willow")
        )
    )
    assert wrong_record is None  # this fixture has no Willow student rows
    bad_request = {**request, "peer_record_version_id": str(UUID(int=0))}
    rejected = client.post(
        "/api/v1/reconciliations",
        headers=auth_headers("demo_officer"),
        json=bad_request,
    )
    assert rejected.status_code == 404

    action = client.post(
        f"/api/v1/reconciliations/{body['id']}/actions",
        headers=auth_headers("demo_officer"),
        json={"action": "START_REVIEW"},
    )
    assert action.status_code == 201
    request_evidence = client.post(
        f"/api/v1/reconciliations/{body['id']}/actions",
        headers=auth_headers("demo_officer"),
        json={
            "action": "REQUEST_EVIDENCE",
            "institution_id": str(seed_id("institutions", "maple")),
        },
    )
    assert request_evidence.status_code == 201
    denied = client.post(
        f"/api/v1/reconciliations/{body['id']}/evidence",
        headers=auth_headers("maple_admin"),
        json={
            "evidence_type": "TRANSFER_RECORD",
            "comment": "Synthetic evidence contains 900000000001.",
            "transfer_date": "2026-07-15",
        },
    )
    assert denied.status_code == 422
    assert denied.json()["error"]["code"] == "INVALID_REQUEST"
