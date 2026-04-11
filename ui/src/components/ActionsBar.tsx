import type { EntityAction } from "../types";
import { Button } from "./ui/Button";

export default function ActionsBar({
  actions,
  onCreate,
  onExportCsv,
}: {
  actions: EntityAction[];
  onCreate?: () => void;
  onExportCsv?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.includes("create") && onCreate && (
        <Button size="sm" onClick={onCreate}>
          New
        </Button>
      )}
      {onExportCsv && (
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          Export CSV
        </Button>
      )}
    </div>
  );
}
