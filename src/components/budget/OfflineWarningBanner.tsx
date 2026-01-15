import { WifiOff, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OfflineWarningBannerProps {
  isSharedBudget: boolean;
  hasPendingChanges?: boolean;
}

export function OfflineWarningBanner({ 
  isSharedBudget, 
  hasPendingChanges = false 
}: OfflineWarningBannerProps) {
  if (!isSharedBudget) {
    // Simple offline banner for non-shared budgets
    return (
      <Alert className="border-gray-300 bg-gray-50 dark:bg-gray-900/50">
        <WifiOff className="h-4 w-4 text-gray-500" />
        <AlertDescription className="text-sm text-gray-600 dark:text-gray-400">
          You're offline. Changes will sync when you reconnect.
        </AlertDescription>
      </Alert>
    );
  }

  // More prominent warning for shared budgets
  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
        <strong>You're offline with a shared budget.</strong>
        {' '}
        {hasPendingChanges ? (
          <>
            You have unsaved changes. If your partner edits while you're offline, 
            you'll need to resolve conflicts when you reconnect.
          </>
        ) : (
          <>
            Changes you make now may conflict with your partner's edits. 
            Coordinate before making big changes offline.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
