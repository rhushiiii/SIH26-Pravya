"use client";

import { Protected } from "@/components/app-shell";
import { useSession } from "@/features/auth/session";
import { SimulatorPanel } from "@/features/intake/simulator-panel";

export default function InstitutionSimulatorPage() {
  const { session } = useSession();
  return (
    <Protected roles={["INSTITUTION_ADMIN"]}>
      <div className="dashboard-page simulator-page">
        <header className="page-heading">
          <p className="eyebrow">WORKSPACE</p>
          <h1>What-if simulator</h1>
          <p>Explore hypothetical additions against configured demo rules.</p>
        </header>
        {session?.user.institution_id && (
          <SimulatorPanel institutionId={session.user.institution_id} />
        )}
      </div>
    </Protected>
  );
}
