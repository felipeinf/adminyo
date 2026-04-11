import type { AdminyoConfig } from "../src/types/config";

export const MOCK_CONFIG: AdminyoConfig = {
  branding: {
    name: "Adminyo (mock)",
    primaryColor: "linear-gradient(135deg, #4f46e5 0%, #7c72ff 100%)",
  },
  entities: [
    {
      name: "Users",
      endpoint: "api/users",
      idField: "id",
      actions: ["list", "detail", "create", "edit", "delete"],
      columns: [
        { field: "id", label: "ID", type: "number" },
        { field: "name", label: "Name", type: "text", searchable: true },
        { field: "email", label: "Email", type: "text", searchable: true },
        { field: "active", label: "Active", type: "boolean" },
      ],
      pagination: { type: "offset", pageSize: 8 },
    },
    {
      name: "Projects",
      endpoint: "api/projects",
      idField: "id",
      actions: ["list", "create"],
      columns: [
        { field: "id", label: "ID", type: "text" },
        { field: "title", label: "Title", type: "text", searchable: true },
        { field: "status", label: "Status", type: "text" },
      ],
      pagination: { type: "offset", pageSize: 6 },
    },
  ],
};

const userRows: Record<string, unknown>[] = Array.from({ length: 37 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  active: i % 4 !== 0,
}));

const projectRows: Record<string, unknown>[] = [
  { id: "p-1", title: "Website refresh", status: "active" },
  { id: "p-2", title: "API hardening", status: "active" },
  { id: "p-3", title: "Mobile app", status: "paused" },
  { id: "p-4", title: "Analytics", status: "done" },
  { id: "p-5", title: "Auth SSO", status: "active" },
];

export const MOCK_ROWS_BY_ENDPOINT: Record<string, Record<string, unknown>[]> = {
  "api/users": userRows,
  "api/projects": projectRows,
};
