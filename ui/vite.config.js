var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { adminyoMockApiPlugin } from "./vite-plugin-mock-api";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    return ({
        plugins: __spreadArray([react()], (mode === "mock" ? [adminyoMockApiPlugin()] : []), true),
        base: "/",
        build: {
            outDir: "../cli/assets/ui",
            emptyOutDir: true,
        },
    });
});
