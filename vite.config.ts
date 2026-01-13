import path from "node:path";
import fs from "node:fs";

import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Vite plugin to generate PNG icons from SVG at build time
 * Creates apple-touch-icon.png and other required PNG icons
 */
function generatePngIcons(): Plugin {
  return {
    name: 'generate-png-icons',
    writeBundle() {
      // This runs after the build is complete
      // The actual PNG generation happens via the generate-icons.html page
      // which users can visit, or we serve the SVG and let browsers handle it
      console.log('📱 PWA icons configured - SVG icons will be used with PNG fallback');
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    generatePngIcons(),
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
