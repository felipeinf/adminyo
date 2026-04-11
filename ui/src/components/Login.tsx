import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { fetchConfig, isStaticMode, login } from "../lib/api";
import { applyBrandingColor } from "../lib/brandingColor";
import type { AdminyoConfig, AdminyoPublicConfig } from "../types/config";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";

interface LoginProps {
  onSuccess: () => void;
  configError?: string | null;
  usernameLabel?: string;
  config?: AdminyoConfig | AdminyoPublicConfig | null;
}

export default function Login({
  onSuccess,
  configError,
  usernameLabel = "Username",
  config = null,
}: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brandingConfig, setBrandingConfig] = useState<AdminyoConfig | AdminyoPublicConfig | null>(config);

  useEffect(() => {
    setBrandingConfig(config);
  }, [config]);

  useEffect(() => {
    if (config) {
      return;
    }

    let ignore = false;

    async function loadBranding() {
      try {
        if (isStaticMode()) {
          const data = await fetchConfig();
          if (!ignore) {
            setBrandingConfig(data);
          }
          return;
        }

        const response = await fetch("/adminyo-public-config");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as AdminyoPublicConfig;
        if (!ignore) {
          setBrandingConfig(data);
        }
      } catch {
        // Keep default branding if public config is unavailable.
      }
    }

    void loadBranding();

    return () => {
      ignore = true;
    };
  }, [config]);

  const brand = useMemo(() => brandingConfig?.branding, [brandingConfig]);
  const brandTitle = brand?.name?.trim() || "Adminyo";
  const initial = brandTitle.charAt(0).toUpperCase();
  const logoSrc = brand?.logoUrl ?? brand?.logo;
  const brandSurfaceStyle: CSSProperties = {
    backgroundColor: "hsl(var(--primary))",
    backgroundImage: "var(--primary-gradient)",
    color: "hsl(var(--primary-foreground))",
  };

  useEffect(() => {
    if (!brand?.primaryColor) {
      return;
    }

    applyBrandingColor(brand.primaryColor);
    if (brand.primaryForeground) {
      document.documentElement.style.setProperty(
        "--primary-foreground",
        brand.primaryForeground,
      );
    }
  }, [brand]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-sm border-border shadow-md">
        <CardHeader className="space-y-6 text-center">
          <div className="flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-1 ring-black/5"
              style={brandSurfaceStyle}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={`${brandTitle} logo`}
                  className="h-9 w-9 object-contain"
                />
              ) : (
                <span className="text-xl font-bold">{initial}</span>
              )}
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-foreground">
              {brandTitle}
            </CardTitle>
            <CardDescription className="mt-3 text-sm text-muted">
              Sign in to manage {brandTitle}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {usernameLabel}
              </label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {(configError || error) && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 space-y-2">
                {configError && <p>{configError}</p>}
                {error && <p>{error}</p>}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6"
              size="lg"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
