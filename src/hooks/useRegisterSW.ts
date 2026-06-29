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
   * "Reload latest version"
   *
   * Purpose: Force the app to check the network right now and load the newest code.
   *
   * When to use:
   * - You just deployed something and the yellow dot hasn't appeared yet.
   * - You want to be 100% sure you're not running any stale cached files.
   *
   * Behavior:
   * - Always asks the Service Worker (if present) to check for updates.
   * - If a new worker is waiting, activates it.
   * - Then does a hard reload **with a cache-busting query parameter**.
   *   This tells the browser "ignore whatever you think you have in HTTP cache"
   *   and fetch the shell fresh from the network.
   *
   * Still completely safe for PWA + guest mode:
   * - Never touches localStorage / IndexedDB
   * - Never deletes Cache Storage
   * - Never unregisters the Service Worker
   */
  const refreshApp = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch (e) {
      console.warn('[useRegisterSW] SW update step failed (non-fatal):', e);
    }

    // Force the browser to bypass its HTTP cache for the main documents.
    // This is the "I really want the newest code right now" path.
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString());
    window.location.href = url.toString();
  }, []);

  /**
   * "Update App"
   *
   * Purpose: The polite, recommended way to apply an available update.
   *
   * When to use:
   * - The yellow update dot is showing.
   * - You want the cleanest possible transition using the Service Worker's
   *   normal update mechanism.
   *
   * Behavior:
   * - Asks the Service Worker for updates.
   * - If a new version is already waiting (the normal case after the dot appears),
   *   it activates it with SKIP_WAITING and reloads.
   * - If nothing is waiting, it does nothing visible (you're already up to date)
   *   or falls back to a gentle reload.
   *
   * This is usually the better button for day-to-day PWA use.
   *
   * Still 100% safe for local data and installed PWAs.
   */
  const updateApp = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});

          if (reg.waiting) {
            // This is the normal "update is ready" case
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(() => window.location.reload(), 80);
            return;
          }

          // No waiting worker. A plain reload is still safe and light.
          // We do a normal reload here (no _fresh param) so we respect
          // the Service Worker's caching strategy as much as possible.
          window.location.reload();
          return;
        }
      }
    } catch (e) {
      console.warn('[useRegisterSW] Update App path failed (falling back):', e);
    }

    // Last resort – still the safe path
    await refreshApp();
  }, [refreshApp]);

  return {
    needRefresh,
    updateSW,

    /**
     * "Reload latest version"  ← the more aggressive button
     *
     * What makes it different from "Update App":
     * - It **always** adds a cache-busting query param: ?_fresh=1720000000000
     * - It **always** forces the browser to re-download the main HTML + JS bundles
     *   from the network (bypasses browser HTTP cache).
     * - It still activates any waiting Service Worker.
     *
     * When to use it:
     * - You just pushed code and the yellow dot never appeared.
     * - You're not seeing your latest changes.
     * - You want to be 100% sure you're not getting any stale cached files.
     *
     * Still 100% safe for PWA + guest mode.
     */
    refreshApp,

    /**
     * "Update App"  ← the polite / recommended button
     *
     * What makes it different from "Reload latest version":
     * - If a new Service Worker is waiting (the normal case when the yellow dot shows),
     *   it activates it and reloads.
     * - If no new worker is waiting, it just does a normal `window.location.reload()`
     *   (no forced cache-bust). This lets the Service Worker and browser caching
     *   do their normal thing.
     * - Only falls back to the aggressive cache-busted path on error.
     *
     * When to use it:
     * - The yellow update dot is visible.
     * - You want the clean, normal PWA update experience.
     *
     * This is usually the better button for everyday use.
     */
    updateApp,
  };
}
