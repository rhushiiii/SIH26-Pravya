"use client";

import { Protected } from "@/components/app-shell";
import { useSession } from "@/features/auth/session";
import { IntegritySignalsPanel } from "@/features/integrity/panel";

export default function InstitutionIntegrityPage() {
  const { session } = useSession();
  return (
    <Protected roles={["INSTITUTION_ADMIN"]}>
      <div className="dashboard-page">
        <header className="page-heading">
          <p className="eyebrow">REVIEW & RECORDS</p>
          <h1>Integrity signals</h1>
          <p>Evidence-linked review prompts for your institution.</p>
        </header>
        {session?.user.institution_id && (
          <IntegritySignalsPanel
            institutionId={session.user.institution_id}
            canDecide={false}
          />
        )}
      </div>
    </Protected>
  );
}
