import { useState, useEffect } from 'react';
import { Cloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import type { BudgetState } from '@/lib/budgetTypes';

interface SaveToNostrFABProps {
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
}

type SaveState = 'ready' | 'saving' | 'success' | 'error';

export function SaveToNostrFAB({ onSaveStart, onSaveComplete }: SaveToNostrFABProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [saveState, setSaveState] = useState<SaveState>('ready');
  
  const { uploadBudget, syncStatus } = useBudgetSync();
  
  const [localBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Show success briefly if auto-saved
  useEffect(() => {
    if (syncStatus.lastSynced && saveState === 'ready') {
      // Budget was auto-saved by background sync
      const now = Math.floor(Date.now() / 1000);
      const secondsAgo = now - syncStatus.lastSynced;
      if (secondsAgo < 3) {
        setSaveState('success');
        setTimeout(() => setSaveState('ready'), 2000);
      }
    }
  }, [syncStatus.lastSynced, saveState]);

  const handleSave = async () => {
    if (!user?.pubkey) {
      toast({
        title: 'Log in required',
        description: 'You need to be logged in with Nostr to save to the cloud.',
        variant: 'destructive',
      });
      return;
    }

    setSaveState('saving');
    onSaveStart?.();

    try {
      const success = await uploadBudget(localBudget);
      
      if (success) {
        setSaveState('success');
        toast({
          title: '✅ Saved to Nostr!',
          description: `${localBudget.budgets.length} month(s) backed up to the cloud.`,
        });

        // Reset to ready after 2 seconds
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

        // Reset after 3 seconds
        setTimeout(() => setSaveState('ready'), 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });

      // Reset after 3 seconds
      setTimeout(() => setSaveState('ready'), 3000);
    }
  };

  // Don't show button if not logged in
  if (!user) {
    return null;
  }

  const getIcon = () => {
    switch (saveState) {
      case 'saving':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
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
      default:
        return 'Save to Nostr';
    }
  };

  const getTooltip = () => {
    switch (saveState) {
      case 'saving':
        return 'Uploading your budget to Nostr...';
      case 'success':
        return 'Budget backed up to the cloud!';
      case 'error':
        return 'Upload failed. Click to try again.';
      default:
        return 'Back up your budget to Nostr cloud. Accessible from any device.';
    }
  };

  const getButtonVariant = () => {
    switch (saveState) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          variant={getButtonVariant()}
          size="lg"
          className={`
            fixed z-40 rounded-full shadow-lg h-14 w-14
            flex items-center justify-center
            transition-all duration-200
            ${saveState === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            ${saveState === 'error' ? 'bg-red-600 hover:bg-red-700' : ''}
          `}
          style={{
            bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 72px)',
            right: 'max(1.5rem, env(safe-area-inset-right))',
          }}
        >
          {getIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="mb-2">
        <p>{getTooltip()}</p>
        {saveState === 'ready' && (
          <p className="text-xs text-muted-foreground mt-1">💾 Floppy disk</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
