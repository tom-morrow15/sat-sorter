import { useState, useEffect, useCallback } from 'react';

export function useRegisterSW() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Register service worker if available (best-effort).
    // The project is a static Vite app; a real sw.js may or may not be present.
    // We still want to be able to react if one is added later.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Periodically ask the SW to check for updates
          const interval = setInterval(() => {
            registration.update().catch(() => {});
          }, 60000);

          // When the new SW takes control, we can show "update available"
          const onControllerChange = () => setNeedRefresh(true);
          registration.addEventListener('controllerchange', onControllerChange);

          // Expose a function that tells the SW to update and then reloads
          setUpdateSW(() => async (reloadPage = true) => {
            try {
              await registration.update();
            } catch {
              // ignore
            }
            if (reloadPage) {
              // Small delay so the new SW can activate
              setTimeout(() => window.location.reload(), 80);
            }
          });

          // Cleanup interval on unmount
          return () => {
            clearInterval(interval);
            registration.removeEventListener('controllerchange', onControllerChange);
          };
        })
        .catch(() => {
          // No SW or registration failed — that's fine for a plain static site.
          // The manual refresh below will still work great.
        });
    }
  }, []);

  /**
   * Safe reload that fetches the latest app code.
   *
   * Designed specifically for PWA / installed app usage (including guest mode).
   *
   * GUARANTEES:
   * - **Never touches localStorage or IndexedDB** — your budgets, transactions,
   *   partners, settings etc. are 100% safe. Guest users will not lose anything.
   * - **Never deletes Cache Storage** — the offline PWA experience is preserved.
   * - **Never unregisters the Service Worker** — the app stays installed and
   *   continues to work offline.
   *
   * How it works (gentle / PWA-friendly):
   * 1. Asks the Service Worker (if any) to check the network for a new version.
   * 2. If a new version is waiting, tells it to activate immediately (SKIP_WAITING).
   * 3. Does a normal reload (the active SW will serve the new shell if available,
   *    or the browser will fetch fresh assets).
   *
   * This is the recommended way to pick up a deploy while staying inside your
   * installed PWA.
   */
  const refreshApp = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});

          // Politely activate a waiting worker if one is ready
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch (e) {
      console.warn('[useRegisterSW] SW update step failed (non-fatal):', e);
    }

    // Simple reload. Because we did SKIP_WAITING (if applicable), the new code
    // will be used. Browser HTTP cache for the main bundles is usually bypassed
    // after a SW-controlled reload in modern browsers.
    window.location.reload();
  }, []);

  /**
   * "Update App" — preferred button for normal PWA use.
   *
   * Tries the standard Service Worker update flow.
   * Activates any waiting worker and reloads.
   *
   * Falls back to the safe refreshApp() above.
   *
   * Completely safe for guest mode and all local data.
   */
  const updateApp = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Give the new worker a tiny moment to take control
            setTimeout(() => window.location.reload(), 80);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('[useRegisterSW] Update App path failed (falling back):', e);
    }

    // Still safe — just does the gentle reload
    await refreshApp();
  }, [refreshApp]);

  return {
    needRefresh,
    updateSW,
    /**
     * Safe reload that gets the latest app code (PWA-friendly).
     *
     * Guarantees:
     * - Never touches localStorage or IndexedDB → your budgets are 100% safe
     *   (critical for guest mode)
     * - Never deletes Cache Storage → offline PWA continues to work
     * - Never unregisters the Service Worker → app stays installed
     *
     * Uses SKIP_WAITING + reload when a new Service Worker is waiting.
     * Falls back to a plain reload otherwise.
     *
     * This is the button you should use as a daily PWA user.
     */
    refreshApp,
    /**
     * Preferred "Update App" for normal PWA use.
     * Tries the standard Service Worker update flow first.
     * Falls back to refreshApp.
     *
     * Completely safe for local data and guest mode.
     */
    updateApp,
  };
}
