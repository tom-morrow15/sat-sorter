import { AlertTriangle, CloudDownload, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/hooks/useAuthor';
import type { BudgetState } from '@/lib/budgetTypes';

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
  onUseRemote: () => void;
  onKeepLocal: () => Promise<boolean>;
  onDismiss: () => void;
}

export function ConflictResolutionDialog({
  open,
  conflictInfo,
  onUseRemote,
  onKeepLocal,
  onDismiss,
}: ConflictResolutionDialogProps) {
  const author = useAuthor(conflictInfo?.remoteEditedBy || '');
  
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Someone else updated the budget while you were making changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Conflict explanation */}
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{partnerName}</strong> made changes at {formatTime(conflictInfo.remoteEditedAt)}.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Your version: v{conflictInfo.localVersion} → Their version: v{conflictInfo.remoteVersion}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium">How would you like to resolve this?</p>
            
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
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4 mr-2" />
            Decide Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
