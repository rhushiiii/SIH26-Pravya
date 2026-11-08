"""Opt-in, repeatable synthetic manager fixtures using the real submission API.

Run after migrations and the base seed: ``python -m app.manager_demo``.
This owns only its MGR-DEMO programme scopes. It refuses to replace a snapshot
created outside this fixture and never edits existing student records.
"""

import csv
import io
from typing import Any, cast
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import build_engine
from app.main import create_app
from app.modules.cases.models import CaseRecord, ReviewCase
from app.modules.institutions.models import AdmissionCategory, IntakeRule, Programme
from app.modules.intake.models import IntakeAssessment
from app.modules.intake.services import latest_declaration
from app.modules.submissions.models import SubmissionBatch, SubmissionScope
from app.seed import ensure_fixture, seed_id

SLUGS = ("cedar", "maple", "willow")
PROGRAMMES = ("MGR-DEMO-COMP", "MGR-DEMO-ELEC", "MGR-DEMO-HEALTHY")
YEARS = ("2025-26", "2026-27")
CAPACITIES = {
    "REGULAR": 12,
    "SUPERNUMERARY": 2,
    "NRI": 2,
    "OCI": 2,
    "FOREIGN_NATIONAL": 2,
}


def csv_bytes(slug_index: int, programme_index: int, year_index: int) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        (
            "college_student_id",
            "student_name",
            "apaar_id",
            "academic_year",
            "programme_code",
            "admission_category",
            "enrollment_status",
            "enrollment_date",
        )
    )
    size = 3 if programme_index == 2 else 16 + slug_index + year_index
    for index in range(size):
        category = (
            "REGULAR" if index < 13 else ("NRI" if index % 2 else "SUPERNUMERARY")
        )
        number = (
            900800000000
            + slug_index * 100000
            + programme_index * 10000
            + year_index * 1000
            + index
        )
        # Deliberate potential overlap between two institutions; review may explain it.
        if slug_index == 1 and programme_index == 0 and year_index == 1 and index == 0:
            number = 900800001000
        identifier = (
            ""
            if slug_index == 2 and programme_index != 2 and index == 1
            else str(number)
        )
        writer.writerow(
            (
                f"MGR-{slug_index}-{programme_index}-{year_index}-{index:03d}",
                f"Synthetic learner {slug_index}-{programme_index}-"
                f"{year_index}-{index:03d}",
                identifier,
                YEARS[year_index],
                PROGRAMMES[programme_index],
                category,
                "WITHDRAWN" if programme_index != 2 and index == size - 1 else "ACTIVE",
                f"{YEARS[year_index][:4]}-08-01",
            )
        )
    return output.getvalue().encode("utf-8")


def prepare_metadata(settings: Settings) -> None:
    engine = build_engine(settings)
    try:
        with Session(engine) as session, session.begin():
            for slug in SLUGS:
                institution_id = seed_id("institutions", slug)
                for code in PROGRAMMES:
                    key = f"{slug}/{code}"
                    programme_id = seed_id("programmes", key)
                    ensure_fixture(
                        session,
                        Programme,
                        key,
                        {
                            "institution_id": institution_id,
                            "code": code,
                            "name": f"Synthetic {code}",
                            "active": True,
                        },
                        institution_id,
                    )
                    for year in YEARS:
                        for category, capacity in CAPACITIES.items():
                            ensure_fixture(
                                session,
                                IntakeRule,
                                f"{key}/{year}/{category}/DEMO-v1",
                                {
                                    "institution_id": institution_id,
                                    "programme_id": programme_id,
                                    "academic_year": year,
                                    "category": AdmissionCategory(category),
                                    "approved_seats": capacity,
                                    "rule_version": "DEMO-v1",
                                    "source_label": "DEMO",
                                },
                                institution_id,
                            )
    finally:
        engine.dispose()


def request(
    client: TestClient,
    method: str,
    path: str,
    *,
    expected: tuple[int, ...] = (200,),
    **kwargs: Any,
) -> dict[str, Any]:
    response = client.request(method, f"/api/v1{path}", **kwargs)
    if response.status_code not in expected:
        try:
            code = str(response.json().get("error", {}).get("code", "UNKNOWN"))
        except ValueError:
            code = "UNKNOWN"
        raise RuntimeError(
            f"Manager demo step failed: {method} {path.split('?')[0]} "
            f"returned {response.status_code} ({code})"
        )
    return cast(dict[str, Any], response.json())


def ensure_declaration(
    client: TestClient,
    engine: Engine,
    headers: dict[str, str],
    institution_id: UUID,
    programme_id: UUID,
    year: str,
    total: int,
) -> None:
    with Session(engine) as session:
        if latest_declaration(session, institution_id, programme_id, year) is not None:
            return
    request(
        client,
        "POST",
        f"/institutions/{institution_id}/declarations",
        expected=(201,),
        headers=headers,
        json={
            "programme_id": str(programme_id),
            "academic_year": year,
            "declared_total": total,
            "basis": "Synthetic demo declaration for manager oversight",
        },
    )


def ensure_assessment(
    client: TestClient,
    engine: Engine,
    headers: dict[str, str],
    batch_id: UUID,
    revision: int,
) -> None:
    with Session(engine) as session:
        existing = session.scalar(
            select(IntakeAssessment.id).where(
                IntakeAssessment.batch_id == batch_id,
                IntakeAssessment.scope_revision == revision,
            )
        )
        if existing is not None:
            return
    request(
        client,
        "POST",
        f"/submissions/{batch_id}/intake-assessments",
        expected=(201,),
        headers=headers,
    )


def run(settings: Settings) -> dict[str, int]:
    if settings.app_env != "local" or not settings.demo_auth:
        raise ValueError("Manager demo requires local DEMO_AUTH mode")
    prepare_metadata(settings)
    engine = build_engine(settings)
    created = 0
    try:
        with TestClient(
            create_app(settings),
            base_url="http://localhost",
            client=("127.0.0.1", 50000),
        ) as client:
            for si, slug in enumerate(SLUGS):
                token = request(
                    client,
                    "POST",
                    "/auth/demo-login",
                    json={"demo_alias": f"{slug}_admin"},
                )["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                institution_id = seed_id("institutions", slug)
                for pi, code in enumerate(PROGRAMMES):
                    programme_id = seed_id("programmes", f"{slug}/{code}")
                    for yi, year in enumerate(YEARS):
                        if pi == 2 and (slug != "willow" or year != "2026-27"):
                            continue
                        declaration_total = (
                            3 if pi == 2 else (22 if slug == "cedar" else 16 + si + yi)
                        )
                        key = f"manager-demo-{slug}-{pi}-{yi}-v1"
                        with Session(engine) as session:
                            scope = session.scalar(
                                select(SubmissionScope).where(
                                    SubmissionScope.institution_id == institution_id,
                                    SubmissionScope.programme_id == programme_id,
                                    SubmissionScope.academic_year == year,
                                )
                            )
                            batch = session.scalar(
                                select(SubmissionBatch).where(
                                    SubmissionBatch.institution_id == institution_id,
                                    SubmissionBatch.idempotency_key == key,
                                )
                            )
                            if scope and scope.current_batch_id:
                                allowed = {batch.id} if batch is not None else set()
                                if (slug, pi, yi) == ("cedar", 0, 1):
                                    correction = session.scalar(
                                        select(SubmissionBatch).where(
                                            SubmissionBatch.institution_id
                                            == institution_id,
                                            SubmissionBatch.idempotency_key
                                            == "manager-demo-cedar-correction-v1",
                                        )
                                    )
                                    if correction is not None:
                                        allowed.add(correction.id)
                                if scope.current_batch_id not in allowed:
                                    raise ValueError(
                                        "Manager fixture scope has an unrelated "
                                        "current snapshot; no replacement attempted"
                                    )
                                ensure_declaration(
                                    client,
                                    engine,
                                    headers,
                                    institution_id,
                                    programme_id,
                                    year,
                                    declaration_total,
                                )
                                ensure_assessment(
                                    client,
                                    engine,
                                    headers,
                                    scope.current_batch_id,
                                    scope.revision,
                                )
                                continue
                        upload = request(
                            client,
                            "POST",
                            "/submissions",
                            expected=(200, 201),
                            headers={**headers, "Idempotency-Key": key},
                            data={
                                "institution_id": str(institution_id),
                                "programme_id": str(programme_id),
                                "academic_year": year,
                                "schema_version": "v1",
                            },
                            files={
                                "file": (
                                    "manager-demo.csv",
                                    csv_bytes(si, pi, yi),
                                    "text/csv",
                                )
                            },
                        )
                        batch_id = upload["id"]
                        run_result = request(
                            client,
                            "POST",
                            f"/submissions/{batch_id}/validate",
                            expected=(201,),
                            headers=headers,
                        )
                        review = request(
                            client,
                            "POST",
                            f"/submissions/{batch_id}/reviews",
                            expected=(201,),
                            headers=headers,
                            json={"validation_run_id": run_result["id"]},
                        )
                        request(
                            client,
                            "POST",
                            f"/submissions/{batch_id}/activate",
                            headers=headers,
                            json={
                                "review_id": review["id"],
                                "expected_scope_revision": review[
                                    "expected_scope_revision"
                                ],
                                "confirm_complete_replacement": True,
                                "acknowledge_review_warnings": True,
                                "acknowledge_omissions": True,
                            },
                        )
                        ensure_declaration(
                            client,
                            engine,
                            headers,
                            institution_id,
                            programme_id,
                            year,
                            declaration_total,
                        )
                        with Session(engine) as session:
                            current_scope = session.scalar(
                                select(SubmissionScope).where(
                                    SubmissionScope.institution_id == institution_id,
                                    SubmissionScope.programme_id == programme_id,
                                    SubmissionScope.academic_year == year,
                                )
                            )
                            assert current_scope is not None
                            ensure_assessment(
                                client,
                                engine,
                                headers,
                                UUID(batch_id),
                                current_scope.revision,
                            )
                        created += 1
            officer_token = request(
                client, "POST", "/auth/demo-login", json={"demo_alias": "demo_officer"}
            )["access_token"]
            officer = {"Authorization": f"Bearer {officer_token}"}
            for slug, state in (
                ("cedar", "open"),
                ("maple", "resolved"),
                ("maple", "review"),
                ("willow", "awaiting"),
            ):
                key = f"manager-demo-{slug}-0-1-v1"
                label = f"Synthetic manager demo {slug} intake review"
                if state in {"review", "awaiting"}:
                    label += f" ({state})"
                with Session(engine) as session:
                    batch = session.scalar(
                        select(SubmissionBatch).where(
                            SubmissionBatch.institution_id
                            == seed_id("institutions", slug),
                            SubmissionBatch.idempotency_key == key,
                        )
                    )
                    case = session.scalar(
                        select(ReviewCase).where(
                            ReviewCase.institution_id == seed_id("institutions", slug),
                            ReviewCase.summary == label,
                        )
                    )
                    if batch is None:
                        raise ValueError("Manager demo batch is missing")
                    if case is not None:
                        linked = session.scalar(
                            select(CaseRecord.id).where(
                                CaseRecord.case_id == case.id,
                                CaseRecord.batch_id == batch.id,
                            )
                        )
                        if linked is None:
                            raise ValueError(
                                "Existing demo case has unexpected evidence"
                            )
                        continue
                    batch_id = str(batch.id)
                records = request(
                    client,
                    "GET",
                    f"/submissions/{batch_id}/rows?page_size=1",
                    headers=officer,
                )["data"]
                opened = request(
                    client,
                    "POST",
                    "/cases",
                    expected=(201,),
                    headers=officer,
                    json={
                        "category": "INTAKE_DISCREPANCY",
                        "summary": label,
                        "record_version_ids": [records[0]["id"]],
                        "priority": "HIGH",
                        "severity": "HIGH",
                        "due_at": "2025-10-01T00:00:00Z"
                        if state in {"open", "resolved"}
                        else "2099-10-01T00:00:00Z",
                    },
                )
                if state in {"resolved", "review"}:
                    case_id = opened["id"]
                    request(
                        client,
                        "POST",
                        f"/cases/{case_id}/actions",
                        expected=(201,),
                        headers=officer,
                        json={"action": "START_REVIEW"},
                    )
                if state == "resolved":
                    request(
                        client,
                        "POST",
                        f"/cases/{case_id}/actions",
                        expected=(201,),
                        headers=officer,
                        json={
                            "action": "RESOLVED",
                            "resolution_reason": "Synthetic demo review completed",
                        },
                    )
                if state == "awaiting":
                    request(
                        client,
                        "POST",
                        f"/cases/{opened['id']}/actions",
                        expected=(201,),
                        headers=officer,
                        json={
                            "action": "REQUEST_CORRECTION",
                            "comment": "Synthetic request for institution review",
                        },
                    )
            # The correction is a new immutable snapshot; the original case keeps
            # its link to the earlier batch. Only the fixture-owned scope is used.
            institution_id = seed_id("institutions", "cedar")
            programme_id = seed_id("programmes", "cedar/MGR-DEMO-COMP")
            correction_key = "manager-demo-cedar-correction-v1"
            with Session(engine) as session:
                scope = session.scalar(
                    select(SubmissionScope).where(
                        SubmissionScope.institution_id == institution_id,
                        SubmissionScope.programme_id == programme_id,
                        SubmissionScope.academic_year == "2026-27",
                    )
                )
                corrected = session.scalar(
                    select(SubmissionBatch).where(
                        SubmissionBatch.institution_id == institution_id,
                        SubmissionBatch.idempotency_key == correction_key,
                    )
                )
                already_current = bool(
                    scope and corrected and scope.current_batch_id == corrected.id
                )
            if not already_current:
                token = request(
                    client,
                    "POST",
                    "/auth/demo-login",
                    json={"demo_alias": "cedar_admin"},
                )["access_token"]
                headers = {"Authorization": f"Bearer {token}"}
                content = csv_bytes(0, 0, 1).replace(
                    b"Synthetic learner 0-0-1-000",
                    b"Synthetic learner 0-0-1-000 corrected",
                    1,
                )
                uploaded = request(
                    client,
                    "POST",
                    "/submissions",
                    expected=(200, 201),
                    headers={**headers, "Idempotency-Key": correction_key},
                    data={
                        "institution_id": str(institution_id),
                        "programme_id": str(programme_id),
                        "academic_year": "2026-27",
                        "schema_version": "v1",
                    },
                    files={
                        "file": ("manager-demo-correction.csv", content, "text/csv")
                    },
                )
                batch_id = uploaded["id"]
                validation = request(
                    client,
                    "POST",
                    f"/submissions/{batch_id}/validate",
                    expected=(201,),
                    headers=headers,
                )
                review = request(
                    client,
                    "POST",
                    f"/submissions/{batch_id}/reviews",
                    expected=(201,),
                    headers=headers,
                    json={"validation_run_id": validation["id"]},
                )
                request(
                    client,
                    "POST",
                    f"/submissions/{batch_id}/activate",
                    headers=headers,
                    json={
                        "review_id": review["id"],
                        "expected_scope_revision": review["expected_scope_revision"],
                        "confirm_complete_replacement": True,
                        "acknowledge_review_warnings": True,
                        "acknowledge_omissions": True,
                    },
                )
                with Session(engine) as session:
                    current_scope = session.scalar(
                        select(SubmissionScope).where(
                            SubmissionScope.institution_id == institution_id,
                            SubmissionScope.programme_id == programme_id,
                            SubmissionScope.academic_year == "2026-27",
                        )
                    )
                    assert current_scope is not None
                    ensure_assessment(
                        client, engine, headers, UUID(batch_id), current_scope.revision
                    )
                created += 1
    finally:
        engine.dispose()
    return {"new_activated_snapshots": created}


def main() -> int:
    try:
        result = run(Settings(rate_limit_enabled=False))
    except (ValueError, RuntimeError):
        print(
            "Manager demo could not complete; check migrations, "
            "base seed and fixture conflicts."
        )
        return 1
    print(
        "SIMULATED / DEMO DATA: "
        f"{result['new_activated_snapshots']} snapshots activated"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
