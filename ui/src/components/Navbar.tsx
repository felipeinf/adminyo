import type { CSSProperties } from "react";
import { Menu, LogOut } from "lucide-react";
import { logout } from "../lib/api";
import type { AdminyoConfig } from "../types/config";
import { Button } from "./ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface NavbarProps {
  config: AdminyoConfig;
  onMenuClick: () => void;
}

export default function Navbar({ config, onMenuClick }: NavbarProps) {
  const brandTitle = config.branding.name?.trim() || "Adminyo";
  const initial = brandTitle.charAt(0).toUpperCase();
  const brandSurfaceStyle: CSSProperties = {
    backgroundColor: "hsl(var(--primary))",
    backgroundImage: "var(--primary-gradient)",
    color: "hsl(var(--primary-foreground))",
  };

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-white/90 px-4 shadow-sm backdrop-blur md:hidden">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="h-9 w-9 text-foreground hover:bg-gray-50 hover:text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-gray-100 text-foreground hover:bg-gray-200"
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
              style={brandSurfaceStyle}
            >
              {initial}
            </div>
            <span className="sr-only">User menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold text-foreground">
              {brandTitle}
            </p>
            <p className="text-xs text-muted">Administrator</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-destructive focus:bg-red-50 focus:text-destructive"
            onClick={() => void handleLogout()}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
