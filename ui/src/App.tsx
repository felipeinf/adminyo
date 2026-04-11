import { useState, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./components/Login";
import EntityView from "./components/EntityView";
import { useConfig } from "./hooks/useConfig";
import { useWebSocket } from "./hooks/useWebSocket";
import { hasSessionToken, isStaticMode } from "./lib/api";
import type { AdminyoConfig } from "./types/config";

function HomeRedirect({ config }: { config: AdminyoConfig }) {
  const first = config.entities[0];
  if (first) return <Navigate to={`/${first.name}`} replace />;
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No entities configured
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { config, loading, error, reload } = useConfig();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useWebSocket(() => {
    void reload();
  });

  useEffect(() => {
    if (isStaticMode()) {
      setAuthed(hasSessionToken());
      return;
    }
    fetch("/auth/me", { credentials: "include" })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (loading || authed === null) {
    return <LoadingScreen />;
  }

  if (!authed || error) {
    return (
      <Login
        configError={error}
        usernameLabel={
          isStaticMode() && config?.auth?.usernameField === "email"
            ? "Email"
            : "Username"
        }
        onSuccess={() => {
          setAuthed(true);
          void reload();
        }}
      />
    );
  }

  if (!config) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route element={<Layout config={config} />}>
        <Route path="/" element={<HomeRedirect config={config} />} />
        {config.entities.map((entity) => (
          <Route
            key={entity.name}
            path={`/${entity.name}`}
            element={<EntityView entity={entity} />}
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
