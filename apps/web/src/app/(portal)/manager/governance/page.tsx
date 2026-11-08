import { Protected } from "@/components/app-shell";
import { Governance } from "@/features/manager/workspace";

export default function Page() {
  return (
    <Protected roles={["AICTE_MANAGER"]}>
      <Governance />
    </Protected>
  );
}
