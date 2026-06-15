/// <reference types="vite/client" />

// NOTE: The app version is now obtained by a direct static import of package.json
// (see BudgetHeader.tsx). This is the most reliable way to get a build-time string
// when using @vitejs/plugin-react-swc.
//
// We keep the old global declaration for backward compatibility in case other files
// still reference the bare __APP_VERSION__ identifier. Vite's `define` in vite.config.ts
// will still replace it when present.
declare const __APP_VERSION__: string;
