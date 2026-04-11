import type { CSSProperties } from "react";
import { Table2, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { AdminyoConfig } from "../types/config";
import { Button } from "./ui/Button";

interface SidebarProps {
  config: AdminyoConfig;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ config, open, onClose }: SidebarProps) {
  const brandTitle = config.branding.name?.trim() || "Adminyo";
  const initial = brandTitle.charAt(0).toUpperCase();
  const logoSrc = config.branding.logoUrl ?? config.branding.logo;
  const brandSurfaceStyle: CSSProperties = {
    backgroundColor: "hsl(var(--primary))",
    backgroundImage: "var(--primary-gradient)",
    color: "hsl(var(--primary-foreground))",
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] transition-opacity duration-150 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col border border-border bg-white/95 backdrop-blur
          transition-transform duration-150 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          shadow-xl md:bottom-4 md:left-4 md:top-4 md:translate-x-0 md:rounded-2xl md:shadow-lg
        `}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5"
              style={brandSurfaceStyle}
            >
              <span className="text-sm font-bold">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {brandTitle}
              </p>
              <p className="mt-1 text-xs text-muted">Control center</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 text-foreground hover:bg-gray-100 md:hidden"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Navigation
          </div>
          <div className="space-y-2">
            {config.entities.map((entity) => (
              <NavLink
                key={entity.name}
                to={`/${entity.name}`}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  [
                    "relative flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "border-primary/15 bg-primary/10 text-primary shadow-sm"
                      : "border-transparent text-foreground hover:border-border hover:bg-gray-50 hover:text-primary",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Table2 className="h-4 w-4 shrink-0" />
                    <span>{entity.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {logoSrc ? (
          <div className="shrink-0 border-t border-border/80 px-5 py-4">
            <div className="flex items-center justify-center rounded-xl bg-gray-50/80 px-4 py-3 ring-1 ring-border/60">
              <img
                src={logoSrc}
                alt={`${brandTitle} logo`}
                className="max-h-14 w-auto max-w-full object-contain object-center"
              />
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
