import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface OfflineWarningBannerProps {
  isSharedBudget: boolean;
  hasPendingChanges?: boolean;
  offlineChangesMade?: boolean;
  isBackOnline?: boolean;
  onSyncNow?: () => void;
  onDiscardChanges?: () => void;
}

export function OfflineWarningBanner({ 
  isSharedBudget, 
  hasPendingChanges = false,
  offlineChangesMade = false,
  isBackOnline = false,
  onSyncNow,
  onDiscardChanges,
}: OfflineWarningBannerProps) {
  // Case 1: Back online with offline changes on shared budget - need user action
  if (isBackOnline && offlineChangesMade && isSharedBudget) {
    return (
      <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              You made changes while offline
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Your partner may have also made changes. Before syncing:
            </p>
            <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside space-y-1">
              <li>Check with your partner if they made changes</li>
              <li>Review your changes below before syncing</li>
              <li>If there's a conflict, you'll choose which version to keep</li>
            </ul>
            <div className="flex gap-2 pt-2">
              {onSyncNow && (
                <Button size="sm" onClick={onSyncNow} className="gap-1.5">
                  <RefreshCw className="h-3 w-3" />
                  Sync Now
                </Button>
              )}
              {onDiscardChanges && (
                <Button size="sm" variant="outline" onClick={onDiscardChanges}>
                  Discard My Changes
                </Button>
              )}
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Case 2: Currently offline with shared budget
  if (!isBackOnline && isSharedBudget) {
    return (
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <WifiOff className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              You're offline with a shared budget
            </p>
            {hasPendingChanges || offlineChangesMade ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>You have unsaved changes.</strong> If your partner edits while you're offline, 
                you'll need to resolve conflicts when you reconnect. Consider waiting until you're 
                back online to make changes.
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Changes you make now won't sync until you're back online. If your partner is also 
                making changes, you may have conflicts to resolve. <strong>Tip:</strong> Coordinate 
                with your partner before making offline changes.
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Case 3: Simple offline banner for non-shared budgets
  if (!isBackOnline) {
    return (
      <Alert className="border-gray-300 bg-gray-50 dark:bg-gray-900/50">
        <WifiOff className="h-4 w-4 text-gray-500" />
        <AlertDescription className="text-sm text-gray-600 dark:text-gray-400">
          You're offline. Changes will sync when you reconnect.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
