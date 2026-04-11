import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { adminyoMockApiPlugin } from "./vite-plugin-mock-api";

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "mock" ? [adminyoMockApiPlugin()] : [])],
  base: "/",
  build: {
    outDir: "../cli/assets/ui",
    emptyOutDir: true,
  },
}));
