import { Protected } from "@/components/app-shell";
import { CaseOversight } from "@/features/manager/workspace";

export default function CaseOversightPage() {
  return (
    <Protected roles={["AICTE_MANAGER"]}>
      <CaseOversight />
    </Protected>
  );
}
