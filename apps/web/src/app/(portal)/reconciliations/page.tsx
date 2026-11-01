import { Protected } from "@/components/app-shell";
import { ReconciliationQueue } from "@/features/reconciliations/workspace";

export default function ReconciliationsPage() {
  return (
    <Protected roles={["INSTITUTION_ADMIN", "AICTE_OFFICER"]}>
      <ReconciliationQueue />
    </Protected>
  );
}
