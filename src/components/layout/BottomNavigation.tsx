import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, MapPin, Receipt, Cloud } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import type { BudgetState } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

type SaveState = 'ready' | 'saving' | 'success' | 'error' | 'unsaved';

// Key for storing last saved budget hash in localStorage
const LAST_SAVED_HASH_KEY = 'sat-sorter-last-saved-hash';

// Generate a hash of the budget for comparison
function generateBudgetHash(budget: BudgetState): string {
  // Sort keys to ensure consistent hashing
  const sorted = JSON.stringify(budget, Object.keys(budget).sort());
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { currentBudget } = useBudget();
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [lastSavedHash, setLastSavedHash] = useLocalStorage<string>(LAST_SAVED_HASH_KEY, '');
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  const { uploadBudget } = useBudgetSync();
  
  const [localBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Track when budget changes and mark as unsaved
  useEffect(() => {
    // Skip first render - just record initial state
    if (isFirstLoad) {
      setIsFirstLoad(false);
      // If we don't have a saved hash yet, record current state as "saved"
      if (!lastSavedHash) {
        const hash = generateBudgetHash(currentBudget);
        setLastSavedHash(hash);
      }
      return;
    }

    // Compare current budget to last saved
    const currentHash = generateBudgetHash(currentBudget);
    
    if (currentHash !== lastSavedHash) {
      setSaveState('unsaved');
    } else {
      setSaveState('ready');
    }
  }, [currentBudget, lastSavedHash, isFirstLoad, setLastSavedHash]);

  const handleSave = useCallback(async () => {
    if (!user?.pubkey) {
      toast({
        title: 'Log in required',
        description: 'You need to be logged in with Nostr to save to the cloud.',
        variant: 'destructive',
      });
      return;
    }

    // Don't save if already up to date
    const currentHash = generateBudgetHash(currentBudget);
    if (currentHash === lastSavedHash && saveState === 'ready') {
      toast({
        title: 'Already saved',
        description: 'Your budget is already up to date.',
      });
      return;
    }

    setSaveState('saving');

    try {
      const success = await uploadBudget(localBudget);
      
      if (success) {
        // Update the saved hash
        const newHash = generateBudgetHash(currentBudget);
        setLastSavedHash(newHash);
        setSaveState('success');
        
        toast({
          title: '✅ Saved to Nostr!',
          description: `${localBudget.budgets.length} month(s) backed up to the cloud.`,
        });

        // Return to ready after 2 seconds
        setTimeout(() => {
          setSaveState('ready');
        }, 2000);
      } else {
        setSaveState('error');
        toast({
          title: 'Save failed',
          description: 'Could not upload to Nostr. Check your connection and try again.',
          variant: 'destructive',
        });

        // Return to unsaved after 3 seconds (keeps red state)
        setTimeout(() => {
          if (generateBudgetHash(currentBudget) !== lastSavedHash) {
            setSaveState('unsaved');
          }
        }, 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });

      // Return to unsaved after 3 seconds
      setTimeout(() => {
        if (generateBudgetHash(currentBudget) !== lastSavedHash) {
          setSaveState('unsaved');
        }
      }, 3000);
    }
  }, [user?.pubkey, currentBudget, lastSavedHash, localBudget, uploadBudget, toast, setLastSavedHash, saveState]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/breakdown', icon: PieChart, label: 'Breakdown' },
    { path: '/local-spend', icon: MapPin, label: 'Local' },
    { path: '/transactions', icon: Receipt, label: 'Receipts' },
  ];

  const getSaveStyles = () => {
    switch (saveState) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'unsaved':
        return 'text-red-600 animate-pulse';
      case 'saving':
        return 'text-muted-foreground opacity-60';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSaveLabel = () => {
    switch (saveState) {
      case 'saving':
        return 'Saving...';
      case 'success':
        return 'Saved!';
      case 'error':
        return 'Error';
      case 'unsaved':
        return '• Save';
      default:
        return 'Save';
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight">{item.label}</span>
            </button>
          );
        })}

        {/* Save button - ALWAYS SHOW */}
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
            getSaveStyles()
          )}
        >
          <div className="relative">
            <Cloud className="h-5 w-5" />
            {/* Red dot indicator when unsaved */}
            {saveState === 'unsaved' && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-background" />
            )}
          </div>
          <span className="text-[10px] leading-tight font-medium">
            {getSaveLabel()}
          </span>
        </button>
      </div>
    </nav>
  );
}
