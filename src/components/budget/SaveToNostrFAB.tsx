import { useState, useEffect, useCallback } from 'react';
import { Cloud, Loader2, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useManualSync } from '@/hooks/useManualSync';
import { MergeConflictDialog } from './MergeConflictDialog';
import { SyncHistoryDialog } from './SyncHistoryDialog';
import type { BudgetState } from '@/lib/budgetTypes';
import { createSnapshot, formatSyncTime, getSyncStatusMessage, BudgetSnapshot } from '@/lib/budgetVersioning';

interface SaveToNostrFABProps {
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onOpenSyncDialog?: () => void;
}

type SaveState = 'ready' | 'saving' | 'success' | 'error' | 'not-logged-in';

export function SaveToNostrFAB({ onSaveStart, onSaveComplete, onOpenSyncDialog }: SaveToNostrFABProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  
  const { pushToCloud, pullFromCloud, checkSyncStatus, canSync, isSyncing, syncStatus, localSnapshot, cloudSnapshot } = useManualSync();
  
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Update sync status on mount and when local budget changes
  useEffect(() => {
    const initializeSync = async () => {
      if (!canSync || !localBudget.budgets.length) return;

      const snapshot = await createSnapshot(localBudget, []);
      checkSyncStatus(snapshot);
    };

    initializeSync();
  }, [canSync, localBudget, checkSyncStatus]);

  const handleConflictResolve = useCallback(async (choice: 'local' | 'cloud') => {
    setIsResolvingConflict(true);

    try {
      if (choice === 'cloud' && cloudSnapshot) {
        // Pull cloud version (overwrite local)
        const restored = await pullFromCloud();
        if (restored) {
          setLocalBudget(prev => ({
            ...prev,
            budgets: restored.budgets,
            currentMonth: restored.currentMonth,
          }));
          toast({
            title: '✅ Cloud version restored',
            description: `Version ${restored.version} is now active.`,
          });
        }
      } else if (choice === 'local' && localSnapshot) {
        // Push local version (overwrite cloud)
        const success = await pushToCloud(localSnapshot);
        if (success) {
          toast({
            title: '✅ Local version synced',
            description: `Version ${localSnapshot.version} pushed to cloud.`,
          });
        }
      }
      setShowMergeDialog(false);
    } catch (error) {
      toast({
        title: 'Resolution failed',
        description: error instanceof Error ? error.message : 'Failed to resolve conflict.',
        variant: 'destructive',
      });
    } finally {
      setIsResolvingConflict(false);
    }
  }, [cloudSnapshot, localSnapshot, pullFromCloud, pushToCloud, setLocalBudget, toast]);

  const handleRestoreVersion = useCallback(async (snapshot: BudgetSnapshot) => {
    try {
      setLocalBudget(prev => ({
        ...prev,
        budgets: snapshot.budgets,
        currentMonth: snapshot.currentMonth,
      }));
      toast({
        title: '✅ Version restored',
        description: `Version ${snapshot.version} is now active.`,
      });
      setShowHistoryDialog(false);
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Failed to restore version.',
        variant: 'destructive',
      });
    }
  }, [setLocalBudget, toast]);

  const handleSave = async () => {
    if (!user?.pubkey) {
      setSaveState('not-logged-in');
      toast({
        title: 'Log in required',
        description: 'Log in with Nostr to save your budget to the cloud.',
        variant: 'destructive',
      });
      setTimeout(() => setSaveState('ready'), 3000);
      return;
    }

    if (!canSync) {
      toast({
        title: 'Encryption not available',
        description: 'Your Nostr signer does not support encryption. Try a different signer.',
        variant: 'destructive',
      });
      return;
    }

    setSaveState('saving');
    onSaveStart?.();

    try {
      const snapshot = await createSnapshot(localBudget, [], syncStatus?.cloudChecksum);

      // Check for conflicts before pushing
      if (syncStatus?.status === 'cloud-newer' && cloudSnapshot) {
        setShowMergeDialog(true);
        setSaveState('ready');
        onSaveComplete?.();
        return;
      }

      const success = await pushToCloud(snapshot);

      if (success) {
        setSaveState('success');
        toast({
          title: '✅ Saved to Nostr!',
          description: `Version ${snapshot.version} backed up. Synced: ${formatSyncTime(snapshot.createdAt)}`,
        });

        setTimeout(() => {
          setSaveState('ready');
          onSaveComplete?.();
        }, 2000);
      } else {
        setSaveState('error');
        toast({
          title: 'Save failed',
          description: 'Could not upload to Nostr. Check your connection and try again.',
          variant: 'destructive',
        });

        setTimeout(() => setSaveState('ready'), 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });

      setTimeout(() => setSaveState('ready'), 3000);
    }
  };

  const getIcon = () => {
    switch (saveState) {
      case 'saving':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
      case 'not-logged-in':
        return <Cloud className="h-5 w-5" />;
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  const getLabel = () => {
    switch (saveState) {
      case 'saving':
        return 'Saving...';
      case 'success':
        return 'Saved!';
      case 'error':
        return 'Failed';
      case 'not-logged-in':
        return 'Login';
      default:
        return 'Save';
    }
  };

  const getTooltip = () => {
    let status = '';

    if (syncStatus) {
      status = getSyncStatusMessage(syncStatus);
    }

    switch (saveState) {
      case 'saving':
        return 'Uploading your budget to Nostr...';
      case 'success':
        return `Saved! Version ${syncStatus?.localVersion || 1}`;
      case 'error':
        return 'Upload failed. Click to try again.';
      case 'not-logged-in':
        return 'Log in with Nostr to save to cloud';
      default:
        return status ? `Click to save. ${status}` : 'Save your budget to Nostr cloud';
    }
  };

  const getButtonVariant = () => {
    switch (saveState) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'not-logged-in':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getButtonClass = () => {
    let baseClass = 'fixed z-40 rounded-full shadow-lg h-14 w-14 flex items-center justify-center transition-all duration-200';

    switch (saveState) {
      case 'saving':
        return baseClass + ' bg-blue-600 hover:bg-blue-700';
      case 'success':
        return baseClass + ' bg-green-600 hover:bg-green-700';
      case 'error':
        return baseClass + ' bg-red-600 hover:bg-red-700';
      case 'not-logged-in':
        return baseClass + ' bg-gray-500 hover:bg-gray-600';
      default:
        return baseClass + ' bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <>
      <div className="flex items-center gap-2" style={{
        position: 'fixed',
        bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 72px)',
        right: 'max(1.5rem, env(safe-area-inset-right))',
        zIndex: 40,
      }}>
        {/* Info about sync status */}
        {syncStatus && syncStatus.status !== 'synced' && user && (
          <div className="bg-background border rounded-lg px-3 py-2 text-xs max-w-xs">
            <p className="font-medium">{getSyncStatusMessage(syncStatus)}</p>
            {syncStatus.cloudTimestamp && (
              <p className="text-muted-foreground text-[10px]">
                Last cloud: {formatSyncTime(syncStatus.cloudTimestamp)}
              </p>
            )}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSave}
              disabled={saveState === 'saving' || isSyncing || !user}
              variant={getButtonVariant()}
              size="lg"
              className={getButtonClass()}
            >
              {getIcon()}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="mb-2">
            <p>{getTooltip()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Open history dialog button */}
        {user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setShowHistoryDialog(true)}
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-lg"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Sync history & details</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Merge Conflict Dialog */}
      {localSnapshot && cloudSnapshot && (
        <MergeConflictDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          localVersion={localSnapshot}
          cloudVersion={cloudSnapshot}
          onResolve={handleConflictResolve}
          isResolving={isResolvingConflict}
        />
      )}

      {/* Sync History Dialog */}
      <SyncHistoryDialog
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
        localVersion={localSnapshot}
        cloudVersion={cloudSnapshot}
        onRestore={handleRestoreVersion}
      />
    </>
  );
}
