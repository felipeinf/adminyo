import { useEffect, useRef } from "react";
import { isStaticMode } from "../lib/api";

const MAX_DELAY_MS = 30_000;

export function useWebSocket(onReload: () => void): void {
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;

  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === "mock" || isStaticMode()) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (cancelled) return;
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { type?: string };
          if (msg.type === "config-reload") {
            onReloadRef.current();
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** attemptRef.current);
        attemptRef.current += 1;
        timeoutId = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      wsRef.current?.close();
    };
  }, []);
}
