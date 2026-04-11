export var MOCK_CONFIG = {
    branding: {
        name: "Adminyo (mock)",
        primaryColor: "#4f46e5",
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
var userRows = Array.from({ length: 37 }, function (_, i) { return ({
    id: i + 1,
    name: "User ".concat(i + 1),
    email: "user".concat(i + 1, "@example.com"),
    active: i % 4 !== 0,
}); });
var projectRows = [
    { id: "p-1", title: "Website refresh", status: "active" },
    { id: "p-2", title: "API hardening", status: "active" },
    { id: "p-3", title: "Mobile app", status: "paused" },
    { id: "p-4", title: "Analytics", status: "done" },
    { id: "p-5", title: "Auth SSO", status: "active" },
];
export var MOCK_ROWS_BY_ENDPOINT = {
    "api/users": userRows,
    "api/projects": projectRows,
};
