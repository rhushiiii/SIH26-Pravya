import { Protected } from "@/components/app-shell";
import { InstitutionWorkspace } from "@/features/manager/workspace";

export default function DirectoryPage() {
  return (
    <Protected roles={["AICTE_OFFICER", "AICTE_MANAGER"]}>
      <InstitutionWorkspace />
    </Protected>
  );
}
