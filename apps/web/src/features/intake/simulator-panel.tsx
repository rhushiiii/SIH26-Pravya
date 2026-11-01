"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session";
import {
  useSubmissionContext,
  validAcademicYear,
} from "@/features/submissions/data";
import { jsonInit } from "@/lib/api/client";
import type { components } from "@/lib/api/generated";
import {
  CATEGORIES,
  DEFAULT_YEAR,
  DemoRuleNotice,
  ScrollTable,
  categoryLabel,
  intakeMessage,
  type Category,
} from "./shared";

type Simulation = components["schemas"]["SimulationResponse"];
type Line = {
  category: string;
  approved_seats: number | null;
  rule_version: string | null;
  before_active_count: number;
  added_count: number;
  after_active_count: number;
  remaining_capacity: number | null;
  would_exceed: boolean;
  excess: number;
  calculation: string;
};
type Row = { id: number; category: Category; count: string };

export function SimulatorPanel({ institutionId }: { institutionId: string }) {
  const { request } = useSession();
  const { options } = useSubmissionContext(institutionId);
  const [programmeId, setProgrammeId] = useState("");
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [rows, setRows] = useState<Row[]>([
    { id: 1, category: "GENERAL_OPEN", count: "" },
  ]);
  const [pwdCount, setPwdCount] = useState("");
  const [nextId, setNextId] = useState(2);
  const [error, setError] = useState("");
  const run = useMutation({
    mutationFn: (body: {
      programme_id: string;
      academic_year: string;
      additions: { category: Category; count: number }[];
      category_scheme: "RESERVATION";
      pwd_additions: number;
    }) =>
      request<Simulation>(
        `/institutions/${institutionId}/intake/simulate`,
        jsonInit("POST", body),
      ),
    onError: (e) => setError(intakeMessage(e)),
  });
  const update = (id: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...change } : r)),
    );
  const lines = (run.data?.categories ?? []) as unknown as Line[];
  return (
    <section
      className="panel"
      aria-labelledby="simulator-title"
      aria-busy={run.isPending}
    >
      <header className="panel-heading">
        <div>
          <p className="eyebrow">WHAT-IF · DEMO RULES</p>
          <h2 id="simulator-title">What-if simulator</h2>
        </div>
        <span className="quiet-label">Simulation only</span>
      </header>
      <div className="panel-padding">
        <DemoRuleNotice />
        <p className="form-help">
          Simulation only — no data was changed. Enter hypothetical additions to
          see them against the current snapshot and the DEMO rules.
        </p>
        <form
          className="intake-sim-form"
          onSubmit={(e) => {
            e.preventDefault();
            const additions = rows.map((r) => ({
              category: r.category,
              count: Number(r.count),
            }));
            if (!programmeId) return setError("Choose a programme.");
            if (!validAcademicYear(year))
              return setError("Use an academic year such as 2026-27.");
            if (
              rows.some(
                (r) =>
                  !/^\d+$/.test(r.count) ||
                  Number(r.count) < 1 ||
                  Number(r.count) > 1_000_000,
              )
            )
              return setError(
                "Each addition needs a whole number count of at least 1.",
              );
            if (
              pwdCount !== "" &&
              (!/^\\d+$/.test(pwdCount) || Number(pwdCount) > 1_000_000)
            )
              return setError(
                "PwD additions must be a whole number from 0 to 1,000,000.",
              );
            const totalMain = additions.reduce(
              (total, row) => total + row.count,
              0,
            );
            if (Number(pwdCount || 0) > totalMain)
              return setError(
                "PwD additions cannot exceed the total main-category additions.",
              );
            setError("");
            run.mutate({
              programme_id: programmeId,
              academic_year: year,
              additions,
              category_scheme: "RESERVATION",
              pwd_additions: Number(pwdCount || 0),
            });
          }}
        >
          <div className="validation-filters">
            <label>
              Programme
              <select
                value={programmeId}
                onChange={(e) => setProgrammeId(e.target.value)}
              >
                <option value="">Choose programme</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Academic year
              <input value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          </div>
          <fieldset className="intake-additions">
            <legend>Hypothetical main-category additions</legend>
            {rows.map((row, index) => (
              <div className="validation-filters" key={row.id}>
                <label>
                  Category
                  <select
                    value={row.category}
                    onChange={(e) =>
                      update(row.id, { category: e.target.value as Category })
                    }
                  >
                    {CATEGORIES.filter((c) => c !== "PWD").map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Count
                  <input
                    inputMode="numeric"
                    value={row.count}
                    onChange={(e) => update(row.id, { count: e.target.value })}
                  />
                </label>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() =>
                      setRows((c) => c.filter((r) => r.id !== row.id))
                    }
                  >
                    Remove<span className="sr-only"> addition {index + 1}</span>
                  </button>
                )}
              </div>
            ))}
            <div className="button-row">
              <button
                type="button"
                className="button secondary small"
                disabled={rows.length >= 20}
                onClick={() => {
                  setRows((c) => [
                    ...c,
                    { id: nextId, category: "GENERAL_OPEN", count: "" },
                  ]);
                  setNextId(nextId + 1);
                }}
              >
                Add row
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={run.isPending}
              >
                {run.isPending ? "Simulating…" : "Run simulation"}
              </button>
            </div>
            <label>
              Additional PwD records (overlapping count)
              <input
                inputMode="numeric"
                value={pwdCount}
                onChange={(e) => setPwdCount(e.target.value)}
              />
            </label>
            <p className="form-help">
              PwD is reported as an overlapping count and is not added as a
              separate reservation category. It cannot exceed the total
              main-category additions.
            </p>
          </fieldset>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {run.data && (
        <div className="panel-padding" aria-live="polite">
          <h3>Simulation result</h3>
          <p className="form-help">
            Simulation only — no data was changed. Rule version{" "}
            {run.data.rule_version} · {run.data.source_label}.{" "}
            {run.data.has_current_snapshot
              ? "“Before” counts are ACTIVE records in the current snapshot."
              : "No current snapshot exists, so “before” counts are 0."}
          </p>
          <ScrollTable label="Simulated ACTIVE records against DEMO approved seats by category">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Before</th>
                <th scope="col">Added</th>
                <th scope="col">After</th>
                <th scope="col">Approved</th>
                <th scope="col">Remaining</th>
                <th scope="col">Outcome</th>
                <th scope="col">Calculation</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.category}>
                  <td>{categoryLabel(l.category)}</td>
                  <td>{l.before_active_count}</td>
                  <td>{l.added_count}</td>
                  <td>{l.after_active_count}</td>
                  <td>{l.approved_seats ?? "No rule"}</td>
                  <td>{l.remaining_capacity ?? "—"}</td>
                  <td>
                    {l.approved_seats === null ? (
                      <span className="status-badge neutral">
                        No conclusion
                      </span>
                    ) : l.would_exceed ? (
                      <span className="status-badge warning">
                        Would exceed by {l.excess}
                      </span>
                    ) : (
                      <span className="status-badge active">
                        Within capacity
                      </span>
                    )}
                  </td>
                  <td>
                    <code>{l.calculation}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
          <p className="data-note">{run.data.notice}</p>
          <p className="form-help">
            The PwD reporting row overlaps the four main categories and is
            excluded from their sum.
          </p>
        </div>
      )}
    </section>
  );
}
