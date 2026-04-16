import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, MapPin, Receipt, Save, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { cn } from '@/lib/utils';

type SaveState = 'ready' | 'saving' | 'success' | 'error' | 'unsaved';

// Key for localStorage
const SAVED_BUDGET_KEY = 'sat-sorter-saved-budget';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { currentMonth, currency, fullState } = useBudget();
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const [savedBudgetStr, setSavedBudgetStr] = useLocalStorage<string>(SAVED_BUDGET_KEY, '');
  const hasInitialized = useRef(false);
  
  const { uploadBudget } = useBudgetSync();

  // Current budget as string (memoized) - includes all state that should be saved
   // Note: We DON'T memoize this - we always recompute it so we can detect changes
   // Include partners and templates to detect those changes too
   const currentBudgetStr = JSON.stringify({
     budgets: fullState.budgets,
     currency: fullState.currency,
     currentMonth: fullState.currentMonth,
     partners: fullState.partners || [],
     templates: fullState.templates || [],
   });

   // Reset on user change (login/logout)
  useEffect(() => {
    if (user) {
      console.log('[SaveButton] User logged in, reinitializing save state');
      hasInitialized.current = false;
    }
  }, [user?.pubkey]);

  // Initialize and check for changes
   useEffect(() => {
     // Skip change detection during save/success/error transitions
     // to prevent the button from flashing states
     if (saveState === 'saving' || saveState === 'success' || saveState === 'error') {
       return;
     }

     // First run: initialize saved state if empty
     if (!hasInitialized.current) {
       hasInitialized.current = true;
       console.log('[SaveButton] First load, initializing with current budget');
       if (!savedBudgetStr) {
         console.log('[SaveButton] No saved budget yet, setting current as saved');
         setSavedBudgetStr(currentBudgetStr);
         setSaveState('ready');
       } else if (savedBudgetStr !== currentBudgetStr) {
         console.log('[SaveButton] Existing save found but differs, marking unsaved');
         setSaveState('unsaved');
       } else {
         setSaveState('ready');
       }
       return;
     }

     // Check if current budget matches saved budget
     if (currentBudgetStr === savedBudgetStr) {
       // Match - set to ready (grey) if not already
       if (saveState !== 'ready') {
         console.log('[SaveButton] Budget matches saved state, marking ready');
         setSaveState('ready');
       }
     } else {
       // Doesn't match - mark as unsaved (red)
       if (saveState !== 'unsaved') {
         console.log('[SaveButton] CHANGE DETECTED! Marking unsaved');
         setSaveState('unsaved');
       }
     }
   }, [currentBudgetStr, savedBudgetStr, saveState]);

  const handleSave = async () => {
    if (!user?.pubkey) {
      toast({
        title: 'Log in required',
        description: 'You need to be logged in with Nostr to save to the cloud.',
        variant: 'destructive',
      });
      return;
    }

    const currentString = currentBudgetStr;
    
    // Don't save if already saved
    if (currentString === savedBudgetStr) {
      setSaveState('ready');
      toast({ title: 'Already saved' });
      return;
    }

    setSaveState('saving');

    try {
      const success = await uploadBudget(fullState);
      
      if (success) {
        setSavedBudgetStr(currentString);
        setSaveState('success');
        
        toast({
          title: '✅ Budget saved!',
          description: 'Your budget is backed up to Nostr.',
        });

        setTimeout(() => setSaveState('ready'), 2000);
      } else {
        setSaveState('error');
        toast({
          title: 'Save failed',
          description: 'Could not upload. Please try again.',
          variant: 'destructive',
        });
        setTimeout(() => setSaveState('unsaved'), 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: 'Something went wrong.',
        variant: 'destructive',
      });
      setTimeout(() => setSaveState('unsaved'), 3000);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const getSaveButtonStyles = () => {
    switch (saveState) {
      case 'unsaved':
        return 'text-red-600 font-bold';
      case 'saving':
        return 'text-muted-foreground opacity-60';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSaveLabel = () => {
    switch (saveState) {
      case 'saving': return 'Saving';
      case 'success': return 'Saved!';
      case 'error': return 'Error';
      case 'unsaved': return 'Save*';
      default: return 'Save';
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => navigate('/home')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/home') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => navigate('/breakdown')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/breakdown') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <PieChart className="h-5 w-5" />
          <span className="text-[10px]">Breakdown</span>
        </button>

        <button
          onClick={() => navigate('/local-spend')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/local-spend') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MapPin className="h-5 w-5" />
          <span className="text-[10px]">Local</span>
        </button>

         <button
           onClick={() => navigate('/transactions')}
           className={cn(
             'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
             isActive('/transactions') ? 'text-primary' : 'text-muted-foreground'
           )}
         >
           <Receipt className="h-5 w-5" />
           <span className="text-[10px]">Receipts</span>
         </button>

         <button
           onClick={() => navigate('/wealth')}
           className={cn(
             'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
             isActive('/wealth') ? 'text-primary' : 'text-muted-foreground'
           )}
         >
           <Wallet className="h-5 w-5" />
           <span className="text-[10px]">Wealth</span>
         </button>

          <button
            onClick={handleSave}
           disabled={saveState === 'saving'}
           className={cn(
             'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all',
             getSaveButtonStyles()
           )}
         >
           <Save className={cn('h-5 w-5', saveState === 'saving' && 'animate-bounce')} />
           <span className="text-[10px]">{getSaveLabel()}</span>
         </button>
      </div>
    </nav>
  );
}
