"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession, type Role } from "@/features/auth/session";
import { AcademicYearSelect } from "@/components/academic-year-select";
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
import { Loading } from "@/components/ui/feedback";
import { parseReportCsv, type ParsedReport } from "./parse-csv";

type Format = "csv" | "xlsx" | "pdf";
type Kind =
  | "enrolment-summary"
  | "intake-utilisation"
  | "submission-completeness"
  | "resolution-times"
  | "validation-findings"
  | "open-cases"
  | "verification-activity"
  | "consolidated-overview";
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
    description:
      "Aggregate active-record and category counts by academic year and programme.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "intake-utilisation",
    title: "Intake utilisation",
    description:
      "Compare declared enrolment with configured intake capacity by programme.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "submission-completeness",
    title: "Submission completeness",
    description:
      "Review aggregate submission coverage and current snapshot completeness.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"],
  },
  {
    kind: "consolidated-overview",
    title: "Complete monitoring report",
    description:
      "All six monitoring insights in one consolidated CSV, Excel or PDF report.",
    roles: ["INSTITUTION_ADMIN", "AICTE_OFFICER"],
    cases: true,
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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const id = `report-${report.kind}`;
  useEffect(
    () => () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    },
    [pdfPreviewUrl],
  );
  const set = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPreview(null);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
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
  const previewPdf = useMutation({
    mutationFn: async () => {
      const query = buildQuery("pdf");
      const { blob } = await download(`/reports/${report.kind}?${query}`, undefined, {
        accept: FORMATS.pdf.accept,
        fallbackName: `${report.kind}.pdf`,
      });
      return blob;
    },
    retry: false,
    onSuccess: (blob) => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
    },
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
          <AcademicYearSelect
            value={filters.year}
            onChange={(year) => set("year", year)}
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
          className="button secondary"
          type="button"
          disabled={previewPdf.isPending}
          aria-describedby={`${id}-status`}
          onClick={() => {
            if (validateFilters()) previewPdf.mutate();
          }}
        >
          {previewPdf.isPending ? "Loading PDF…" : "Preview PDF"}
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
      {previewPdf.isError && (
        <p className="form-error" role="alert">
          PDF preview could not be loaded. {errorMessage(previewPdf.error)}
        </p>
      )}
      <p id={`${id}-status`} aria-live="polite" className="data-note">
        {exportReport.isPending
          ? "Preparing report…"
          : previewReport.isPending
            ? "Loading preview…"
            : status}
      </p>
      {pdfPreviewUrl && (
        <div className="report-pdf-preview">
          <h3>PDF preview</h3>
          <iframe
            title={`${report.title} PDF preview`}
            src={pdfPreviewUrl}
            loading="lazy"
          />
        </div>
      )}
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
  const [selectedReport, setSelectedReport] =
    useState<Kind>("enrolment-summary");
  const role = session?.user.role;
  // Normalize the serialized role before applying report capabilities. This
  // prevents a harmless casing/whitespace difference at a deployment boundary
  // from making the page silently render no report cards.
  const roleKey = typeof role === "string" ? role.trim().toUpperCase() : "";
  const fixedInstitution = roleKey === "INSTITUTION_ADMIN";
  const institutions = useInstitutionOptions(!!session && !fixedInstitution);
  if (!roleKey) return null;
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
  const available = REPORTS.filter((r) => r.roles.includes(roleKey as Role));
  // Keep the selected value aligned with the reports allowed for the current
  // role. The default state is intentionally generic, so without this fallback
  // an officer/manager could see the page shell and dropdown but no report card.
  const selected =
    available.find((report) => report.kind === selectedReport) ?? available[0];

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
          {roleKey === "AICTE_MANAGER" &&
            " As manager, you see coverage and trend reports only; case-by-case detail (resolution times, validation findings) is an officer function."}
        </p>
      </header>
      {institutions.isError && (
        <p className="form-error" role="alert">
          Institution and region options could not be loaded.
        </p>
      )}
      {!fixedInstitution && institutions.isPending ? (
        <Loading label="Loading report filters…" />
      ) : available.length > 0 ? (
        <>
          <label>
            Report type
            <select
              value={selectedReport}
              onChange={(event) =>
                setSelectedReport(event.target.value as Kind)
              }
            >
              {available.map((report) => (
                <option key={report.kind} value={report.kind}>
                  {report.title}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <ReportCard
              key={selected.kind}
              report={selected}
              institutions={list}
              regions={regions}
              fixedInstitution={fixedInstitution}
              initial={initial}
            />
          )}
        </>
      ) : (
        <section className="empty-state" aria-live="polite">
          <h2>Reports unavailable for this role</h2>
          <p>
            No report definitions are available for the current workspace.
            Refresh after confirming the session role with the API.
          </p>
        </section>
      )}
    </div>
  );
}
