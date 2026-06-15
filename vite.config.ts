import path from "node:path";
import fs from "node:fs";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Read version from package.json at config evaluation time.
// This is still useful for Vite's `define` if any other code wants the bare global,
// and provides a reliable fallback. The primary consumption below now imports package.json directly.
let version = new Date().toISOString().slice(0, 19).replace("T", " ");
try {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
    version = pkg.version.trim();
  }
} catch {
  // keep timestamp fallback
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    // Keep the global define for backward compatibility / other potential usage.
    // The main UI now uses a direct JSON import so it works reliably with any bundler (Vite or esbuild-based preview).
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  // Vitest configuration (only used when running `vitest`)
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: "0",
    },
  },
});
