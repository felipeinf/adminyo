import { AlertCircle, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnConfig, EntityConfig } from "../types/config";
import { apiGet } from "../lib/api";
import { extractRows, rowHasKeyCaseInsensitive } from "../utils/jsonRows";
import DataTable from "./DataTable";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface EntityViewProps {
  entity: EntityConfig;
}

function labelFromField(field: string): string {
  const s = field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : field;
}

function autoColumnsFromRow(sample: Record<string, unknown>): ColumnConfig[] {
  return Object.keys(sample).map((field) => ({
    field,
    label: labelFromField(field),
  }));
}

function effectiveTableColumns(
  entity: EntityConfig,
  rows: Record<string, unknown>[],
): ColumnConfig[] {
  const configured = entity.columns ?? [];
  const sample = rows[0];
  if (!entity.rowPath?.trim() || !sample) {
    return configured;
  }
  if (configured.length === 0) {
    return autoColumnsFromRow(sample);
  }
  const stale = configured.some((c) => !rowHasKeyCaseInsensitive(sample, c.field));
  if (stale) {
    return autoColumnsFromRow(sample);
  }
  return configured;
}

export default function EntityView({ entity }: EntityViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = entity.pagination?.pageSize ?? 50;

  const tableColumns = useMemo(
    () => effectiveTableColumns(entity, rows),
    [entity, rows],
  );
  const searchableColumns = useMemo(
    () => tableColumns.filter((c) => c.searchable),
    [tableColumns],
  );

  const load = useCallback(async () => {
    if (!entity.actions.includes("list")) {
      setError("List action not enabled for this entity");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ep = entity.endpoint.replace(/^\//, "");
      const params = new URLSearchParams();
      if (searchApplied) params.set("q", searchApplied);
      if (entity.pagination?.type === "offset") {
        params.set("page", String(page));
        params.set("limit", String(pageSize));
      }
      const qs = params.toString();
      const path = qs ? `${ep}?${qs}` : ep;
      const res = await apiGet(path);
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data === "object" ? JSON.stringify(data) : String(data));
        setRows([]);
        return;
      }
      setRows(extractRows(data, entity.dataPath, entity.rowPath, entity.idField));
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entity, searchApplied, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [entity.name, searchApplied]);

  function applySearch() {
    setSearchApplied(search);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Section */}
      <div className="border-b border-border px-6 py-8 md:px-8 md:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{entity.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {rows.length} {rows.length === 1 ? 'record' : 'records'}
            </p>
          </div>
          {entity.actions.includes("create") && (
            <Button size="lg" className="md:w-auto w-full">
              <Plus className="mr-2 h-5 w-5" />
              New {entity.name}
            </Button>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 md:px-8 space-y-6">
          {/* Toolbar */}
          {searchableColumns.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applySearch()}
                  placeholder="Search records…"
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={applySearch} size="default">
                Search
              </Button>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <DataTable
              columns={tableColumns}
              rows={[]}
              idField={entity.idField}
              actions={entity.actions}
              loading
            />
          )}

          {/* Empty state */}
          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-gray-50 py-16 text-center">
              <div className="text-gray-300 text-4xl mb-3">∅</div>
              <p className="text-sm font-semibold text-foreground">No {entity.name} found</p>
              <p className="mt-1 text-xs text-muted">There are no records to display yet.</p>
            </div>
          )}

          {/* Data table */}
          {!loading && rows.length > 0 && (
            <DataTable
              columns={tableColumns}
              rows={rows}
              idField={entity.idField}
              actions={entity.actions}
              page={entity.pagination?.type === "offset" ? page : undefined}
              totalRows={entity.pagination?.type === "offset" ? rows.length + (page - 1) * pageSize : undefined}
              pageSize={pageSize}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
