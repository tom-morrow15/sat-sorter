import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Check, Loader2, AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  isLoggedIn: boolean;
  lastSyncedAt?: number | null;
  onRefresh?: () => void;
}

/**
 * Simple sync status indicator for relay-first sync.
 * Shows the current sync state - no manual push/pull needed.
 */
export function SyncStatusIndicator({
  status,
  isLoggedIn,
  lastSyncedAt,
  onRefresh,
}: SyncStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccess, setShowSuccess] = useState(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show success checkmark briefly after sync completes
  useEffect(() => {
    if (status === 'synced') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Format last synced time
  const getLastSyncedText = () => {
    if (!lastSyncedAt) return 'Never synced';
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - lastSyncedAt;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // If not logged in, don't show anything (sync only works when logged in)
  if (!isLoggedIn) {
    return null;
  }

  // Determine the icon and styling based on state
  const getIconAndStyle = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        bgColor: 'bg-muted text-muted-foreground',
        tooltip: 'Offline - changes will sync when you reconnect',
      };
    }

    if (status === 'loading') {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        bgColor: 'bg-primary/10 text-primary',
        tooltip: 'Loading your budget...',
      };
    }

    if (status === 'saving') {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        bgColor: 'bg-primary/10 text-primary',
        tooltip: 'Saving changes...',
      };
    }

    if (status === 'error') {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        bgColor: 'bg-destructive/10 text-destructive',
        tooltip: 'Sync error - tap to retry',
      };
    }

    if (showSuccess) {
      return {
        icon: <Check className="h-4 w-4" />,
        bgColor: 'bg-green-500/10 text-green-600',
        tooltip: 'Saved!',
      };
    }

    return {
      icon: <Cloud className="h-4 w-4" />,
      bgColor: 'bg-muted text-muted-foreground',
      tooltip: `Auto-synced ${getLastSyncedText()}`,
    };
  };

  const { icon, bgColor, tooltip } = getIconAndStyle();

  return (
    <div
      className="fixed z-40"
      style={{
        bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4rem)',
        right: 'max(1.5rem, env(safe-area-inset-right))',
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={status === 'error' ? onRefresh : undefined}
            className={cn(
              'h-10 w-10 rounded-full shadow-md',
              'flex items-center justify-center transition-all duration-200',
              bgColor,
              status === 'error' && 'cursor-pointer hover:bg-destructive/20',
              status !== 'error' && 'cursor-default'
            )}
            disabled={status !== 'error'}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
