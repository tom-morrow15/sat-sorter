import { useState, useEffect, useCallback, useRef } from 'react';

// Check interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialHashRef = useRef<string | null>(null);

  useEffect(() => {
    // Get current bundle hash from the page
    const getCurrentBundleHash = () => {
      const scripts = document.querySelectorAll('script[src*="main-"]');
      for (const script of scripts) {
        const src = script.getAttribute('src');
        const match = src?.match(/main-([A-Z0-9]+)\.js/i);
        if (match) return match[1];
      }
      return null;
    };

    // Store the initial hash when the app loads
    const currentHash = getCurrentBundleHash();
    if (currentHash) {
      initialHashRef.current = currentHash;
      // Also store in localStorage for cross-session comparison
      const storedHash = localStorage.getItem('sat-sorter-bundle-hash');
      if (!storedHash) {
        localStorage.setItem('sat-sorter-bundle-hash', currentHash);
      }
    }

    // Periodically check for updates by fetching the index.html
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await response.text();

        // Look for the main JS bundle hash in the fetched HTML
        const scriptMatch = html.match(/main-([A-Z0-9]+)\.js/i);
        const newHash = scriptMatch ? scriptMatch[1] : null;

        // Compare with both the initial hash (from page load) and the stored hash
        // Only show update if the NEW hash differs from what we loaded with
        if (newHash && initialHashRef.current && newHash !== initialHashRef.current) {
          console.log('[AppUpdate] New version available', {
            current: initialHashRef.current,
            new: newHash
          });
          setUpdateAvailable(true);
        }
      } catch (error) {
        // Silently fail - network issues shouldn't show errors
        console.debug('[AppUpdate] Check failed:', error);
      }
    };

    // Initial check after 30 seconds (give the app time to settle)
    const initialTimeout = setTimeout(checkForUpdates, 30000);

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
    // Update the stored hash after reload
    localStorage.removeItem('sat-sorter-bundle-hash');
    window.location.reload();
  }, []);

  return {
    updateAvailable,
    performUpdate,
  };
}
