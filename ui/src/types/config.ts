export interface ColumnConfig {
  field: string;
  label: string;
  type?: "text" | "number" | "boolean" | "date" | "array" | "object";
  searchable?: boolean;
}

export interface PaginationConfig {
  type: "offset" | "cursor";
  pageSize: number;
}

export interface EntityConfig {
  name: string;
  endpoint: string;
  idField: string;
  dataPath?: string | null;
  rowPath?: string | null;
  actions: Array<"list" | "detail" | "create" | "edit" | "delete">;
  columns?: ColumnConfig[];
  pagination?: PaginationConfig;
}

export interface BrandingConfig {
  name?: string | null;
  logo?: string;
  logoUrl?: string;
  primaryColor?: string;
  primaryForeground?: string;
  theme?: "light" | "dark";
}

export interface AuthConfig {
  loginEndpoint: string;
  tokenPath?: string;
  tokenScheme?: string;
  usernameField?: string;
  passwordField?: string;
}

export interface AdminyoConfig {
  branding: BrandingConfig;
  entities: EntityConfig[];
  baseUrl?: string;
  auth?: AuthConfig | null;
  mode?: "static";
  environment?: string;
}

export interface AdminyoPublicConfig {
  branding: BrandingConfig;
  baseUrl?: string;
  auth?: AuthConfig | null;
  mode?: "static";
  environment?: string;
}
