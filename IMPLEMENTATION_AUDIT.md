# PRAVYA Repository Implementation Audit

Audit date: 31 October 2026  
Scope: source and project documentation review. This audit does not claim a new
test run; the verification baseline below is reported from `STATUS.md`.

## Executive summary

PRAVYA is a connected prototype, not a set of dashboard-only mocks. The current
stack is Next.js App Router, React, strict TypeScript, Tailwind, FastAPI,
Pydantic 2, SQLAlchemy 2, Alembic and PostgreSQL. It has 12 migrations, 13
feature-owned API modules, a role-scoped portal, synthetic seed data, and a
reproducible API-driven demonstration. The current demo covers ingestion,
validation, snapshot review/activation, simulated APAAR checks, integrity
signals, cases, reports and audit evidence.

The most important remaining risks are production boundaries and unverified UI
quality: authentication is restricted local demo auth rather than OIDC/MFA;
there is no official APAAR/ABC integration; ABC reconciliation is deferred; the
UI has not received a full visual, keyboard, screen-reader or responsive audit;
and several advanced claims in the attached master prompt are not implemented.
These are prototype limitations, not reasons to replace the working architecture.

## Stack and repository map

| Area | Existing implementation |
| --- | --- |
| Web | `apps/web/src/app`, shared `components`, feature components in `apps/web/src/features`, API client and generated types in `apps/web/src/lib` |
| API | `services/api/app/modules` feature packages; shared configuration, DB, security, pagination and HTTP concerns in `app/core` |
| Persistence | PostgreSQL, SQLAlchemy models owned by features, Alembic migrations `0001` through `0012` |
| Synthetic demonstration | `services/api/app/seed.py`, `services/api/app/demo_scenario.py`, `samples/demo/` and expected scenario manifest |
| Tests | `services/api/tests/` contains 25 `test_*.py` files; automated browser/e2e tests were removed by project direction |
| Run instructions and status | `README.md`, `STATUS.md`, `docs/01`–`09`, `DEMO_SCRIPT.md` |

## Feature status

Statuses describe the local prototype and do not imply production or government
approval. “Tested” reflects the latest results documented in `STATUS.md` dated
30 October 2026, not a fresh run for this audit.

| Feature | Existing files / evidence | Status | Main gap |
| --- | --- | --- | --- |
| Local authentication and role access | `modules/auth`, `features/auth`, `test_auth.py`, route security tests | TESTED | Local demo mode only; no production OIDC, MFA, membership administration or account lifecycle. |
| Institution/programme metadata | `modules/institutions`, institution pages/features, `test_institutions.py` | TESTED | Onboarding and programme-management writes are not a production workflow. |
| CSV/XLSX/manual student submission | `modules/submissions`, `features/submissions`, submission parsing tests | TESTED | Strict v1 schema; no configurable column-mapping templates or external client API. Manual entry adapts to the existing CSV contract. |
| Validation and feedback | `modules/validation`, validation workspace and tests | TESTED | Deterministic configured/demo rules only; rules are not official policy. |
| Snapshot review and activation | submission review services/routes, review UI, `test_activation.py` | TESTED | Explicit snapshot replacement semantics; no silent append or overwrite. |
| APAAR format and identity status | validation and verification modules, verification UI and tests | TESTED | Format check and simulated provider are distinct; mock results are not live identity verification. |
| Potential duplicates | validation rules/services, integrity views and scenario fixtures | TESTED | Bounded peer comparisons are not a scalable shared matching service; overlaps need human review. |
| Intake governance | `modules/intake`, intake features, `test_intake.py` | TESTED | Seed values/versions are illustrative, not official intake limits. |
| Officer cases and correction loop | `modules/cases`, case features, `test_cases.py` | TESTED | Human visual review remains limited; no complete external evidence-document workflow. |
| Integrity signals and officer decisions | `modules/integrity`, integrity UI, `test_integrity.py` | TESTED | Deterministic rules, not machine learning or fraud determinations; advanced before/after analysis is incomplete. |
| Institution/officer/manager dashboards | dashboard features, analytics module and tests | TESTED | Prototype-scale request fan-out and first-page limits are documented; UI needs manual visual/accessibility review. |
| Reports and exports | `modules/reports`, report center, `test_reports.py` | TESTED | Prototype PDF/XLSX/CSV output; no production report-job operations. |
| Audit trail | `modules/audit`, audit explorer, `test_audit_explorer.py` | TESTED | Append-only application path; no independent external anchoring. |
| Notifications | `modules/notifications`, notification UI, `test_notifications.py` | TESTED | In-app only; no email/SMS delivery. |
| Verifiable credentials | `modules/credentials`, credential pages, `test_credentials.py` | TESTED | Signed demo credentials; no trusted production issuer registry or revocation distribution. |
| Authorized third-party verifier | verifier workspace and credential verification routes | IN_PROGRESS | Demo verification only; no production verifier onboarding or broad external access. |
| ABC credit reconciliation | No ABC feature module or provider; planned in `STATUS.md` | NOT_STARTED | Optional contract, authorization basis and provider must be agreed before implementation. |
| Missing-population comparison | Declared totals, intake assessment and integrity signals | IN_PROGRESS | Limited to available declarations and current snapshots; no generalized reporting-cutoff reconciliation. |
| Submission change analysis | Immutable versions and integrity signal surfaces | IN_PROGRESS | No full field-level diff workflow with institution explanation and case lifecycle. |
| Regulatory rule time machine | Versioned intake rules and immutable validation runs | IN_PROGRESS | Historical artifacts exist, but no dedicated compare/revalidation UI for arbitrary rule versions. |

## End-to-end and data review

- **Connected happy path:** synthetic files are submitted through authenticated
  APIs, parsed into immutable batches/row versions, validated into immutable
  findings, reviewed, and explicitly activated. Current summaries derive from
  activated snapshots. The demo runner exercises the API instead of writing
  database rows directly.
- **Failure paths:** upload bounds, parsing errors, idempotency, database
  failures, validation budgets, stale reviews, role denial and scoped resource
  access have dedicated tests documented in `STATUS.md` and `docs/08`.
- **Versioning:** batches and validation runs are immutable; activation records
  explicit review receipts and scope revisions. Re-submission does not silently
  replace a current snapshot.
- **Identity and privacy:** APAAR format and provider results are separate;
  provider output is simulated and labeled. Routine row responses mask APAAR.
  Demo data is synthetic. Demo auth is only allowed with explicit local settings.
- **Persistence:** PostgreSQL and Alembic are the application persistence path;
  SQLite is not substituted. Seed and demonstration records are fictional.
- **Contracts:** OpenAPI is published and generated TypeScript API types have a
  consistency check. `docs/03_DATA_MODEL.md` and `docs/04_API_CONTRACT.md` lag
  later migrations/routes; `STATUS.md` already records OpenAPI as the current
  runtime contract.

## Security and correctness findings

1. **Production authentication is absent.** Current auth is deliberately
   `DEMO_AUTH` local-only with expiring signed tokens. Do not expose it via a
   public host, tunnel or reverse proxy. OIDC/MFA is a separately approved
   architecture/integration project.
2. **No official provider access exists.** APAAR identity checks are simulated;
   no official APAAR, DigiLocker, API Setu, AICTE restricted-data or ABC access
   is present. Never label a mock response official.
3. **Rules are illustrative.** Intake values and anomaly thresholds are DEMO
   values. Officers retain decision authority; a signal is not a fraud finding.
4. **Audit trust has a boundary.** Append-only database controls help detect
   application-level edits, but without independent anchoring they cannot
   prevent a privileged database operator from rewriting all history.
5. **Operational hardening remains.** STATUS identifies rate limits as
   per-process and notes gaps in key rotation, retention, encryption, email
   delivery and real-data security review.
6. **UI assurance is behind API assurance.** No automated UI regression suite
   exists by decision. The latest status explicitly says the built UI has not
   received a full manual visual, keyboard, screen-reader and mobile pass.
7. **Documentation drift exists.** API/data-model docs and older sections of
   README/UI roadmap contain earlier milestones; use current source, OpenAPI,
   and the current-status section of `STATUS.md` when they disagree.

No raw environment values or credentials were included in this audit.

## Verification baseline (reported, not rerun)

`STATUS.md` reports, for 30 October 2026: backend Ruff/mypy/pip checks clean;
655 PostgreSQL-backed tests passed; frontend lint/format/type/API checks clean
and production build successful; the API-driven demonstration passed 12/12
steps. That report used PostgreSQL 16.15, not the repository's PostgreSQL 17
image. This audit did not rerun those commands.

## Minimum next work

1. Complete a real manual review of institution, officer, manager and verifier
   screens at desktop and mobile widths, including keyboard/focus and screen
   reader checks. Fix specific layout/accessibility defects as small UI slices.
2. Reconcile only the stale documentation sections after presenting proposed
   changes for approval; avoid changing authoritative requirements to match code.
3. Choose one vertical slice from the explicitly deferred roadmap (ABC is
   optional; change analysis or rule-history view are plausible prototype work).
   Define its contract, permissions and tests before changing API/schema.
4. Keep production auth, official integrations, legal/privacy controls and
   external audit anchoring as explicit deployment gates.

The attached master prompt's Keycloak/OIDC/MFA, independent HMAC coordination,
full evidence upload, all advanced detectors and production verifier scope are
not silently adopted here: they require separate design/authorization where
they change existing architecture, contracts or data handling.
