import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Build version - this changes with each deployment
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || Date.now().toString();

// Check interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000;

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Store the current version on first load
    const storedVersion = localStorage.getItem('sat-sorter-version');
    
    if (!storedVersion) {
      // First visit - store current version
      localStorage.setItem('sat-sorter-version', BUILD_VERSION);
      return;
    }

    // If version has changed, show update prompt
    if (storedVersion !== BUILD_VERSION) {
      console.log('[UpdatePrompt] New version detected', { old: storedVersion, new: BUILD_VERSION });
      setUpdateAvailable(true);
      localStorage.setItem('sat-sorter-version', BUILD_VERSION);
    }

    // Periodically check for updates by fetching the HTML and checking for changes
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await response.text();
        
        // Look for the main JS bundle - its hash changes with each build
        const scriptMatch = html.match(/src="\/src\/main\.tsx\?v=([^"]+)"|main-([A-Z0-9]+)\.js/);
        const newHash = scriptMatch ? (scriptMatch[1] || scriptMatch[2]) : null;
        
        const storedHash = localStorage.getItem('sat-sorter-bundle-hash');
        
        if (newHash && storedHash && newHash !== storedHash) {
          console.log('[UpdatePrompt] Bundle hash changed', { old: storedHash, new: newHash });
          setUpdateAvailable(true);
        }
        
        if (newHash) {
          localStorage.setItem('sat-sorter-bundle-hash', newHash);
        }
      } catch (error) {
        console.warn('[UpdatePrompt] Failed to check for updates:', error);
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

  const handleRefresh = () => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <Alert className="border-primary/50 bg-primary/10 shadow-lg">
        <RefreshCw className="h-4 w-4 text-primary" />
        <AlertDescription className="pr-8">
          <p className="font-medium text-sm mb-2">Update Available</p>
          <p className="text-xs text-muted-foreground mb-3">
            A new version of Sat Sorter is ready. Refresh to get the latest features and fixes.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh Now
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </AlertDescription>
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </Alert>
    </div>
  );
}
