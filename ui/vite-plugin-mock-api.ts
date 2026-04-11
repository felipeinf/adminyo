import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { MOCK_CONFIG, MOCK_ROWS_BY_ENDPOINT } from "./mock/mockData";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.statusCode = status;
  res.end();
}

export function adminyoMockApiPlugin(): Plugin {
  return {
    name: "adminyo-mock-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const path = rawUrl.split("?")[0] ?? "";

        if (
          !path.startsWith("/auth/") &&
          path !== "/adminyo-config" &&
          path !== "/adminyo-public-config" &&
          !path.startsWith("/adminyo-proxy/")
        ) {
          return next();
        }

        if (path === "/auth/me" && req.method === "GET") {
          sendEmpty(res, 200);
          return;
        }

        if (path === "/auth/login" && req.method === "POST") {
          await readBody(req);
          sendJson(res, { ok: true });
          return;
        }

        if (path === "/auth/logout" && req.method === "POST") {
          sendEmpty(res, 204);
          return;
        }

        if (path === "/adminyo-config" && req.method === "GET") {
          sendJson(res, MOCK_CONFIG);
          return;
        }

        if (path === "/adminyo-public-config" && req.method === "GET") {
          sendJson(res, { branding: MOCK_CONFIG.branding });
          return;
        }

        if (path.startsWith("/adminyo-proxy/") && req.method === "GET") {
          const ep = path.slice("/adminyo-proxy/".length);
          const qs = new URLSearchParams(rawUrl.includes("?") ? rawUrl.split("?")[1] : "");
          const page = Math.max(1, Number(qs.get("page") ?? "1") || 1);
          const limit = Math.max(1, Math.min(100, Number(qs.get("limit") ?? "50") || 50));
          const q = (qs.get("q") ?? "").toLowerCase();

          const basePath = ep.split("?")[0].replace(/^\//, "");
          let rows = MOCK_ROWS_BY_ENDPOINT[basePath];
          if (!rows) {
            sendJson(res, { error: `No mock data for "${basePath}"` }, 404);
            return;
          }

          if (q) {
            rows = rows.filter((row) =>
              Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
            );
          }

          const start = (page - 1) * limit;
          const slice = rows.slice(start, start + limit);
          sendJson(res, { items: slice, page, limit, total: rows.length });
          return;
        }

        next();
      });
    },
  };
}
