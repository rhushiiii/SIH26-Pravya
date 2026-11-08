# Manager oversight demonstration

All data and intake limits below are **SIMULATED / DEMO DATA**. Local format
checks do not verify an APAAR against a government service. Signals are prompts
for human review, not findings of misconduct.

## Setup

Use the local setup in `README.md`, including migrations and `python -m app.seed`.
Configure the local demo matching key as described in `.env.example`, then run
`python -m app.manager_demo` from `services/api`. This opt-in command adds only
its `MGR-DEMO-*` programme scopes and refuses to replace an unrelated current
snapshot. Running it again after successful completion does not add snapshots.
The original Cedar, Maple and Willow demonstration remains available separately
through `DEMO_SCRIPT.md` and `python -m app.demo_scenario`.

On a fresh database the Manager fixture contains three fictional institutions,
three additional programmes per institution, thirteen activated programme-year
snapshots across 2025-26 and 2026-27, and 230 synthetic record versions, including
an earlier Cedar snapshot retained after a correction. The
2026-27 fixture has 111 uploaded rows, of which 105 are active. It includes a
Cedar declaration shortfall, category-specific intake exceedances, a potential
cross-institution match, an overdue case, an under-review case, an
awaiting-correction case, and one resolved case. Existing
data can change totals; missing snapshots are unknown, not zero.

## Two to three minute path

1. **Sign in** — `/login`: select **Admissions Manager** and **Continue**.
   Narration: “The Manager has a read-only regulatory oversight workspace.”
   Demonstrates role separation.
2. **Executive dashboard** — `/manager`: choose `2026-27` and apply. On a
   fresh fixture, the active-record total is 105 and one open case is overdue.
   Narration: “Current activated snapshots are counted separately from pending
   candidates; case counts cover all years.” Demonstrates reporting coverage.
3. **Institution monitoring** — `/aicte/institutions`: filter Cedar and
   `MGR-DEMO-COMP`. For 2026-27 the declaration is 22 and the uploaded snapshot
   has 17 rows, a shortfall of 5. Open Cedar to see review signals. Narration:
   “A declaration shortfall is a review prompt, not proof of missing students.”
   Demonstrates evidence-led data-quality review.
4. **Admission analytics** — `/analytics`: select **Intake utilisation**,
   `2026-27`, and the relevant institution. The `MGR-DEMO-*` REGULAR category
   has 13 active records against an illustrative limit of 12. Narration:
   “Capacity is compared within programme, year and category.” Demonstrates
   intake checks without pooling categories.
5. **Case oversight** — `/aicte/case-oversight`: inspect the overdue Cedar case
   and open its timeline. The Maple example is resolved. Narration: “Managers
   monitor cases; officers perform investigations and decisions.” Demonstrates
   escalation visibility and separation of duties.
6. **Regulatory reports** — `/reports`: select **Enrolment summary**, legacy
   categories and `2026-27`; preview or download CSV, XLSX or PDF. Narration:
   “The export and dashboard use the same underlying analytics.” Demonstrates
   traceable aggregate reporting.
7. **Audit & governance** — `/manager/governance`: inspect action counts and
   monthly activity, including report exports. Narration: “The governance view
   summarizes history without displaying record-level audit payloads.”

The Cedar case remains linked to the earlier snapshot after its corrected
replacement. The fuller correction walkthrough is in `DEMO_SCRIPT.md`.
