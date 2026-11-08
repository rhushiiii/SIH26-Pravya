import { Protected } from "@/components/app-shell";
import { ExecutiveDashboard } from "@/features/manager/workspace";

export default function Page() {
  return (
    <Protected roles={["AICTE_MANAGER"]}>
      <ExecutiveDashboard />
    </Protected>
  );
}
