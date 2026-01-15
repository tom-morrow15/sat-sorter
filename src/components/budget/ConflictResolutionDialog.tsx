import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CloudDownload,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Edit,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuthor } from '@/hooks/useAuthor';
import {
  type BudgetState,
  type BudgetDiff,
  computeBudgetDiff,
} from '@/lib/budgetTypes';
import { formatSats } from '@/hooks/useBitcoinPrice';

interface ConflictInfo {
  localVersion: number;
  remoteVersion: number;
  remoteEditedBy: string;
  remoteEditedAt: number;
  remoteBudget: BudgetState;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  conflictInfo: ConflictInfo | null;
  localState: BudgetState;
  onUseRemote: () => void;
  onKeepLocal: () => Promise<boolean>;
  onMergeBoth: (merged: BudgetState) => Promise<boolean>;
  onDismiss: () => void;
}

export function ConflictResolutionDialog({
  open,
  conflictInfo,
  localState,
  onUseRemote,
  onKeepLocal,
  onMergeBoth,
  onDismiss,
}: ConflictResolutionDialogProps) {
  const author = useAuthor(conflictInfo?.remoteEditedBy || '');
  const [showDiff, setShowDiff] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Compute diff between local and remote budgets
  const diff = useMemo((): BudgetDiff | null => {
    if (!conflictInfo) return null;

    const currentMonth = localState.currentMonth;
    const localBudget = localState.budgets.find(b => b.month === currentMonth);
    const remoteBudget = conflictInfo.remoteBudget.budgets.find(b => b.month === currentMonth);

    return computeBudgetDiff(localBudget, remoteBudget);
  }, [conflictInfo, localState]);

  const hasChanges = diff && (
    diff.lineItemChanges.length > 0 ||
    diff.transactionChanges.length > 0 ||
    diff.bucketChanges.length > 0
  );

  if (!conflictInfo) return null;

  const partnerName = author.data?.metadata?.name ||
    author.data?.metadata?.display_name ||
    'Your budget partner';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleKeepLocal = async () => {
    await onKeepLocal();
  };

  const handleMergeBoth = async () => {
    if (!conflictInfo) return;

    setIsMerging(true);
    try {
      // Auto-merge strategy: combine transactions from both, keep higher amounts for line items
      const currentMonth = localState.currentMonth;
      const localBudget = localState.budgets.find(b => b.month === currentMonth);
      const remoteBudget = conflictInfo.remoteBudget.budgets.find(b => b.month === currentMonth);

      if (!localBudget || !remoteBudget) {
        // Can't merge - fall back to one or the other
        await onKeepLocal();
        return;
      }

      // Merge transactions: combine all unique transactions
      const mergedTransactionIds = new Set<string>();
      const mergedTransactions = [
        ...localBudget.transactions,
        ...remoteBudget.transactions.filter(t => {
          if (mergedTransactionIds.has(t.id)) return false;
          mergedTransactionIds.add(t.id);
          return !localBudget.transactions.some(lt => lt.id === t.id);
        }),
      ];

      // Merge buckets: combine all unique buckets, merge line items within
      const mergedBuckets = [...localBudget.buckets];

      for (const remoteBucket of remoteBudget.buckets) {
        const existingBucket = mergedBuckets.find(b => b.name === remoteBucket.name);

        if (!existingBucket) {
          // Add new bucket from remote
          mergedBuckets.push({ ...remoteBucket });
        } else {
          // Merge line items within the bucket
          for (const remoteItem of remoteBucket.lineItems) {
            const existingItem = existingBucket.lineItems.find(li => li.name === remoteItem.name);

            if (!existingItem) {
              // Add new line item from remote
              existingBucket.lineItems.push({ ...remoteItem });
            } else if (remoteItem.plannedAmount > existingItem.plannedAmount) {
              // Keep higher amount (conservative merge)
              existingItem.plannedAmount = remoteItem.plannedAmount;
              if (remoteItem.usdAmount) {
                existingItem.usdAmount = remoteItem.usdAmount;
              }
            }
          }
        }
      }

      // Create merged budget
      const mergedMonthlyBudget = {
        ...localBudget,
        buckets: mergedBuckets,
        transactions: mergedTransactions,
      };

      // Update state with merged data
      const mergedState: BudgetState = {
        ...localState,
        budgets: localState.budgets.map(b =>
          b.month === currentMonth ? mergedMonthlyBudget : b
        ),
        version: Math.max(conflictInfo.localVersion, conflictInfo.remoteVersion) + 1,
      };

      await onMergeBoth(mergedState);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Someone else updated the budget while you were making changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Conflict explanation */}
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{partnerName}</strong> made changes at {formatTime(conflictInfo.remoteEditedAt)}.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Your version: v{conflictInfo.localVersion} → Their version: v{conflictInfo.remoteVersion}
            </p>
          </div>

          {/* Review Changes Toggle */}
          {hasChanges && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium">Review Changes</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {(diff?.lineItemChanges.length || 0) + (diff?.transactionChanges.length || 0) + (diff?.bucketChanges.length || 0)} changes
                </Badge>
                {showDiff ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
          )}

          {/* Diff View */}
          {showDiff && diff && (
            <ScrollArea className="max-h-[200px] rounded-lg border">
              <div className="p-3 space-y-3">
                {/* Bucket changes */}
                {diff.bucketChanges.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Categories</p>
                    {diff.bucketChanges.map((change, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        <Plus className="h-3 w-3 text-green-500" />
                        <span>{change.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {change.isLocal ? 'Your change' : `${partnerName}'s change`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Line item changes */}
                {diff.lineItemChanges.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Budget Amounts</p>
                    {diff.lineItemChanges.map((change, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        {change.type === 'added' ? (
                          <Plus className="h-3 w-3 text-green-500" />
                        ) : change.type === 'modified' ? (
                          <Edit className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Minus className="h-3 w-3 text-red-500" />
                        )}
                        <span className="truncate">{change.bucketName} → {change.lineItemName}</span>
                        {change.type === 'modified' && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {formatSats(change.localAmount || 0)}
                            <ArrowRight className="h-3 w-3" />
                            {formatSats(change.remoteAmount || 0)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Transaction changes */}
                {diff.transactionChanges.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Transactions</p>
                    {diff.transactionChanges.slice(0, 5).map((change, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        <Plus className="h-3 w-3 text-green-500" />
                        <span className="truncate flex-1">{change.description}</span>
                        <span className="text-xs font-mono">{formatSats(change.amount)}</span>
                        <Badge variant="outline" className="text-xs">
                          {change.isLocal ? 'You' : partnerName}
                        </Badge>
                      </div>
                    ))}
                    {diff.transactionChanges.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{diff.transactionChanges.length - 5} more transactions
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <Separator />

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">How would you like to resolve this?</p>

            {/* Merge Both - NEW */}
            <button
              onClick={handleMergeBoth}
              disabled={isMerging}
              className="w-full p-4 text-left rounded-lg border-2 border-primary/30 hover:border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Merge Both Versions</p>
                  <p className="text-xs text-muted-foreground">
                    Combine all transactions and use the higher budget amounts. Recommended.
                  </p>
                </div>
              </div>
            </button>

            {/* Use Remote */}
            <button
              onClick={onUseRemote}
              className="w-full p-4 text-left rounded-lg border-2 border-transparent hover:border-primary/50 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <CloudDownload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Use Their Version</p>
                  <p className="text-xs text-muted-foreground">
                    Discard your local changes and use the latest version from {partnerName}.
                  </p>
                </div>
              </div>
            </button>

            {/* Keep Local */}
            <button
              onClick={handleKeepLocal}
              className="w-full p-4 text-left rounded-lg border-2 border-transparent hover:border-primary/50 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Keep My Version</p>
                  <p className="text-xs text-muted-foreground">
                    Overwrite their changes with yours. Their recent edits will be lost.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Tip */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> To avoid conflicts, coordinate with your budget partner
              before making changes, especially when editing the same categories.
            </p>
          </div>
        </div>

        {/* Dismiss */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4 mr-2" />
            Decide Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
