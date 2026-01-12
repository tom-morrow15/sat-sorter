import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Check, Loader2, RefreshCw, AlertCircle, Wifi, WifiOff, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncFABProps {
  syncStatus: SyncStatus;
  hasUnsyncedChanges: boolean;
  canSync: boolean;
  onSync: () => void;
  onPull?: () => void;
  isLoggedIn: boolean;
  onLoginClick?: () => void;
  lastSyncedAt?: number | null;
}

export function SyncFAB({
  syncStatus,
  hasUnsyncedChanges,
  canSync,
  onSync,
  onPull,
  isLoggedIn,
  onLoginClick,
  lastSyncedAt,
}: SyncFABProps) {
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
    if (syncStatus === 'synced') {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus]);

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

  // Determine the icon and color based on state
  const getIconAndColor = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="h-5 w-5" />,
        bgColor: 'bg-muted text-muted-foreground',
        tooltip: 'You\'re offline. Changes will sync when you reconnect.',
      };
    }

    if (!isLoggedIn) {
      return {
        icon: <CloudOff className="h-5 w-5" />,
        bgColor: 'bg-muted text-muted-foreground',
        tooltip: 'Log in with Nostr to sync across devices',
      };
    }

    if (syncStatus === 'syncing') {
      return {
        icon: <Loader2 className="h-5 w-5 animate-spin" />,
        bgColor: 'bg-primary text-primary-foreground',
        tooltip: 'Syncing your budget...',
      };
    }

    if (syncStatus === 'error') {
      return {
        icon: <AlertCircle className="h-5 w-5" />,
        bgColor: 'bg-destructive text-destructive-foreground',
        tooltip: 'Sync failed. Tap to retry.',
      };
    }

    if (showSuccess) {
      return {
        icon: <Check className="h-5 w-5" />,
        bgColor: 'bg-green-500 text-white',
        tooltip: 'Synced!',
      };
    }

    if (hasUnsyncedChanges) {
      return {
        icon: <Cloud className="h-5 w-5" />,
        bgColor: 'bg-primary text-primary-foreground animate-pulse',
        tooltip: 'Changes pending. Tap to sync now.',
      };
    }

    return {
      icon: <Cloud className="h-5 w-5" />,
      bgColor: 'bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground',
      tooltip: `Synced ${getLastSyncedText()}`,
    };
  };

  const { icon, bgColor, tooltip } = getIconAndColor();

  // Handle click based on login state
  const handleClick = () => {
    if (!isLoggedIn && onLoginClick) {
      onLoginClick();
    } else if (canSync) {
      onSync();
    }
  };

  // If user is not logged in, show simple button
  if (!isLoggedIn) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onLoginClick}
            className={cn(
              'fixed z-40',
              'h-12 w-12 rounded-full shadow-lg hover:shadow-xl',
              'flex items-center justify-center transition-all duration-200',
              bgColor,
              'active:scale-95'
            )}
            style={{
              bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4rem)',
              right: 'max(1.5rem, env(safe-area-inset-right))',
            }}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // For logged in users, show dropdown with options
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'fixed z-40',
                'h-12 w-12 rounded-full shadow-lg hover:shadow-xl',
                'flex items-center justify-center transition-all duration-200',
                bgColor,
                'active:scale-95',
                syncStatus === 'syncing' && 'pointer-events-none'
              )}
              style={{
                bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4rem)',
                right: 'max(1.5rem, env(safe-area-inset-right))',
              }}
              disabled={syncStatus === 'syncing'}
            >
              {icon}
              {/* Notification dot for unsaved changes */}
              {hasUnsyncedChanges && syncStatus !== 'syncing' && !showSuccess && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-orange-500 border-2 border-background" />
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
      
      <DropdownMenuContent align="end" side="top" className="w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {hasUnsyncedChanges ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Unsaved changes
            </span>
          ) : (
            <span>Last synced: {getLastSyncedText()}</span>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSync} disabled={!canSync || syncStatus === 'syncing'}>
          <Upload className="h-4 w-4 mr-2" />
          Push to Nostr
        </DropdownMenuItem>
        {onPull && (
          <DropdownMenuItem onClick={onPull} disabled={!canSync || syncStatus === 'syncing'}>
            <Download className="h-4 w-4 mr-2" />
            Pull from Nostr
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSync} disabled={!canSync || syncStatus === 'syncing'}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Now
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
