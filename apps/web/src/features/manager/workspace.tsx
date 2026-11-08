"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorPanel, Loading, QueryBoundary } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { useApiQuery, useScope } from "@/lib/api/hooks";
import type { components } from "@/lib/api/generated";
import { humanize, when } from "@/lib/format";
import { DashboardTable, MetricCard } from "@/features/dashboards/components";
import { InstitutionsRequiringReview } from "@/features/integrity/overview-table";
import { useSession } from "@/features/auth/session";
import { InstitutionDirectory } from "@/features/institutions/directory";
import { useInstitutionOptions } from "@/features/institutions/options";
import { validAcademicYear } from "@/lib/academic-year";

type Schemas = components["schemas"];

export function InstitutionWorkspace() {
  const { session } = useSession();
  return session?.user.role === "AICTE_MANAGER" ? (
    <InstitutionMonitoring />
  ) : (
    <InstitutionDirectory />
  );
}

function InstitutionMonitoring() {
  const [year, setYear] = useState("2026-27");
  const [yearDraft, setYearDraft] = useState("2026-27");
  const [region, setRegion] = useState("");
  const [programme, setProgramme] = useState("");
  const [institution, setInstitution] = useState("");
  const [band, setBand] = useState("");
  const [page, setPage] = useState(1);
  const options = useInstitutionOptions(true);
  const params = new URLSearchParams({
    academic_year: year,
    page: String(page),
    page_size: "25",
  });
  if (region) params.set("region", region);
  if (programme) params.set("programme_code", programme);
  if (institution) params.set("institution_id", institution);
  if (band) params.set("band", band);
  const data = useApiQuery<Schemas["Page_InstitutionMonitoringRow_"]>(
    useScope("manager-monitoring"),
    `/oversight/institutions?${params}`,
  );
  const update = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <p className="eyebrow">INSTITUTION MONITORING</p>
        <h1>Submission completeness</h1>
        <p>
          Compare declarations with records in current activated snapshots.
          Pending candidates do not count.
        </p>
      </header>
      <div className="dashboard-filters">
        <label>
          Academic year
          <input
            value={yearDraft}
            onChange={(e) => setYearDraft(e.target.value)}
            placeholder="2026-27"
          />
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (validAcademicYear(yearDraft)) update(setYear, yearDraft);
          }}
          disabled={!validAcademicYear(yearDraft)}
        >
          Apply year
        </button>
        <label>
          Institution
          <select
            value={institution}
            onChange={(e) => update(setInstitution, e.target.value)}
          >
            <option value="">All institutions</option>
            {options.data?.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.permanent_id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <input
            value={region}
            onChange={(e) => update(setRegion, e.target.value)}
            placeholder="All regions"
          />
        </label>
        <label>
          Programme code
          <input
            value={programme}
            onChange={(e) => update(setProgramme, e.target.value)}
            placeholder="All programmes"
          />
        </label>
        <label>
          Review priority
          <select
            value={band}
            onChange={(e) => update(setBand, e.target.value)}
          >
            <option value="">All bands</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>
      {options.isError && (
        <p className="form-error">Institution options could not be loaded.</p>
      )}
      <section className="panel dashboard-panel">
        <QueryBoundary query={data} loading="Loading institution monitoring…">
          {(result) =>
            result.data.length ? (
              <>
                <DashboardTable label="Institution submissions">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Region</th>
                      <th>Programme / year</th>
                      <th>Snapshot</th>
                      <th>Declared total</th>
                      <th>Uploaded records</th>
                      <th>Active records</th>
                      <th>Shortfall</th>
                      <th>Intake exceptions</th>
                      <th>Priority / signals</th>
                      <th>Last activation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row) => (
                      <tr
                        key={`${row.institution_id}-${row.programme_id}-${row.academic_year}`}
                      >
                        <th scope="row">
                          <Link
                            href={`/aicte/institutions/${row.institution_id}`}
                          >
                            {row.institution_name}
                          </Link>
                          <br />
                          {row.institution_code}
                        </th>
                        <td>{row.region}</td>
                        <td>
                          {row.programme_code} / {row.academic_year ?? "—"}
                        </td>
                        <td>{humanize(row.freshness_status)}</td>
                        <td>{row.declared_total ?? "—"}</td>
                        <td>{row.current_declared_records ?? "—"}</td>
                        <td>{row.current_active_records ?? "—"}</td>
                        <td>{row.shortfall ?? "—"}</td>
                        <td>
                          {row.known_capacity_categories
                            ? `${row.exceeded_categories} exceeded`
                            : "—"}
                        </td>
                        <td>
                          {humanize(row.priority_band)} / {row.active_signals}
                        </td>
                        <td>
                          {row.last_activated_at
                            ? when(row.last_activated_at)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                <Pagination
                  page={page}
                  pageSize={result.pagination.page_size}
                  total={result.pagination.total}
                  busy={data.isFetching}
                  change={setPage}
                  label="Institution monitoring pages"
                />
                <p className="data-note">
                  The shortfall compares declared admissions with uploaded rows,
                  including non-active statuses; it is not a fraud finding. A
                  dash means unavailable. Intake compares each category
                  separately. Priority and signals are institution-wide for the
                  selected year, even when a programme filter is applied.
                </p>
              </>
            ) : (
              <p>No programme scopes match these filters.</p>
            )
          }
        </QueryBoundary>
      </section>
    </div>
  );
}

export function ExecutiveDashboard() {
  const [draft, setDraft] = useState("2026-27");
  const [year, setYear] = useState("2026-27");
  const query = new URLSearchParams({
    academic_year: year,
    category_scheme: "LEGACY",
    page_size: "100",
  });
  const trends = useApiQuery<Schemas["TrendsResponse"]>(
    useScope("manager-trends"),
    `/analytics/enrolment-trends?${query}`,
  );
  const history = useApiQuery<Schemas["TrendsResponse"]>(
    useScope("manager-history"),
    "/analytics/enrolment-trends?category_scheme=LEGACY&page_size=100",
  );
  const completeness = useApiQuery<Schemas["CompletenessResponse"]>(
    useScope("manager-completeness"),
    `/analytics/submission-completeness?${query}`,
  );
  const cases = useApiQuery<Schemas["CasePerformanceResponse"]>(
    useScope("manager-cases"),
    "/analytics/case-performance?page_size=100",
  );
  const intake = useApiQuery<Schemas["UtilisationResponse"]>(
    useScope("manager-intake"),
    `/analytics/intake-utilisation?${query}`,
  );
  const integrity = useApiQuery<Schemas["OverviewResponse"]>(
    useScope("manager-integrity"),
    `/integrity/overview?academic_year=${encodeURIComponent(year)}&page_size=100`,
  );
  const findings = useApiQuery<Schemas["FindingSummary"]>(
    useScope("manager-findings"),
    `/oversight/findings?academic_year=${encodeURIComponent(year)}`,
  );
  const row = trends.data?.data.find((item) => item.academic_year === year);
  const coverage = trends.data?.coverage;
  const percentage =
    coverage && coverage.institutions_total
      ? `${Math.round((100 * coverage.institutions_with_current_snapshot) / coverage.institutions_total)}%`
      : "—";
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <p className="eyebrow">REGULATORY OVERSIGHT</p>
        <h1>Executive dashboard</h1>
        <p>
          Current activated snapshots and case activity · SIMULATED / DEMO DATA
        </p>
      </header>
      <form
        className="dashboard-filters"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            /^\d{4}-\d{2}$/.test(draft) &&
            Number(draft.slice(5)) === (Number(draft.slice(0, 4)) + 1) % 100
          )
            setYear(draft);
        }}
      >
        <label>
          Academic year
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            pattern="[0-9]{4}-[0-9]{2}"
            required
          />
        </label>
        <button className="button secondary">Apply</button>
      </form>
      {trends.isPending || cases.isPending ? (
        <Loading label="Loading oversight metrics…" />
      ) : trends.isError || cases.isError ? (
        <ErrorPanel
          error={trends.error ?? cases.error}
          retry={() => {
            void trends.refetch();
            void cases.refetch();
          }}
        />
      ) : (
        <div className="dashboard-metrics">
          <MetricCard
            label="Institutions in scope"
            value={coverage?.institutions_total ?? "—"}
            note="Institutions represented in analytics scope"
          />
          <MetricCard
            label="With current submissions"
            value={coverage?.institutions_with_current_snapshot ?? "—"}
            note={`At least one activated programme snapshot · ${year}`}
          />
          <MetricCard
            label="Submission coverage"
            value={percentage}
            note="Institutions with a current snapshot ÷ institutions in scope"
          />
          <MetricCard
            label="Active student records"
            value={row?.active_records ?? "—"}
            note="Active records in current activated snapshots; candidates excluded"
          />
          <MetricCard
            label="Open cases"
            value={cases.data?.totals.open ?? "—"}
            note="All years; non-terminal case statuses"
          />
          <MetricCard
            label="Overdue cases"
            value={cases.data?.totals.overdue ?? "—"}
            note="All years; open cases past their due date"
          />
        </div>
      )}
      <section className="panel dashboard-panel">
        <h2>Enrolment by academic year</h2>
        <QueryBoundary query={history} loading="Loading enrolment history…">
          {(data) =>
            data.data.length ? (
              <>
                <DashboardTable label="Active enrolment by year">
                  <thead>
                    <tr>
                      <th>Academic year</th>
                      <th>Current active records</th>
                      <th>Relative count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.academic_year}>
                        <th scope="row">{item.academic_year}</th>
                        <td>{item.active_records ?? "—"}</td>
                        <td>
                          {item.active_records === null ? (
                            "No current snapshot"
                          ) : (
                            <progress
                              aria-label={`Active records ${item.academic_year}`}
                              value={item.active_records}
                              max={Math.max(
                                1,
                                ...data.data.map(
                                  (row) => row.active_records ?? 0,
                                ),
                              )}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                {data.pagination.total > data.data.length && (
                  <p>
                    Showing {data.data.length} of {data.pagination.total} years.
                  </p>
                )}
              </>
            ) : (
              <p>No current-snapshot history is available.</p>
            )
          }
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Submission completeness</h2>
        <QueryBoundary query={completeness} loading="Loading completeness…">
          {(data) => (
            <>
              <p>
                {data.coverage.programmes_with_current_snapshot} of{" "}
                {data.coverage.programmes_total} programme scopes have a current
                snapshot.
              </p>
              <p className="data-note">
                A missing snapshot is unknown, not zero.{" "}
                <Link href="/analytics">Explore completeness and trends</Link>.
              </p>
            </>
          )}
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Intake exceptions</h2>
        <QueryBoundary query={intake} loading="Loading intake comparisons…">
          {(data) => (
            <>
              <p>
                {data.data.some((item) => item.status === "OK")
                  ? `${data.data.filter((item) => item.exceeded).length} exceeded category comparisons shown on this page.`
                  : "No comparable current snapshot and intake rule is available on this page."}
              </p>
              {data.data.some((item) => item.status === "OK") && (
                <DashboardTable label="Category intake comparisons">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Programme / category</th>
                      <th>Approved</th>
                      <th>Active</th>
                      <th>Utilisation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data
                      .filter((item) => item.status === "OK")
                      .slice(0, 8)
                      .map((item) => (
                        <tr key={`${item.programme_id}-${item.category}`}>
                          <td>{item.institution_name}</td>
                          <td>
                            {item.programme_code} / {humanize(item.category)}
                          </td>
                          <td>{item.approved_seats ?? "—"}</td>
                          <td>{item.current_active ?? "—"}</td>
                          <td>
                            {item.utilisation_pct === null
                              ? "—"
                              : `${item.utilisation_pct}%`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </DashboardTable>
              )}
              <p className="data-note">
                Year, programme and category are compared separately. The table
                shows up to eight comparable categories.{" "}
                {data.pagination.total > data.data.length &&
                  `Showing ${data.data.length} of ${data.pagination.total} comparisons.`}{" "}
                <Link href="/analytics">View intake analytics</Link>.
              </p>
            </>
          )}
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Validation findings by type</h2>
        <QueryBoundary query={findings} loading="Loading validation findings…">
          {(data) => (
            <>
              <p className="data-note">
                Latest completed validation on {data.validated_snapshots} of{" "}
                {data.snapshots} current snapshots. Findings are review prompts.
              </p>
              {data.findings.length ? (
                <DashboardTable label="Validation findings">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Severity</th>
                      <th>Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.findings.map((item) => (
                      <tr key={`${item.rule_code}-${item.severity}`}>
                        <td>{humanize(item.rule_code)}</td>
                        <td>{humanize(item.severity)}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              ) : (
                <p>
                  {data.validated_snapshots
                    ? "No findings in the validated current snapshots."
                    : "No current validated snapshots are available."}
                </p>
              )}
            </>
          )}
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Data-quality review signals</h2>
        <QueryBoundary
          query={integrity}
          loading="Loading data-quality signals…"
        >
          {(data) =>
            data.data.length ? (
              <>
                <DashboardTable label="Data-quality signals by institution">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Active data-quality signals</th>
                      <th>Review band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.institution_id}>
                        <td>
                          <Link
                            href={`/aicte/institutions/${item.institution_id}`}
                          >
                            {item.institution_name}
                          </Link>
                        </td>
                        <td>
                          {item.score.components.find(
                            (component) => component.family === "DATA_QUALITY",
                          )?.active_count ?? 0}
                        </td>
                        <td>{humanize(item.score.band)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                <p className="data-note">
                  Signals are deterministic review prompts, not findings of
                  misconduct.{" "}
                  {data.pagination.total > data.data.length &&
                    `Showing ${data.data.length} of ${data.pagination.total} institutions.`}
                </p>
              </>
            ) : (
              <p>No institutions in scope.</p>
            )
          }
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Case status</h2>
        <QueryBoundary query={cases} loading="Loading case status…">
          {(data) => (
            <DashboardTable label="Case status">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Cases</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.by_status.map((item) => (
                  <tr key={item.status}>
                    <th scope="row">{humanize(item.status)}</th>
                    <td>{item.total}</td>
                    <td>{item.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
}

export function PriorityMonitoring() {
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <p className="eyebrow">REGULATORY OVERSIGHT</p>
        <h1>Integrity &amp; priority monitoring</h1>
        <p>Signals are review prompts, not determinations of misconduct.</p>
      </header>
      <InstitutionsRequiringReview canOpenInstitution initialYear="" />
    </div>
  );
}

export function ManagerSignals({ institutionId }: { institutionId: string }) {
  const signals = useApiQuery<Schemas["SignalSummary"][]>(
    useScope("manager-signals", institutionId),
    `/oversight/institutions/${encodeURIComponent(institutionId)}/signals`,
  );
  return (
    <section className="panel dashboard-panel">
      <h2>Review signals</h2>
      <p>Evidence-based review prompts, not proof of misconduct.</p>
      <QueryBoundary query={signals} loading="Loading signals…">
        {(data) =>
          data.length ? (
            <DashboardTable label="Review signals">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Signal</th>
                  <th>Severity</th>
                  <th>Basis</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s, i) => (
                  <tr key={`${s.rule_id}-${i}`}>
                    <td>{s.rule_id}</td>
                    <td>{s.title}</td>
                    <td>{humanize(s.severity)}</td>
                    <td>{s.calculation}</td>
                    <td>{s.dismissed ? "Dismissed" : "Active"}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          ) : (
            <p>No signals are available for this institution.</p>
          )
        }
      </QueryBoundary>
    </section>
  );
}

export function CaseOversight() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const cases = useApiQuery<Schemas["Page_CaseSummary_"]>(
    useScope("oversight-cases", page),
    `/oversight/cases?page=${page}&page_size=25`,
  );
  const detail = useApiQuery<Schemas["CaseDetail"]>(
    useScope("oversight-case", selected),
    selected ? `/oversight/cases/${selected}` : null,
  );
  const stats = useApiQuery<Schemas["CasePerformanceResponse"]>(
    useScope("oversight-performance"),
    "/analytics/case-performance?page_size=100",
  );
  const distribution = useApiQuery<Schemas["CaseDistribution"][]>(
    useScope("case-distribution"),
    "/oversight/case-distribution",
  );
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <p className="eyebrow">REGULATORY OVERSIGHT</p>
        <h1>Case oversight</h1>
        <p>
          Read-only case monitoring. Officers retain responsibility for case
          actions.
        </p>
      </header>
      <QueryBoundary query={stats} loading="Loading case statistics…">
        {(data) => (
          <>
            <div className="dashboard-metrics">
              <MetricCard
                label="Open cases"
                value={data.totals.open}
                note="Non-terminal cases"
              />
              <MetricCard
                label="Under review"
                value={
                  data.by_status.find((s) => s.status === "UNDER_REVIEW")
                    ?.total ?? 0
                }
                note="Cases under investigation"
              />
              <MetricCard
                label="Awaiting correction"
                value={
                  data.by_status.find((s) => s.status === "AWAITING_CORRECTION")
                    ?.total ?? 0
                }
                note="Awaiting institution response"
              />
              <MetricCard
                label="Overdue"
                value={data.totals.overdue}
                note="Non-terminal cases past due"
              />
              <MetricCard
                label="Mean resolution"
                value={
                  data.resolution_days.find((s) => s.priority === "ALL")
                    ?.mean_days ?? "—"
                }
                note="Days for eligible resolved cases"
              />
            </div>
            <section className="panel dashboard-panel">
              <h2>Ageing of open cases</h2>
              <DashboardTable label="Open case ageing">
                <thead>
                  <tr>
                    <th>Age in days</th>
                    <th>Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ageing.map((item) => (
                    <tr key={item.bucket}>
                      <th scope="row">{item.bucket}</th>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </section>
            <section className="panel dashboard-panel">
              <h2>Cases by institution</h2>
              {data.data.length ? (
                <DashboardTable label="Case totals by institution">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Open</th>
                      <th>Overdue</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.institution_id}>
                        <th scope="row">{item.institution_name}</th>
                        <td>{item.open}</td>
                        <td>{item.overdue}</td>
                        <td>{item.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              ) : (
                <p>No institutions in scope.</p>
              )}
              {data.pagination.total > data.data.length && (
                <p>
                  Showing {data.data.length} of {data.pagination.total}{" "}
                  institutions.
                </p>
              )}
            </section>
          </>
        )}
      </QueryBoundary>
      <section className="panel dashboard-panel">
        <h2>Open cases by priority and severity</h2>
        <QueryBoundary
          query={distribution}
          loading="Loading case distribution…"
        >
          {(rows) =>
            rows.length ? (
              <DashboardTable label="Open cases by priority and severity">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Severity</th>
                    <th>Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.priority}-${row.severity}`}>
                      <td>{humanize(row.priority)}</td>
                      <td>{humanize(row.severity)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            ) : (
              <p>No open cases.</p>
            )
          }
        </QueryBoundary>
      </section>
      <section className="panel dashboard-panel">
        <h2>Cases</h2>
        <QueryBoundary query={cases} loading="Loading cases…">
          {(data) =>
            data.data.length ? (
              <>
                <DashboardTable label="Cases for oversight">
                  <thead>
                    <tr>
                      <th>Institution</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Priority / severity</th>
                      <th>Due</th>
                      <th>Evidence</th>
                      <th>Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.id}>
                        <td>{item.institution_name}</td>
                        <td>{humanize(item.category)}</td>
                        <td>
                          {humanize(item.status)}
                          {item.overdue ? " · Overdue" : ""}
                        </td>
                        <td>
                          {humanize(item.priority)} / {humanize(item.severity)}
                        </td>
                        <td>{item.due_at ? when(item.due_at) : "—"}</td>
                        <td>{item.evidence_count} linked records</td>
                        <td>
                          <button
                            className="button secondary"
                            onClick={() => setSelected(item.id)}
                          >
                            View timeline
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                <Pagination
                  page={page}
                  pageSize={data.pagination.page_size}
                  total={data.pagination.total}
                  busy={cases.isFetching}
                  change={setPage}
                  label="Case pagination"
                />
              </>
            ) : (
              <p>No cases are available.</p>
            )
          }
        </QueryBoundary>
      </section>
      {selected && (
        <section className="panel dashboard-panel">
          <h2>Case timeline</h2>
          <QueryBoundary query={detail} loading="Loading timeline…">
            {(data) => (
              <>
                <p>
                  {data.institution_name} · {humanize(data.category)} ·{" "}
                  {data.evidence_count} linked records
                </p>
                {data.timeline.length ? (
                  <ol>
                    {data.timeline.map((event, index) => (
                      <li key={`${event.created_at}-${index}`}>
                        {when(event.created_at)} — {humanize(event.action)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No timeline events.</p>
                )}
                <p className="data-note">
                  Free-text comments and student identifiers are omitted from
                  this oversight view.
                </p>
              </>
            )}
          </QueryBoundary>
        </section>
      )}
    </div>
  );
}

export function Governance() {
  const activity = useApiQuery<Schemas["GovernanceSummary"]>(
    useScope("governance"),
    "/oversight/governance",
  );
  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <p className="eyebrow">GOVERNANCE</p>
        <h1>Audit &amp; governance</h1>
        <p>
          Aggregate audit activity across the local demo. Event payloads are not
          shown.
        </p>
      </header>
      <section className="panel dashboard-panel">
        <h2>Recorded actions</h2>
        <QueryBoundary query={activity} loading="Loading governance activity…">
          {(data) =>
            data.activities.length ? (
              <>
                <DashboardTable label="Audit activity counts">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map((item) => (
                      <tr key={item.action}>
                        <th scope="row">{humanize(item.action)}</th>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
                <h2>Activity by month</h2>
                <DashboardTable label="Monthly audit activity">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Action</th>
                      <th>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((item) => (
                      <tr key={`${item.month}-${item.action}`}>
                        <td>{item.month.slice(0, 7)}</td>
                        <td>{humanize(item.action)}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              </>
            ) : (
              <p>No audit activity is recorded.</p>
            )
          }
        </QueryBoundary>
      </section>
    </div>
  );
}
