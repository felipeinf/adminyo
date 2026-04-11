import type { AdminyoConfig } from "../types/config";

declare global {
  interface Window {
    __NYO_CONFIG_URL__?: string;
  }
}

export const NYO_TOKEN_KEY = "nyo_api_token";

export function isStaticMode(): boolean {
  return typeof window !== "undefined" && Boolean(window.__NYO_CONFIG_URL__);
}

let lastLoadedConfig: AdminyoConfig | null = null;

export function getLastLoadedConfig(): AdminyoConfig | null {
  return lastLoadedConfig;
}

function joinApiUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function getValueAtPath(obj: unknown, path: string): unknown {
  const segments = path.split(".").map((s) => s.trim()).filter(Boolean);
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function hasSessionToken(): boolean {
  return Boolean(sessionStorage.getItem(NYO_TOKEN_KEY));
}

function staticAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem(NYO_TOKEN_KEY);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchConfig(): Promise<AdminyoConfig> {
  if (isStaticMode()) {
    const url = window.__NYO_CONFIG_URL__!;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load config (${res.status})`);
    }
    const data = (await res.json()) as AdminyoConfig;
    lastLoadedConfig = data;
    return data;
  }
  const res = await fetch("/adminyo-config", { credentials: "include" });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    const detail = j.error ? `: ${j.error}` : "";
    throw new Error(`Failed to fetch config (${res.status})${detail}`);
  }
  const data = (await res.json()) as AdminyoConfig;
  lastLoadedConfig = data;
  return data;
}

export async function login(username: string, password: string): Promise<void> {
  if (isStaticMode()) {
    const cfgUrl = window.__NYO_CONFIG_URL__!;
    const cfgRes = await fetch(cfgUrl);
    if (!cfgRes.ok) {
      throw new Error("Could not load config for login");
    }
    const cfg = (await cfgRes.json()) as AdminyoConfig;
    lastLoadedConfig = cfg;
    const auth = cfg.auth;
    const baseUrl = cfg.baseUrl;
    if (!auth?.loginEndpoint || !baseUrl) {
      throw new Error("Static build requires auth.loginEndpoint and baseUrl in config.json");
    }
    const userField = auth.usernameField ?? "email";
    const passField = auth.passwordField ?? "password";
    const body: Record<string, string> = {
      [userField]: username,
      [passField]: password,
    };
    const url = joinApiUrl(baseUrl, auth.loginEndpoint);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : `Login failed (${res.status})`;
      throw new Error(msg);
    }
    const tokenPath = auth.tokenPath?.trim() || "token";
    const token = getValueAtPath(data, tokenPath);
    if (typeof token !== "string" || !token) {
      throw new Error(
        `Login response has no string token at path "${tokenPath}". Set auth.tokenPath in adminyo.yml.`,
      );
    }
    sessionStorage.setItem(NYO_TOKEN_KEY, token);
    return;
  }
  const res = await fetch("/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Login failed");
  }
}

export async function logout(): Promise<void> {
  if (isStaticMode()) {
    sessionStorage.removeItem(NYO_TOKEN_KEY);
    return;
  }
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
}

export async function apiGet(pathWithQuery: string): Promise<Response> {
  const p = pathWithQuery.startsWith("/") ? pathWithQuery.slice(1) : pathWithQuery;
  if (isStaticMode()) {
    const base = lastLoadedConfig?.baseUrl;
    if (!base) {
      throw new Error("Config not loaded (baseUrl missing)");
    }
    return fetch(joinApiUrl(base, `/${p}`), {
      method: "GET",
      headers: staticAuthHeaders(),
    });
  }
  return fetch(`/adminyo-proxy/${p}`, { credentials: "include" });
}

export async function apiPost(path: string, body: unknown): Promise<Response> {
  const ep = path.startsWith("/") ? path.slice(1) : path;
  if (isStaticMode()) {
    const base = lastLoadedConfig?.baseUrl;
    if (!base) throw new Error("Config not loaded");
    return fetch(joinApiUrl(base, `/${ep}`), {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(staticAuthHeaders() as Record<string, string>),
      },
      body: JSON.stringify(body),
    });
  }
  return fetch(`/adminyo-proxy/${ep}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPut(path: string, body: unknown): Promise<Response> {
  const ep = path.startsWith("/") ? path.slice(1) : path;
  if (isStaticMode()) {
    const base = lastLoadedConfig?.baseUrl;
    if (!base) throw new Error("Config not loaded");
    return fetch(joinApiUrl(base, `/${ep}`), {
      method: "PUT",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...(staticAuthHeaders() as Record<string, string>),
      },
      body: JSON.stringify(body),
    });
  }
  return fetch(`/adminyo-proxy/${ep}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string): Promise<Response> {
  const ep = path.startsWith("/") ? path.slice(1) : path;
  if (isStaticMode()) {
    const base = lastLoadedConfig?.baseUrl;
    if (!base) throw new Error("Config not loaded");
    return fetch(joinApiUrl(base, `/${ep}`), {
      method: "DELETE",
      headers: staticAuthHeaders(),
    });
  }
  return fetch(`/adminyo-proxy/${ep}`, { method: "DELETE", credentials: "include" });
}

export async function proxyGet(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  let path = endpoint.replace(/^\//, "");
  const qs =
    params && Object.keys(params).length > 0 ? new URLSearchParams(params).toString() : "";
  const full = qs ? `${path}?${qs}` : path;
  const res = await apiGet(full);
  return res.json() as Promise<unknown>;
}

export async function proxyPost(endpoint: string, body: unknown): Promise<unknown> {
  const ep = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const res = await apiPost(ep, body);
  return res.json() as Promise<unknown>;
}

export async function proxyPut(endpoint: string, body: unknown): Promise<unknown> {
  const ep = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const res = await apiPut(ep, body);
  return res.json() as Promise<unknown>;
}

export async function proxyDelete(endpoint: string): Promise<unknown> {
  const ep = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const res = await apiDelete(ep);
  return res.json() as Promise<unknown>;
}
