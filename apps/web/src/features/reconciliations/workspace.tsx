"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState, ErrorPanel, Loading } from "@/components/ui/feedback";
import { FormFeedback } from "@/components/ui/feedback";
import { useSession } from "@/features/auth/session";
import { useApiQuery, useScope } from "@/lib/api/hooks";
import { errorMessage, isUUID, jsonInit } from "@/lib/api/client";
import type { components } from "@/lib/api/generated";

type Reconciliation = components["schemas"]["ReconciliationResponse"];
type ReconciliationPage = components["schemas"]["Page_ReconciliationResponse_"];
type Evidence = components["schemas"]["ReconciliationEvidence"];
type Action = components["schemas"]["ReconciliationActionRequest"];
type Assignee = components["schemas"]["AssigneeResponse"];

const statusCopy: Record<Reconciliation["status"], string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  AWAITING_INSTITUTION: "Awaiting institution",
  TRANSFER_SUPPORTED: "Transfer supported",
  UNRESOLVED_OVERLAP: "Overlap unresolved",
  DISMISSED: "Match dismissed",
};

const actionCopy: Record<Reconciliation["events"][number]["action"], string> = {
  OPENED: "Review opened",
  ASSIGN: "Assigned to an officer",
  START_REVIEW: "Review started",
  REQUEST_EVIDENCE: "Evidence requested",
  TRANSFER_EVIDENCE_SUBMITTED: "Institution submitted transfer evidence",
  DECIDE_TRANSFER: "Transfer outcome recorded",
  DECIDE_OVERLAP: "Overlap outcome recorded",
  DISMISS: "Potential match dismissed",
};

export function ReconciliationQueue() {
  const { session } = useSession();
  const officer = session?.user.role === "AICTE_OFFICER";
  const scope = useScope("reconciliations");
  const query = useApiQuery<ReconciliationPage>(scope, "/reconciliations");

  return (
    <div className="reconciliation-page">
      <div className="page-heading">
        <p className="eyebrow">TRANSFER-AWARE REVIEW</p>
        <h1>
          {officer
            ? "Cross-institution reconciliation"
            : "Reconciliation requests"}
        </h1>
        <p>
          {officer
            ? "Review current potential matches across institutions. A match is a review lead, never a fraud determination."
            : "Respond to requests about your institution’s records. Peer institution and student details remain restricted."}
        </p>
      </div>
      <section className="panel" aria-labelledby="reconciliation-queue-title">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">REVIEW QUEUE</p>
            <h2 id="reconciliation-queue-title">
              {officer
                ? "Potential matches"
                : "Requests involving your institution"}
            </h2>
          </div>
          {query.data && (
            <span className="quiet-label">
              {query.data.pagination.total} review
              {query.data.pagination.total === 1 ? "" : "s"}
            </span>
          )}
        </header>
        {query.isPending ? (
          <Loading label="Loading reconciliation reviews…" />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : query.data.data.length === 0 ? (
          <EmptyState title="No reconciliation reviews yet">
            Officers open a review from a fresh cross-institution match in the
            validation findings.
          </EmptyState>
        ) : (
          <ol className="reconciliation-list">
            {query.data.data.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/reconciliations/${item.id}`}
                  className="reconciliation-list-link"
                >
                  <span>
                    <strong>{statusCopy[item.status]}</strong>
                    <small>
                      {item.records
                        .map((record) =>
                          officer
                            ? record.institution_name
                            : record.college_student_id,
                        )
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="quiet-label">
                    {item.evidence_requested_for_you
                      ? "Response requested"
                      : "Open review"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function ReconciliationDetail({
  reconciliationId,
}: {
  reconciliationId: string;
}) {
  const { session, request } = useSession();
  const officer = session?.user.role === "AICTE_OFFICER";
  const detailScope = useScope("reconciliations", reconciliationId);
  const listScope = useScope("reconciliations");
  const query = useApiQuery<Reconciliation>(
    detailScope,
    isUUID(reconciliationId) ? `/reconciliations/${reconciliationId}` : null,
  );
  const assignees = useApiQuery<Assignee[]>(
    useScope("reconciliations", "assignees"),
    officer ? "/cases/assignees" : null,
  );
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [evidenceType, setEvidenceType] =
    useState<Evidence["evidence_type"]>("TRANSFER_RECORD");
  const [comment, setComment] = useState("");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [withdrawalDate, setWithdrawalDate] = useState("");
  const [requestedInstitution, setRequestedInstitution] = useState("");
  const [assignee, setAssignee] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [officerAction, setOfficerAction] = useState<Action["action"] | null>(
    null,
  );

  const saveEvidence = useMutation({
    mutationFn: (body: Evidence) =>
      request<Reconciliation>(
        `/reconciliations/${reconciliationId}/evidence`,
        jsonInit("POST", body),
      ),
    retry: false,
  });
  const saveAction = useMutation({
    mutationFn: (body: Action) =>
      request<Reconciliation>(
        `/reconciliations/${reconciliationId}/actions`,
        jsonInit("POST", body),
      ),
    retry: false,
  });
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailScope }),
      queryClient.invalidateQueries({ queryKey: listScope }),
    ]);
  }
  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    const body: Evidence = {
      evidence_type: evidenceType,
      comment,
      transfer_date: evidenceType === "TRANSFER_RECORD" ? transferDate : null,
      withdrawal_date:
        evidenceType === "WITHDRAWAL_RECORD" ? withdrawalDate : null,
      evidence_reference: reference || null,
    };
    try {
      const result = await saveEvidence.mutateAsync(body);
      setNotice("Evidence note saved. An officer can continue the review.");
      setComment("");
      setReference("");
      setTransferDate("");
      setWithdrawalDate("");
      await refresh();
      if (result.status !== "UNDER_REVIEW")
        setError("The review status changed while this was being saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = officerAction ?? suggestedAction;
    const body: Action = { action };
    if (action === "ASSIGN") body.assigned_to = assignee;
    if (action === "REQUEST_EVIDENCE")
      body.institution_id = requestedInstitution;
    if (["DECIDE_TRANSFER", "DECIDE_OVERLAP", "DISMISS"].includes(action))
      body.reason = decisionReason;
    setNotice("");
    setError("");
    try {
      await saveAction.mutateAsync(body);
      setNotice("Reconciliation update recorded in its review history.");
      setDecisionReason("");
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (!isUUID(reconciliationId))
    return (
      <EmptyState title="Reconciliation unavailable">
        Open a review from the reconciliation queue.
      </EmptyState>
    );
  if (query.isPending) return <Loading label="Loading reconciliation…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data;
  const hasTransfer = item.events.some(
    (entry) => entry.evidence_type === "TRANSFER_RECORD",
  );
  const isClosed = [
    "TRANSFER_SUPPORTED",
    "UNRESOLVED_OVERLAP",
    "DISMISSED",
  ].includes(item.status);
  const suggestedAction: Action["action"] =
    item.status === "OPEN"
      ? "START_REVIEW"
      : item.status === "UNDER_REVIEW"
        ? "REQUEST_EVIDENCE"
        : "ASSIGN";
  const selectedAction = officerAction ?? suggestedAction;

  return (
    <div className="reconciliation-page">
      <div className="page-heading heading-actions">
        <div>
          <p className="eyebrow">CROSS-INSTITUTION REVIEW</p>
          <h1>
            Potential match{" "}
            <span
              className={`status-badge ${isClosed ? "neutral" : "warning"}`}
            >
              {statusCopy[item.status]}
            </span>
          </h1>
          <p>
            Local matching only. A transfer or withdrawal may explain an
            overlap; officers make the final review decision.
          </p>
        </div>
        <Link className="button secondary" href="/reconciliations">
          Back to queue
        </Link>
      </div>

      <section
        className="validation-notice"
        aria-label="Reconciliation privacy and status"
      >
        <strong>Potential match, not a fraud finding</strong>
        <p>
          APAAR values stay masked. Institution accounts see only their own
          record and evidence. The review outcome does not rewrite the original
          validation finding.
        </p>
      </section>

      <section className="panel" aria-labelledby="matched-records-title">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">LINKED IMMUTABLE RECORDS</p>
            <h2 id="matched-records-title">Match evidence</h2>
          </div>
          <span className="quiet-label">{item.records[0]?.academic_year}</span>
        </header>
        <div className="reconciliation-records">
          {item.records.map((record) => (
            <article
              className="reconciliation-record"
              key={record.record_version_id}
            >
              <p className="eyebrow">{record.institution_name}</p>
              <h3>
                {record.college_student_id || "Institution ID unavailable"}
              </h3>
              <dl>
                <div>
                  <dt>APAAR</dt>
                  <dd className="masked-value">{record.apaar_id_masked}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{record.enrollment_status}</dd>
                </div>
                <div>
                  <dt>Admission date</dt>
                  <dd>{record.enrollment_date ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Academic year</dt>
                  <dd>{record.academic_year}</dd>
                </div>
              </dl>
            </article>
          ))}
          {item.records.length === 1 && (
            <p className="quiet-label">
              The other participant’s record details are restricted to
              authorized officers.
            </p>
          )}
        </div>
        {item.resolution_reason && (
          <p className="form-help">
            <strong>Officer outcome rationale:</strong> {item.resolution_reason}
          </p>
        )}
      </section>

      {item.evidence_requested_for_you && !officer && (
        <section className="panel" aria-labelledby="evidence-form-title">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">INSTITUTION RESPONSE</p>
              <h2 id="evidence-form-title">
                Provide transfer or withdrawal details
              </h2>
            </div>
          </header>
          <p className="form-help">
            Enter a short note and the relevant date. This prototype accepts a
            reference label only; it does not upload documents.
          </p>
          <form
            className="case-form reconciliation-form"
            onSubmit={submitEvidence}
          >
            <label>
              Evidence type
              <select
                value={evidenceType}
                onChange={(event) =>
                  setEvidenceType(
                    event.target.value as Evidence["evidence_type"],
                  )
                }
              >
                <option value="TRANSFER_RECORD">Transfer record</option>
                <option value="WITHDRAWAL_RECORD">Withdrawal record</option>
                <option value="OTHER">Other supporting context</option>
              </select>
            </label>
            {evidenceType === "TRANSFER_RECORD" && (
              <label>
                Transfer date
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(event) => setTransferDate(event.target.value)}
                />
              </label>
            )}
            {evidenceType === "WITHDRAWAL_RECORD" && (
              <label>
                Withdrawal date
                <input
                  type="date"
                  required
                  value={withdrawalDate}
                  onChange={(event) => setWithdrawalDate(event.target.value)}
                />
              </label>
            )}
            <label>
              Evidence note
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <label>
              Reference label (optional)
              <input
                maxLength={120}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={saveEvidence.isPending}
            >
              {saveEvidence.isPending
                ? "Saving evidence…"
                : "Submit evidence note"}
            </button>
          </form>
        </section>
      )}

      {officer && !isClosed && (
        <section className="panel" aria-labelledby="officer-action-title">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">OFFICER CONTROLS</p>
              <h2 id="officer-action-title">Advance the review</h2>
            </div>
          </header>
          <form
            className="case-form reconciliation-form"
            onSubmit={submitAction}
          >
            <label>
              Action
              <select
                value={selectedAction}
                onChange={(event) =>
                  setOfficerAction(event.target.value as Action["action"])
                }
              >
                {item.status === "OPEN" && (
                  <option value="START_REVIEW">Start review</option>
                )}
                {item.status === "UNDER_REVIEW" && (
                  <>
                    <option value="REQUEST_EVIDENCE">
                      Request institution evidence
                    </option>
                    <option value="DECIDE_TRANSFER" disabled={!hasTransfer}>
                      Record transfer supported
                    </option>
                    <option value="DECIDE_OVERLAP">
                      Record unresolved overlap
                    </option>
                    <option value="DISMISS">Dismiss potential match</option>
                  </>
                )}
                <option value="ASSIGN">Assign reviewer</option>
              </select>
            </label>
            {selectedAction === "ASSIGN" && (
              <label>
                Assign to
                <select
                  required
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">Select an officer</option>
                  {(assignees.data ?? []).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedAction === "REQUEST_EVIDENCE" && (
              <label>
                Request evidence from
                <select
                  required
                  value={requestedInstitution}
                  onChange={(event) =>
                    setRequestedInstitution(event.target.value)
                  }
                >
                  <option value="">Select an institution</option>
                  {item.records.map((record) => (
                    <option
                      key={record.institution_id}
                      value={record.institution_id}
                    >
                      {record.institution_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["DECIDE_TRANSFER", "DECIDE_OVERLAP", "DISMISS"].includes(
              selectedAction,
            ) && (
              <label>
                Decision rationale
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  placeholder="Required for transfer, overlap, or dismissal outcomes"
                />
              </label>
            )}
            <p className="form-help">
              A transfer outcome requires a submitted transfer record. Each
              officer decision is saved with its rationale; “overlap unresolved”
              is not a fraud determination.
            </p>
            <button
              className="button primary"
              disabled={saveAction.isPending || assignees.isError}
            >
              {saveAction.isPending ? "Recording action…" : "Record action"}
            </button>
            {assignees.isError && (
              <p className="form-error" role="alert">
                Officer list is unavailable. Retry the page before assigning.
              </p>
            )}
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="reconciliation-history-title">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">APPEND-ONLY HISTORY</p>
            <h2 id="reconciliation-history-title">Review timeline</h2>
          </div>
        </header>
        {item.events.length === 0 ? (
          <EmptyState title="No timeline events" />
        ) : (
          <ol className="case-timeline reconciliation-timeline">
            {item.events.map((entry) => (
              <li key={entry.id}>
                <header>
                  <strong>{actionCopy[entry.action]}</strong>
                  <time>{new Date(entry.created_at).toLocaleString()}</time>
                </header>
                {entry.comment && <p>{entry.comment}</p>}
                {entry.evidence_type && (
                  <dl className="reconciliation-event-facts">
                    <div>
                      <dt>Evidence</dt>
                      <dd>{entry.evidence_type.replaceAll("_", " ")}</dd>
                    </div>
                    {entry.transfer_date && (
                      <div>
                        <dt>Transfer date</dt>
                        <dd>{entry.transfer_date}</dd>
                      </div>
                    )}
                    {entry.withdrawal_date && (
                      <div>
                        <dt>Withdrawal date</dt>
                        <dd>{entry.withdrawal_date}</dd>
                      </div>
                    )}
                    {entry.evidence_reference && (
                      <div>
                        <dt>Reference</dt>
                        <dd>{entry.evidence_reference}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <FormFeedback notice={notice} error={error} />
    </div>
  );
}
