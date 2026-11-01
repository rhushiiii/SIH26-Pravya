"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession, type Role } from "@/features/auth/session";
import { validAcademicYear } from "@/features/submissions/data";
import { CASE_PRIORITIES, CASE_SEVERITIES } from "@/features/cases/shared";
import {
  EnumSelect,
  InstitutionSelect,
  RegionSelect,
} from "@/components/ui/filters";
import { ApiError, errorMessage } from "@/lib/api/client";
import { saveBlob } from "@/lib/download";
import { DEMO_TAG, regionsOf } from "@/lib/format";
import {
  useInstitutionOptions,
  type InstitutionPage,
} from "@/features/institutions/options";
import { DashboardTable } from "@/features/dashboards/components";
import { parseReportCsv, type ParsedReport } from "./parse-csv";

type Format = "csv" | "xlsx" | "pdf";
type Kind =
  | "enrolment-summary"
  | "intake-utilisation"
  | "submission-completeness"
  | "resolution-times"
  | "validation-findings"
  | "open-cases"
  | "verification-activity";
type Filters = {
  categoryScheme: "RESERVATION" | "LEGACY" | "";
  year: string;
  institution: string;
  region: string;
  programme: string;
  priority: string;
  severity: string;
};

const FORMATS: Record<Format, { label: string; accept: string }> = {
  csv: { label: "CSV", accept: "text/csv" },
  xlsx: {
    label: "Excel (.xlsx)",
    accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pdf: { label: "PDF", accept: "application/pdf" },
};

const REPORTS: {
  kind: Kind;
  title: string;
  description: string;
  roles: Role[];
  cases?: boolean;
}[] = [
  {
    kind: "enrolment-summary",
    title: "Enrolment summary",
    description: "Aggregate enrolment by academic year, programme and region.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "intake-utilisation",
    title: "Intake utilisation",
    description:
      "Declared enrolment against approved capacity per seat category.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "submission-completeness",
    title: "Submission completeness",
    description: "Which programmes have a current activated snapshot.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "resolution-times",
    title: "Resolution times",
    description: "How long cases take to resolve, by priority.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER"],
    cases: true,
  },
  {
    kind: "validation-findings",
    title: "Validation findings",
    description: "Counts of validation findings by rule and severity.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER"],
    cases: true,
  },
  {
    kind: "open-cases",
    title: "Open cases",
    description: "Cases that are still open, with priority and age.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER"],
    cases: true,
  },
  {
    kind: "verification-activity",
    title: "Verification activity",
    description: "Summary of recorded verification requests and outcomes.",
    roles: ["AICTE_OFFICER"],
  },
];

const EMPTY: Filters = {
  categoryScheme: "",
  year: "",
  institution: "",
  region: "",
  programme: "",
  priority: "",
  severity: "",
};

function ReportCard({
  report,
  institutions,
  regions,
  fixedInstitution,
  initial,
}: {
  report: (typeof REPORTS)[number];
  institutions: InstitutionPage["data"];
  regions: string[];
  fixedInstitution: boolean;
  initial: Filters;
}) {
  const { download } = useSession();
  const [filters, setFilters] = useState<Filters>(initial);
  const [format, setFormat] = useState<Format>("csv");
  const [validation, setValidation] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<ParsedReport | null>(null);
  const id = `report-${report.kind}`;
  const set = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPreview(null);
    setStatus("");
    setValidation("");
  };

  const buildQuery = (overrideFormat: Format) => {
    const query = new URLSearchParams({ format: overrideFormat });
    if (filters.categoryScheme)
      query.set("category_scheme", filters.categoryScheme);
    if (filters.year.trim()) query.set("academic_year", filters.year.trim());
    if (!fixedInstitution && filters.institution)
      query.set("institution_id", filters.institution);
    if (filters.region) query.set("region", filters.region);
    if (filters.programme.trim())
      query.set("programme_code", filters.programme.trim());
    if (report.cases) {
      if (filters.priority) query.set("priority", filters.priority);
      if (filters.severity) query.set("severity", filters.severity);
    }
    return query;
  };

  const exportReport = useMutation({
    mutationFn: () => {
      const query = buildQuery(format);
      return download(`/reports/${report.kind}?${query}`, undefined, {
        accept: FORMATS[format].accept,
        fallbackName: `${report.kind}.${format}`,
      });
    },
    retry: false,
    onMutate: () => setStatus(""),
    onSuccess: ({ blob, filename }) => {
      saveBlob({ blob, filename });
      setStatus(`Report downloaded: ${filename}`);
    },
  });

  const previewReport = useMutation({
    mutationFn: async () => {
      // Preview always reads the CSV structure, regardless of the selected
      // download format, since it is the one text-based, parseable format.
      const query = buildQuery("csv");
      const { blob } = await download(
        `/reports/${report.kind}?${query}`,
        undefined,
        {
          accept: FORMATS.csv.accept,
          fallbackName: `${report.kind}.csv`,
        },
      );
      return parseReportCsv(await blob.text());
    },
    retry: false,
    onMutate: () => setStatus(""),
    onSuccess: (parsed) => setPreview(parsed),
  });

  function validateFilters(): boolean {
    if (!filters.categoryScheme) {
      setValidation(
        "Choose a category scheme before previewing or downloading.",
      );
      return false;
    }
    if (!validAcademicYear(filters.year.trim())) {
      setValidation("Enter a consecutive academic year, for example 2026-27.");
      return false;
    }
    setValidation("");
    return true;
  }

  function submit() {
    if (!validateFilters()) return;
    exportReport.mutate();
  }

  return (
    <section
      className="panel dashboard-panel report-card"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{report.title}</h2>
      <p>{report.description}</p>
      <p className="data-note">
        Reservation category exports show PwD overlapping primary categories; do
        not sum groups as headcount. Unknown legacy classifications are
        unavailable.
      </p>
      <p className="form-help">
        Choose a category scheme and academic year to preview or download.
      </p>
      <form
        className="dashboard-filters"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label>
          Category scheme
          <select
            value={filters.categoryScheme}
            onChange={(e) => set("categoryScheme", e.target.value)}
            aria-required="true"
          >
            <option value="">Choose category scheme</option>
            <option value="RESERVATION">Reservation categories</option>
            <option value="LEGACY">Legacy admission categories</option>
          </select>
        </label>
        <label>
          Academic year
          <input
            value={filters.year}
            onChange={(e) => set("year", e.target.value)}
            placeholder="2026-27"
            aria-required="true"
          />
        </label>
        {!fixedInstitution && (
          <InstitutionSelect
            institutions={institutions}
            value={filters.institution}
            onChange={(value) => set("institution", value)}
          />
        )}
        <RegionSelect
          regions={regions}
          value={filters.region}
          onChange={(value) => set("region", value)}
        />
        <label>
          Programme code
          <input
            value={filters.programme}
            maxLength={40}
            onChange={(e) => set("programme", e.target.value)}
            placeholder="Optional"
          />
        </label>
        {report.cases && (
          <>
            <EnumSelect
              label="Priority"
              values={CASE_PRIORITIES}
              value={filters.priority}
              onChange={(value) => set("priority", value)}
              allLabel="Any priority"
            />
            <EnumSelect
              label="Severity"
              values={CASE_SEVERITIES}
              value={filters.severity}
              onChange={(value) => set("severity", value)}
              allLabel="Any severity"
            />
          </>
        )}
        <label>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
          >
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          type="button"
          disabled={previewReport.isPending}
          aria-describedby={`${id}-status`}
          onClick={() => {
            if (validateFilters()) previewReport.mutate();
          }}
        >
          {previewReport.isPending ? "Loading preview…" : "Preview report"}
        </button>
        <button
          className="button"
          type="submit"
          disabled={exportReport.isPending}
          aria-describedby={`${id}-status`}
        >
          {exportReport.isPending ? "Preparing…" : "Download report"}
        </button>
      </form>
      {validation && (
        <p className="form-error" role="alert">
          {validation}
        </p>
      )}
      {exportReport.isError && (
        <p className="form-error" role="alert">
          {errorMessage(exportReport.error)}
          {exportReport.error instanceof ApiError &&
            exportReport.error.requestId &&
            ` Request reference: ${exportReport.error.requestId}`}
        </p>
      )}
      {previewReport.isError && (
        <p className="form-error" role="alert">
          Preview could not be loaded. {errorMessage(previewReport.error)}
        </p>
      )}
      <p id={`${id}-status`} aria-live="polite" className="data-note">
        {exportReport.isPending
          ? "Preparing report…"
          : previewReport.isPending
            ? "Loading preview…"
            : status}
      </p>
      {preview && (
        <div className="report-preview">
          <p className="data-note">
            Preview of the report data (CSV structure). The downloaded file will
            match this content in your selected format.
          </p>
          <div className="metadata-grid report-preview-meta">
            {preview.metadata.map(([key, value]) => (
              <div className="metadata-item" key={key}>
                <span className="tiny-label">{key}</span>
                <strong>{value || "—"}</strong>
              </div>
            ))}
          </div>
          {preview.tables.map((table) => (
            <div key={table.title} className="report-preview-table">
              <h3>{table.title}</h3>
              {table.rows.length === 0 ? (
                <p className="data-note">No data.</p>
              ) : (
                <DashboardTable label={table.title}>
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th scope="col" key={column}>
                          {column.replaceAll("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </DashboardTable>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ReportCenter() {
  const { session } = useSession();
  const search = useSearchParams();
  const role = session?.user.role;
  const fixedInstitution = role === "INSTITUTION_ADMIN";
  const institutions = useInstitutionOptions(!!session && !fixedInstitution);
  if (!role) return null;
  const list = institutions.data?.data ?? [];
  const regions = regionsOf(list);
  const year = search.get("academic_year") ?? "";
  const institution = search.get("institution_id") ?? "";
  const categoryScheme = search.get("category_scheme");
  const initial: Filters = {
    ...EMPTY,
    categoryScheme:
      categoryScheme === "LEGACY" || categoryScheme === "RESERVATION"
        ? categoryScheme
        : "",
    year: validAcademicYear(year) ? year : "",
    institution: list.some((i) => i.id === institution) ? institution : "",
    region: regions.includes(search.get("region") ?? "")
      ? (search.get("region") ?? "")
      : "",
  };
  const available = REPORTS.filter((r) => r.roles.includes(role));

  return (
    <div className="dashboard-page report-page">
      <header className="page-heading">
        <p className="eyebrow">REPORTS</p>
        <h1>Reports</h1>
        <p>
          Download aggregate reports as CSV, Excel or PDF. Report totals
          reconcile with the analytics views for the same filters. Every report
          is labelled <strong>{DEMO_TAG}</strong>: all records are synthetic.
          {fixedInstitution && " Reports are limited to your institution."}
          {role === "AICTE_MANAGER" &&
            " As manager, you see coverage and trend reports only; case-by-case detail (resolution times, validation findings) is an officer function."}
        </p>
      </header>
      {institutions.isError && (
        <p className="form-error" role="alert">
          Institution and region options could not be loaded.
        </p>
      )}
      {available.map((report) => (
        <ReportCard
          // Remount once options load so query-param prefill can apply.
          key={`${report.kind}-${list.length}`}
          report={report}
          institutions={list}
          regions={regions}
          fixedInstitution={fixedInstitution}
          initial={initial}
        />
      ))}
    </div>
  );
}
