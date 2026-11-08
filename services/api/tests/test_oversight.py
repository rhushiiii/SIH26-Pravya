from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from test_cases import act, open_case, record_ids
from test_validation import upload

from app.seed import seed_id


def test_manager_oversight_redacts_and_preserves_case_permissions(
    client: TestClient,
    auth_headers: Callable[[str], dict[str, str]],
    seeded_session: Session,
) -> None:
    officer = auth_headers("demo_officer")
    manager = auth_headers("demo_manager")
    batch = upload(client, auth_headers("cedar_admin"))
    case = open_case(
        client,
        officer,
        record_ids(seeded_session, batch),
        summary="private 900000000001",
    ).json()
    case_id = case["id"]
    assert (
        act(
            client, case_id, officer, "COMMENT", comment="private 900000000001"
        ).status_code
        == 201
    )
    listing = client.get("/api/v1/oversight/cases", headers=manager)
    assert listing.status_code == 200
    assert listing.json()["pagination"]["total"] == 1
    distribution = client.get("/api/v1/oversight/case-distribution", headers=manager)
    assert distribution.status_code == 200
    assert sum(row["count"] for row in distribution.json()) == 1
    detail = client.get(f"/api/v1/oversight/cases/{case_id}", headers=manager)
    assert detail.status_code == 200
    assert detail.json()["evidence_count"] > 0
    assert [event["action"] for event in detail.json()["timeline"]] == [
        "OPENED",
        "COMMENT",
    ]
    assert "900000000001" not in detail.text and "private" not in detail.text
    assert act(client, case_id, manager, "COMMENT").status_code == 403
    for alias in ("demo_officer", "cedar_admin", "demo_verifier"):
        for path in ("/api/v1/oversight/cases", f"/api/v1/oversight/cases/{case_id}"):
            assert client.get(path, headers=auth_headers(alias)).status_code == 403
    assert client.get("/api/v1/oversight/cases").status_code == 401
    assert client.get(f"/api/v1/oversight/cases/{case_id}").status_code == 401


def test_governance_and_signals_are_manager_only(
    client: TestClient, auth_headers: Callable[[str], dict[str, str]]
) -> None:
    manager = auth_headers("demo_manager")
    other_roles = [
        auth_headers(alias)
        for alias in ("demo_officer", "cedar_admin", "demo_verifier")
    ]
    paths = [
        "/api/v1/oversight/institutions?academic_year=2026-27",
        "/api/v1/oversight/findings?academic_year=2026-27",
        "/api/v1/oversight/case-distribution",
        "/api/v1/oversight/governance",
        f"/api/v1/oversight/institutions/{seed_id('institutions', 'cedar')}/signals",
    ]
    for path in paths:
        assert client.get(path, headers=manager).status_code == 200
        for headers in other_roles:
            assert client.get(path, headers=headers).status_code == 403
        assert client.get(path).status_code == 401
