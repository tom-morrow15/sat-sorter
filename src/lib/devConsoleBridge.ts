/**
 * Dev-only: bridge console output to a local log collector so that
 * environments without devtools access (e.g. embedded preview browsers)
 * can still be debugged. Active only in dev when VITE_RELAY_PROXY is set.
 */
if (import.meta.env.DEV && import.meta.env.VITE_RELAY_PROXY) {
  document.title = '[bridge-active] ' + document.title;
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const post = (level: string, args: unknown[]) => {
    try {
      const line = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
        return String(a);
      }).join(' ');
      const body = `${new Date().toISOString()} [${level}] ${line}`;
      // Try both loopback hostnames — browsers may resolve/block them differently
      for (const host of ['http://localhost:8099/log', 'http://127.0.0.1:8099/log']) {
        fetch(host, { method: 'POST', body }).catch(() => {});
      }
    } catch { /* never break the app for logging */ }
  };
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    console[level] = (...args: unknown[]) => {
      (orig[level] as (...a: unknown[]) => void)(...args);
      post(level, args);
    };
  }
  window.addEventListener('error', (e) => post('window-error', [e.message + ' @ ' + e.filename + ':' + e.lineno]));
  window.addEventListener('unhandledrejection', (e) => post('unhandled-rejection', [String(e.reason)]));
  console.log('[dev] console bridge active ✓');
}
