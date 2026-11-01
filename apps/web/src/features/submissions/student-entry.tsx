type Category = "GENERAL_OPEN" | "SC_ST" | "NT" | "OBC";
type EnrolmentStatus = "ACTIVE" | "WITHDRAWN" | "TRANSFERRED" | "COMPLETED";

export type StudentDraft = {
  college_student_id: string;
  student_name: string;
  apaar_id: string;
  reservation_category: Category;
  is_pwd: boolean;
  enrollment_status: EnrolmentStatus;
  enrollment_date: string;
};

const headers = [
  "college_student_id",
  "student_name",
  "apaar_id",
  "academic_year",
  "programme_code",
  "reservation_category",
  "is_pwd",
  "enrollment_status",
  "enrollment_date",
] as const;

export function blankStudent(): StudentDraft {
  return {
    college_student_id: "",
    student_name: "",
    apaar_id: "",
    reservation_category: "GENERAL_OPEN",
    is_pwd: false,
    enrollment_status: "ACTIVE",
    enrollment_date: "",
  };
}

/** Fictional fixtures only; never sent to an external identity provider. */
export function sampleStudents(
  year: string,
  withFindings = false,
): StudentDraft[] {
  const start = /^[0-9]{4}-[0-9]{2}$/.test(year) ? year.slice(0, 4) : "2026";
  return [
    {
      college_student_id: "DEMO-STUDENT-001",
      student_name: "Synthetic Learner One",
      apaar_id: "900000000001",
      reservation_category: "GENERAL_OPEN",
      is_pwd: false,
      enrollment_status: "ACTIVE",
      enrollment_date: `${start}-07-01`,
    },
    {
      college_student_id: "DEMO-STUDENT-002",
      student_name: "Synthetic Learner Two",
      apaar_id: withFindings ? "DEMO-INVALID" : "900000000002",
      reservation_category: "OBC",
      is_pwd: true,
      enrollment_status: "ACTIVE",
      enrollment_date: `${start}-07-02`,
    },
    {
      college_student_id: "DEMO-STUDENT-003",
      student_name: withFindings ? "" : "Synthetic Learner Three",
      apaar_id: "900000000003",
      reservation_category: "SC_ST",
      is_pwd: false,
      enrollment_status: "WITHDRAWN",
      enrollment_date: `${start}-07-03`,
    },
  ];
}

/** Preserve entered text; quote every cell so commas, quotes and newlines round-trip. */
export function studentCSV(
  rows: readonly StudentDraft[],
  year: string,
  programmeCode: string,
  requiredHeaders: readonly string[],
): string {
  if (
    requiredHeaders.length !== headers.length ||
    requiredHeaders.some((h, i) => h !== headers[i])
  ) {
    throw new Error(
      "Direct entry is unavailable for this upload schema. Reload the upload policy or use its file template.",
    );
  }
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return (
    headers.join(",") +
    "\r\n" +
    rows
      .map((row) => {
        const values = {
          ...row,
          academic_year: year,
          programme_code: programmeCode,
          reservation_category: row.reservation_category,
          is_pwd: row.is_pwd ? "YES" : "NO",
        };
        return headers.map((key) => quote(values[key])).join(",");
      })
      .join("\r\n") +
    "\r\n"
  );
}

export function StudentEntry({
  rows,
  onChange,
  maxRows,
  year,
}: {
  rows: StudentDraft[];
  onChange: (rows: StudentDraft[]) => void;
  maxRows: number;
  year: string;
}) {
  const change = <K extends keyof StudentDraft>(
    index: number,
    key: K,
    value: StudentDraft[K],
  ) =>
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );

  return (
    <section className="student-entry" aria-labelledby="student-entry-title">
      <div className="student-entry-heading">
        <div>
          <h3 id="student-entry-title">Enter student records</h3>
          <p className="form-help">
            Programme and academic year above apply to every row. Drafts stay in
            this tab until you save.
          </p>
        </div>
        <span className="status-badge neutral">
          {rows.length} / {maxRows} records
        </span>
      </div>
      <details className="student-sample-picker">
        <summary>Start with synthetic examples</summary>
        <p className="form-help">
          These actions replace the entered rows. Samples illustrate the format;
          intake and duplicate findings depend on existing data and configured
          demo rules.
        </p>
        <div className="outcome-actions">
          <button
            type="button"
            className="button secondary small"
            disabled={maxRows < 3}
            onClick={() => onChange(sampleStudents(year))}
          >
            Fill sample records
          </button>
          <button
            type="button"
            className="button secondary small"
            disabled={maxRows < 3}
            onClick={() => onChange(sampleStudents(year, true))}
          >
            Fill example with issues
          </button>
        </div>
      </details>
      {rows.map((row, index) => (
        <fieldset className="student-entry-record" key={index}>
          <legend>Student {index + 1}</legend>
          <div className="student-entry-fields">
            <label>
              Institution student ID
              <input
                value={row.college_student_id}
                onChange={(e) =>
                  change(index, "college_student_id", e.target.value)
                }
                autoComplete="off"
                placeholder="DEMO-STUDENT-001"
              />
            </label>
            <label>
              Student name
              <input
                value={row.student_name}
                onChange={(e) => change(index, "student_name", e.target.value)}
                autoComplete="off"
                placeholder="Synthetic Learner One"
              />
            </label>
            <label>
              APAAR (synthetic only)
              <input
                type="password"
                value={row.apaar_id}
                onChange={(e) => change(index, "apaar_id", e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="manual-apaar-help"
              />
            </label>
            <label>
              Enrolment date
              <input
                type="date"
                value={row.enrollment_date}
                onChange={(e) =>
                  change(index, "enrollment_date", e.target.value)
                }
              />
            </label>
            <label>
              Admission category
              <select
                value={row.reservation_category}
                onChange={(e) =>
                  change(
                    index,
                    "reservation_category",
                    e.target.value as Category,
                  )
                }
              >
                <option value="GENERAL_OPEN">General/Open</option>
                <option value="SC_ST">SC/ST</option>
                <option value="NT">NT</option>
                <option value="OBC">OBC</option>
              </select>
            </label>
            <label>
              PwD
              <select
                value={row.is_pwd ? "YES" : "NO"}
                onChange={(e) =>
                  change(index, "is_pwd", e.target.value === "YES")
                }
              >
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </label>
            <label>
              Enrolment status
              <select
                value={row.enrollment_status}
                onChange={(e) =>
                  change(
                    index,
                    "enrollment_status",
                    e.target.value as EnrolmentStatus,
                  )
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="button secondary small"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label={`Remove student ${index + 1}`}
          >
            Remove student
          </button>
        </fieldset>
      ))}
      <p id="manual-apaar-help" className="form-help">
        APAAR is masked while editing. Saving stores the candidate; local format
        and admission-rule checks run only when you select Validate afterward.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={rows.length >= maxRows}
        onClick={() => onChange([...rows, blankStudent()])}
      >
        Add another student
      </button>
    </section>
  );
}
