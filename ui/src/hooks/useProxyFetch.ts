import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminyoUnauthorized } from "../utils/jsonRows";

export function useProxyFetch() {
  const navigate = useNavigate();

  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const url = path.startsWith("/") ? path : `/adminyo-proxy/${path}`;
      const headers = new Headers(init?.headers);
      if (init?.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const res = await fetch(url, {
        ...init,
        credentials: "include",
        headers,
      });
      let parsed: unknown = null;
      const ct = res.headers.get("content-type");
      if (ct?.includes("application/json")) {
        try {
          parsed = await res.clone().json();
        } catch {
          parsed = null;
        }
      }
      if (isAdminyoUnauthorized(res.status, parsed)) {
        navigate("/login", { replace: true });
      }
      return res;
    },
    [navigate],
  );
}
