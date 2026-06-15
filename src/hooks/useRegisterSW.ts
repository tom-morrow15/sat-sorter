import { useState, useEffect } from 'react';

export function useRegisterSW() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Register service worker if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every 60 seconds

          // Prompt user to refresh when new SW is ready
          registration.addEventListener('controllerchange', () => {
            setNeedRefresh(true);
          });

          setUpdateSW(() => async () => {
            await registration.update();
            // Reload after a short delay to ensure SW is updated
            setTimeout(() => window.location.reload(), 100);
          });
        })
        .catch(() => {
          // Service worker registration failed, continue without it
        });
    }
  }, []);

  return { needRefresh, updateSW };
}
