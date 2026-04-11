import React, { useState, useEffect, useRef } from 'react';
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

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { currentBudget } = useBudget();
  const [saveState, setSaveState] = useState<SaveState>('ready');
  const lastSavedBudgetRef = useRef<string>('');
  
  const { uploadBudget } = useBudgetSync();
  
  const [localBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Track when budget changes and mark as unsaved
  useEffect(() => {
    if (!user?.pubkey) {
      lastSavedBudgetRef.current = '';
      return;
    }

    const currentBudgetStr = JSON.stringify(currentBudget);

    if (!lastSavedBudgetRef.current) {
      lastSavedBudgetRef.current = currentBudgetStr;
      setSaveState('ready');
      return;
    }

    if (currentBudgetStr !== lastSavedBudgetRef.current) {
      setSaveState('unsaved');
    }
  }, [currentBudget, user?.pubkey]);

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

    try {
      const success = await uploadBudget(localBudget);
      
      if (success) {
        setSaveState('success');
        lastSavedBudgetRef.current = JSON.stringify(currentBudget);
        
        toast({
          title: '✅ Saved to Nostr!',
          description: `${localBudget.budgets.length} month(s) backed up to the cloud.`,
        });

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

        setTimeout(() => setSaveState('unsaved'), 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });

      setTimeout(() => setSaveState('unsaved'), 3000);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/breakdown', icon: PieChart, label: 'Breakdown' },
    { path: '/local-spend', icon: MapPin, label: 'Local' },
    { path: '/transactions', icon: Receipt, label: 'Receipts' },
  ];

  const getSaveColor = () => {
    switch (saveState) {
      case 'success': return 'text-green-500';
      case 'error':
      case 'unsaved': return 'text-red-500';
      case 'saving': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
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

        {/* Save button */}
        {user && (
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
              getSaveColor(),
              saveState === 'saving' && 'opacity-60'
            )}
          >
            <Cloud className={cn('h-5 w-5', saveState === 'saving' && 'animate-pulse')} />
            <span className="text-[10px] leading-tight">
              {saveState === 'saving' ? 'Saving' : saveState === 'success' ? 'Saved!' : 'Save'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
