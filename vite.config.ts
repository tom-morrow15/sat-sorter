import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    // Injected at build time so the hamburger menu can show a version that
    // automatically changes on every deploy.
    __APP_VERSION__: JSON.stringify(
      process.env.npm_package_version || new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
    ),
  },
  plugins: [
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));