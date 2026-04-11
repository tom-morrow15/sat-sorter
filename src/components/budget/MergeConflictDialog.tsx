import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { BudgetSnapshot } from '@/lib/budgetVersioning';
import { formatSyncTime } from '@/lib/budgetVersioning';

interface MergeConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localVersion: BudgetSnapshot;
  cloudVersion: BudgetSnapshot;
  onResolve: (choice: 'local' | 'cloud') => void;
  isResolving?: boolean;
}

export function MergeConflictDialog({
  open,
  onOpenChange,
  localVersion,
  cloudVersion,
  onResolve,
  isResolving = false,
}: MergeConflictDialogProps) {
  const [showLocalDetails, setShowLocalDetails] = useState(false);
  const [showCloudDetails, setShowCloudDetails] = useState(false);

  const localBudgetCount = localVersion.budgets.length;
  const cloudBudgetCount = cloudVersion.budgets.length;
  
  const localTransactionCount = localVersion.budgets.reduce(
    (sum, b) => sum + (b.transactions?.length || 0),
    0
  );
  const cloudTransactionCount = cloudVersion.budgets.reduce(
    (sum, b) => sum + (b.transactions?.length || 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Budget Versions Differ
          </DialogTitle>
          <DialogDescription>
            You have different budget versions. Choose which one to keep.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            Your local version (this device) differs from the cloud version. 
            Choose which one to use.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Local Version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Local Version</h3>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                v{localVersion.version}
              </Badge>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium">Last modified:</span>
                <br />
                {formatSyncTime(localVersion.createdAt)}
              </p>
              <p>
                <span className="font-medium">Budgets:</span>
                <br />
                {localBudgetCount} month{localBudgetCount !== 1 ? 's' : ''}
              </p>
              <p>
                <span className="font-medium">Transactions:</span>
                <br />
                {localTransactionCount} total
              </p>
              <p>
                <span className="font-medium">Deletions:</span>
                <br />
                {localVersion.deletions.length} item{localVersion.deletions.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Details toggle */}
            <button
              onClick={() => setShowLocalDetails(!showLocalDetails)}
              className="w-full flex items-center justify-between text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showLocalDetails ? 'Hide' : 'Show'} Details
              {showLocalDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {/* Checksum */}
            {showLocalDetails && (
              <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                <p className="font-mono text-[10px] break-all">
                  <span className="font-medium">Checksum:</span>
                  <br />
                  {localVersion.checksum.substring(0, 32)}...
                </p>
              </div>
            )}

            <Button
              onClick={() => onResolve('local')}
              disabled={isResolving}
              className="w-full"
              variant="default"
            >
              Use This Version
            </Button>
          </div>

          {/* Cloud Version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Cloud Version</h3>
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200">
                v{cloudVersion.version}
              </Badge>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium">Last synced:</span>
                <br />
                {formatSyncTime(cloudVersion.createdAt)}
              </p>
              <p>
                <span className="font-medium">Budgets:</span>
                <br />
                {cloudBudgetCount} month{cloudBudgetCount !== 1 ? 's' : ''}
              </p>
              <p>
                <span className="font-medium">Transactions:</span>
                <br />
                {cloudTransactionCount} total
              </p>
              <p>
                <span className="font-medium">Deletions:</span>
                <br />
                {cloudVersion.deletions.length} item{cloudVersion.deletions.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Details toggle */}
            <button
              onClick={() => setShowCloudDetails(!showCloudDetails)}
              className="w-full flex items-center justify-between text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showCloudDetails ? 'Hide' : 'Show'} Details
              {showCloudDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {/* Checksum */}
            {showCloudDetails && (
              <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                <p className="font-mono text-[10px] break-all">
                  <span className="font-medium">Checksum:</span>
                  <br />
                  {cloudVersion.checksum.substring(0, 32)}...
                </p>
              </div>
            )}

            <Button
              onClick={() => onResolve('cloud')}
              disabled={isResolving}
              className="w-full"
              variant="outline"
            >
              Use This Version
            </Button>
          </div>
        </div>

        {/* Difference Summary */}
        {(localBudgetCount !== cloudBudgetCount ||
          localTransactionCount !== cloudTransactionCount ||
          localVersion.deletions.length !== cloudVersion.deletions.length) && (
          <Alert className="bg-blue-50 dark:bg-blue-950/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-blue-900 dark:text-blue-200 text-sm">
              <strong>Differences detected:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                {localBudgetCount !== cloudBudgetCount && (
                  <li>
                    Budgets: Local has {localBudgetCount}, Cloud has {cloudBudgetCount}
                  </li>
                )}
                {localTransactionCount !== cloudTransactionCount && (
                  <li>
                    Transactions: Local has {localTransactionCount}, Cloud has {cloudTransactionCount}
                  </li>
                )}
                {localVersion.deletions.length !== cloudVersion.deletions.length && (
                  <li>
                    Deletions: Local has {localVersion.deletions.length}, Cloud has{' '}
                    {cloudVersion.deletions.length}
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResolving}
          >
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground flex-1">
            You can always switch back later by checking version history.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
