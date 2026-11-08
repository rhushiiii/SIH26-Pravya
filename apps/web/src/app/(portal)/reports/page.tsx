import { Suspense } from "react";
import { Protected } from "@/components/app-shell";
import { ReportCenter } from "@/features/reports/center";
import { Loading } from "@/components/ui/feedback";

export default function ReportsPage() {
  return (
    <Protected roles={["INSTITUTION_ADMIN", "AICTE_OFFICER", "AICTE_MANAGER"]}>
      <Suspense fallback={<Loading label="Loading reports…" />}>
        <ReportCenter />
      </Suspense>
    </Protected>
  );
}
