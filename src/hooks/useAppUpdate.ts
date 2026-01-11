import { useState, useEffect, useCallback } from 'react';

// Build version - this changes with each deployment
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || Date.now().toString();

// Check interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Store the current version on first load
    const storedVersion = localStorage.getItem('sat-sorter-version');
    
    if (!storedVersion) {
      localStorage.setItem('sat-sorter-version', BUILD_VERSION);
      return;
    }

    // If version has changed, show update prompt
    if (storedVersion !== BUILD_VERSION) {
      console.log('[AppUpdate] New version detected', { old: storedVersion, new: BUILD_VERSION });
      setUpdateAvailable(true);
      localStorage.setItem('sat-sorter-version', BUILD_VERSION);
    }

    // Periodically check for updates
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await response.text();
        
        // Look for the main JS bundle hash
        const scriptMatch = html.match(/main-([A-Z0-9]+)\.js/i);
        const newHash = scriptMatch ? scriptMatch[1] : null;
        
        const storedHash = localStorage.getItem('sat-sorter-bundle-hash');
        
        if (newHash && storedHash && newHash !== storedHash) {
          console.log('[AppUpdate] Bundle hash changed', { old: storedHash, new: newHash });
          setUpdateAvailable(true);
        }
        
        if (newHash) {
          localStorage.setItem('sat-sorter-bundle-hash', newHash);
        }
      } catch (error) {
        console.warn('[AppUpdate] Failed to check for updates:', error);
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkForUpdates, 10000);
    
    // Periodic checks
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const performUpdate = useCallback(() => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Clear the stored hash so we re-check after reload
    localStorage.removeItem('sat-sorter-bundle-hash');
    window.location.reload();
  }, []);

  return {
    updateAvailable,
    performUpdate,
  };
}
