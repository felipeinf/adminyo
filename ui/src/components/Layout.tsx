import { useState } from "react";
import { Outlet } from "react-router-dom";
import type { AdminyoConfig } from "../types/config";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

interface LayoutProps {
  config: AdminyoConfig;
}

export default function Layout({ config }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fb]">
      <Navbar config={config} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          config={config}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-auto md:pl-[19rem] md:pt-4">
          <div className="min-h-[calc(100vh-3.5rem)] md:min-h-screen md:pb-4 md:pr-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
