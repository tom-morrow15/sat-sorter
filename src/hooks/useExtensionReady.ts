import { useState, useEffect } from 'react';

/**
 * Hook that detects when the Nostr browser extension (NIP-07) is ready.
 * 
 * Browser extensions inject window.nostr asynchronously, so it may not be
 * available immediately when the page loads. This hook polls for the extension
 * and returns true once it's available and ready for use.
 * 
 * @param maxWaitMs Maximum time to wait for extension (default 3000ms)
 * @returns Object with isReady (extension available) and isChecking (still waiting)
 */
export function useExtensionReady(maxWaitMs = 3000) {
  const [isReady, setIsReady] = useState(() => {
    // Check immediately on mount
    return typeof window !== 'undefined' && 'nostr' in window && window.nostr !== undefined;
  });
  const [isChecking, setIsChecking] = useState(!isReady);

  useEffect(() => {
    // If already ready, nothing to do
    if (isReady) {
      setIsChecking(false);
      return;
    }

    // Poll for the extension
    const startTime = Date.now();
    const pollInterval = 100; // Check every 100ms

    const checkExtension = () => {
      if ('nostr' in window && window.nostr !== undefined) {
        setIsReady(true);
        setIsChecking(false);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkExtension()) return;

    const intervalId = setInterval(() => {
      if (checkExtension()) {
        clearInterval(intervalId);
        return;
      }

      // Stop checking after max wait time
      if (Date.now() - startTime >= maxWaitMs) {
        clearInterval(intervalId);
        setIsChecking(false);
        console.log('[ExtensionReady] Timed out waiting for extension');
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [isReady, maxWaitMs]);

  return { isReady, isChecking };
}
