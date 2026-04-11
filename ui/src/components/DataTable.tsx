import { Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ColumnConfig } from "../types/config";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/Table";
import { Skeleton } from "./ui/Skeleton";

function rowField(row: Record<string, unknown>, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, field)) {
    return row[field];
  }
  const lower = field.toLowerCase();
  const key = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return key !== undefined ? row[key] : undefined;
}

interface DataTableProps {
  columns: ColumnConfig[];
  rows: Record<string, unknown>[];
  idField: string;
  actions: Array<"list" | "detail" | "create" | "edit" | "delete">;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  page?: number;
  totalRows?: number;
  pageSize?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

function CellValue({ value, type }: { value: unknown; type?: ColumnConfig["type"] }) {
  if (value === null || value === undefined) {
    return <span className="text-muted">—</span>;
  }

  if (type === "boolean") {
    const bool = value === true || value === "true" || value === 1;
    return bool ? (
      <Badge variant="success">Yes</Badge>
    ) : (
      <Badge variant="secondary">No</Badge>
    );
  }

  if (type === "date") {
    const d = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
    if (d && !isNaN(d.getTime())) {
      return <span className="text-sm text-foreground">{d.toLocaleDateString()}</span>;
    }
    return <span className="text-sm text-foreground">{String(value)}</span>;
  }

  if (type === "array") {
    const len = Array.isArray(value) ? value.length : "?";
    return <span className="text-xs text-muted">{len} items</span>;
  }

  if (type === "object") {
    return <span className="text-xs text-muted">{"{ … }"}</span>;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return <span className="text-xs text-muted">{"{ … }"}</span>;
  }

  if (type === "number") {
    return (
      <span className="font-mono tabular-nums text-sm text-foreground">{String(value)}</span>
    );
  }

  const str = String(value);
  return (
    <span className="block max-w-xs truncate text-sm text-foreground" title={str}>
      {str}
    </span>
  );
}

export default function DataTable({
  columns,
  rows,
  idField,
  actions,
  onView,
  onEdit,
  onDelete,
  loading,
  page,
  totalRows,
  pageSize,
  onPrev,
  onNext,
}: DataTableProps) {
  const displayCols: ColumnConfig[] =
    columns.length > 0
      ? columns
      : Object.keys(rows[0] ?? {}).map((f) => ({ field: f, label: f }));

  const hasActions =
    actions.includes("detail") || actions.includes("edit") || actions.includes("delete");

  const showPagination =
    page !== undefined && totalRows !== undefined && pageSize !== undefined;

  const from = showPagination ? (page - 1) * pageSize + 1 : 0;
  const to = showPagination ? Math.min(page * pageSize, totalRows) : 0;

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-gray-50">
              {displayCols.map((col) => (
                <TableHead key={col.field} className="hidden sm:table-cell text-xs uppercase font-semibold tracking-wider text-foreground">
                  {col.label}
                </TableHead>
              ))}
              {displayCols.length > 0 && (
                <TableHead className="sm:hidden text-xs uppercase font-semibold tracking-wider text-foreground">
                  {displayCols[0].label}
                </TableHead>
              )}
              {hasActions && <TableHead className="text-right text-xs uppercase font-semibold tracking-wider text-foreground">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border">
                    {displayCols.map((col) => (
                      <TableCell key={col.field} className="hidden sm:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                    {displayCols.length > 0 && (
                      <TableCell className="sm:hidden">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    )}
                    {hasActions && (
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              : rows.map((row, idx) => {
                  const rawId = rowField(row, idField);
                  const id =
                    rawId !== null && rawId !== undefined ? String(rawId) : String(idx);
                  return (
                    <TableRow
                      key={id}
                      className="border-b border-border hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => onView?.(id)}
                    >
                      {displayCols.map((col) => (
                        <TableCell key={col.field} className="hidden sm:table-cell">
                          <CellValue value={rowField(row, col.field)} type={col.type} />
                        </TableCell>
                      ))}
                      {displayCols.length > 0 && (
                        <TableCell className="sm:hidden">
                          <CellValue
                            value={rowField(row, displayCols[0].field)}
                            type={displayCols[0].type}
                          />
                        </TableCell>
                      )}
                      {hasActions && (
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {actions.includes("detail") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onView?.(id)}
                                title="View"
                                className="h-8 w-8 text-muted transition-colors hover:text-primary hover:bg-primary/5"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </Button>
                            )}
                            {actions.includes("edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit?.(id)}
                                title="Edit"
                                className="h-8 w-8 text-muted transition-colors hover:text-primary hover:bg-primary/5"
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                            )}
                            {actions.includes("delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete?.(id)}
                                title="Delete"
                                className="h-8 w-8 text-muted transition-colors hover:text-destructive hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between bg-gray-50">
          <span className="text-xs text-muted sm:text-sm">
            Showing {from}–{to} of {totalRows}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={to >= totalRows}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
