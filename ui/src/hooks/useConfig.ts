import { useCallback, useEffect, useState } from "react";
import { fetchConfig, isConfigFetchUnauthorized } from "../lib/api";
import { applyBrandingColor } from "../lib/brandingColor";
import type { AdminyoConfig } from "../types/config";

interface UseConfigResult {
  config: AdminyoConfig | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useConfig(): UseConfigResult {
  const [config, setConfig] = useState<AdminyoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConfig();
      setConfig(data);
      const root = document.documentElement;
      if (data.branding?.primaryColor) {
        applyBrandingColor(data.branding.primaryColor);
      } else {
        root.style.removeProperty("--primary");
        root.style.removeProperty("--ring");
        root.style.removeProperty("--primary-gradient");
      }
      if (data.branding?.primaryForeground) {
        root.style.setProperty("--primary-foreground", data.branding.primaryForeground);
      } else {
        root.style.removeProperty("--primary-foreground");
      }
    } catch (e) {
      if (isConfigFetchUnauthorized(e)) {
        setConfig(null);
        setError(null);
      } else {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { config, loading, error, reload: load };
}
