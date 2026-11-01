import { Protected } from "@/components/app-shell";
import { ReconciliationDetail } from "@/features/reconciliations/workspace";

export default async function ReconciliationDetailPage({
  params,
}: {
  params: Promise<{ reconciliationId: string }>;
}) {
  const { reconciliationId } = await params;
  return (
    <Protected roles={["INSTITUTION_ADMIN", "AICTE_OFFICER"]}>
      <ReconciliationDetail reconciliationId={reconciliationId} />
    </Protected>
  );
}
