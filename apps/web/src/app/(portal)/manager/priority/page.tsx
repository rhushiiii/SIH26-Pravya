import { Protected } from "@/components/app-shell";
import { PriorityMonitoring } from "@/features/manager/workspace";

export default function Page() {
  return (
    <Protected roles={["AICTE_MANAGER"]}>
      <PriorityMonitoring />
    </Protected>
  );
}
