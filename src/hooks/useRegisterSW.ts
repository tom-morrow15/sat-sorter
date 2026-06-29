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

  /**
   * Nuclear "Factory Reset" — deletes local app data.
   *
   * This is the REAL nuclear option.
   *
   * WARNING:
   * - This will permanently delete the budget stored in localStorage on this device.
   * - If you are logged in with Nostr + have synced, you can restore from the cloud.
   * - If you are in guest mode (or not backed up), ALL your budgets will be lost forever.
   *
   * Only expose this with very clear warnings.
   */
  const factoryResetApp = useCallback(async () => {
    const message =
      "⚠️ FACTORY RESET — DANGER\n\n" +
      "This will DELETE all budget data saved locally on this device.\n\n" +
      "• If you use Nostr login and have used Backup & Sync (or the app has synced), you can recover your data after logging back in.\n" +
      "• If you are in guest mode, or have never synced to Nostr/cloud, your budgets will be PERMANENTLY LOST.\n\n" +
      "Are you absolutely sure you want to do this?";

    if (!window.confirm(message)) {
      return;
    }

    try {
      // 1. Clear all Cache Storage
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.warn('[useRegisterSW] Cache clear during factory reset failed:', e);
    }

    try {
      // 2. Unregister all Service Workers
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } catch (e) {
      console.warn('[useRegisterSW] SW unregister during factory reset failed:', e);
    }

    try {
      // 3. Nuke the main budget localStorage key (and known legacy keys)
      localStorage.removeItem('sat-sorter-budget');
      localStorage.removeItem('sat-sorter:payment-methods');
      // Remove any other sat-sorter keys we know about
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sat-sorter')) {
          try { localStorage.removeItem(key); } catch {}
        }
      });
    } catch (e) {
      console.warn('[useRegisterSW] localStorage clear during factory reset failed:', e);
    }

    // 4. Hard reload to a clean state
    window.location.href = window.location.origin + window.location.pathname;
  }, []);

  return {
    needRefresh,
    updateSW,

    /**
     * Soft Reset — Recommended normal reload.
     * Gets the latest code using the normal Service Worker flow.
     * Safe: does NOT delete any of your local budget data.
     */
    softReset: updateApp,

    /**
     * Hard Reset — Force fresh code from the server.
     * Always bypasses browser cache to download the newest app files.
     * Safe: does NOT delete any of your local budget data.
     */
    hardReset: refreshApp,

    /**
     * Total Reset (⚠️ Nuclear) — Deletes all local data.
     *
     * This permanently deletes the budget saved on this device.
     *
     * Only safe if:
     * - You are logged in with Nostr, AND
     * - You have successfully backed up / synced your budget to the cloud.
     *
     * In guest mode or without a backup → all your budgets will be lost forever.
     */
    totalReset: factoryResetApp,
  };
}
