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
   * Force a completely fresh load of the app.
   * This is the "Fresh App" / "Refresh App" behavior users want when they
   * see stale UI after a deploy or after Safari cache/history clear.
   *
   * It:
   *  - Clears all Cache Storage
   *  - Unregisters all Service Workers
   *  - Does a hard navigation (avoids browser cache as much as possible)
   */
  const refreshApp = useCallback(async () => {
    try {
      // 1. Clear every Cache Storage bucket (app shell, images, etc.)
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.warn('[useRegisterSW] Cache clear failed (non-fatal):', e);
    }

    try {
      // 2. Unregister any service workers so they can't serve old assets
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } catch (e) {
      console.warn('[useRegisterSW] SW unregister failed (non-fatal):', e);
    }

    // 3. Hard navigation that is very likely to bypass disk cache.
    // Using a cache-busting query string + replacing the location forces a fresh fetch.
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString());
    window.location.href = url.toString();
  }, []);

  /**
   * Lightweight "check for updates + reload".
   * If a SW is controlling the page and reports an update, it will use it.
   * Otherwise it falls back to the same force-refresh behavior.
   */
  const updateApp = useCallback(async () => {
    try {
      if (updateSW) {
        await updateSW(true);
        return;
      }
    } catch {
      // fall through to hard refresh
    }
    // No SW update hook available — do the full fresh load
    await refreshApp();
  }, [updateSW, refreshApp]);

  return {
    needRefresh,
    updateSW,
    /** Full "fresh app" — nukes caches + SWs + hard reload */
    refreshApp,
    /** "Update app" — prefers SW update if present, otherwise same as refreshApp */
    updateApp,
  };
}
