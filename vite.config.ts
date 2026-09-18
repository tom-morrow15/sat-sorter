import path from "node:path";
import fs from "node:fs";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";

// Dev-only: relax the app's strict CSP so the embedded preview browser can
// reach local dev endpoints (relay proxy ws://localhost:8090, console log
// collector http://localhost:8099). Production CSP is untouched.
function devCspRelax(): Plugin {
  return {
    name: "dev-csp-relax",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        "connect-src 'self' blob: https: wss:",
        "connect-src 'self' blob: https: wss: ws: http://localhost:8099 http://localhost:8090",
      );
    },
  };
}

// Resolve version at config load time (works for both `vite` and `vite build`).
// Preferred source: package.json "version". Fallback: build-time timestamp.
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

const versionValue = JSON.stringify(version);

// Very defensive plugin: replace the bare identifier __APP_VERSION__ at the source level
// before any JSX/TS transform. This is a belt-and-suspenders measure in case any file
// (now or in the future) still contains the old global reference. It guarantees that
// the production bundle never contains an unresolved bare __APP_VERSION__.
function forceReplaceAppVersion() {
  return {
    name: "force-replace-app-version",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (id.includes("node_modules") || id.startsWith("\0")) return;
      if (code.includes("__APP_VERSION__")) {
        return code.replace(/__APP_VERSION__/g, versionValue);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    // Official Vite define (for any code that still references the bare global)
    __APP_VERSION__: versionValue,
  },
  esbuild: {
    define: {
      __APP_VERSION__: versionValue,
    },
  },
  plugins: [
    forceReplaceAppVersion(),
    devCspRelax(),
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
