// Re-export from the canonical types location.
// This file is kept for backward compatibility.
export type {
  ColumnConfig,
  PaginationConfig,
  EntityConfig,
  BrandingConfig,
  AdminyoConfig,
} from "./types/config";

export type EntityAction = "list" | "detail" | "create" | "edit" | "delete";
export type ColumnType = "text" | "number" | "boolean" | "date" | "array" | "object";
