import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, MapPin, Receipt, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import type { BudgetState } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

type SaveState = 'ready' | 'saving' | 'success' | 'error' | 'unsaved';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}

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
    // Only track changes if user is logged in
    if (!user?.pubkey) {
      lastSavedBudgetRef.current = '';
      return;
    }

    // Convert current budget to string for comparison
    const currentBudgetStr = JSON.stringify(currentBudget);

    // If last saved is empty, initialize it (first load)
    if (!lastSavedBudgetRef.current) {
      lastSavedBudgetRef.current = currentBudgetStr;
      setSaveState('ready');
      return;
    }

    // Check if budget has changed since last save
    if (currentBudgetStr !== lastSavedBudgetRef.current) {
      setSaveState('unsaved');
    }
  }, [currentBudget, user?.pubkey]);

  const navItems: NavItem[] = [
    {
      path: '/home',
      icon: <Home className="h-5 w-5" />,
      label: 'Home',
      tooltip: 'Budget overview',
    },
    {
      path: '/breakdown',
      icon: <PieChart className="h-5 w-5" />,
      label: 'Breakdown',
      tooltip: 'Spending breakdown',
    },
    {
      path: '/local-spend',
      icon: <MapPin className="h-5 w-5" />,
      label: 'Local',
      tooltip: 'Spend Bitcoin locally',
    },
    {
      path: '/transactions',
      icon: <Receipt className="h-5 w-5" />,
      label: 'Transactions',
      tooltip: 'All transactions',
    },
  ];

  const isActive = (path: string) => location.pathname === path;

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
        // Update last saved reference
        lastSavedBudgetRef.current = JSON.stringify(currentBudget);
        
        toast({
          title: '✅ Saved to Nostr!',
          description: `${localBudget.budgets.length} month(s) backed up to the cloud.`,
        });

        // Reset to ready after 2 seconds
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

        // Reset to unsaved after 3 seconds
        setTimeout(() => setSaveState('unsaved'), 3000);
      }
    } catch (error) {
      setSaveState('error');
      toast({
        title: 'Save error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });

      // Reset to unsaved after 3 seconds
      setTimeout(() => setSaveState('unsaved'), 3000);
    }
  };

  const getSaveIcon = () => {
    switch (saveState) {
      case 'saving':
        return (
          <div className="animate-spin">
            <Cloud className="h-5 w-5" />
          </div>
        );
      case 'success':
        return <Cloud className="h-5 w-5 text-green-600" />;
      case 'error':
        return <Cloud className="h-5 w-5 text-red-600" />;
      case 'unsaved':
        return <Cloud className="h-5 w-5 text-red-600" />;
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  const getSaveTooltip = () => {
    switch (saveState) {
      case 'saving':
        return 'Uploading to Nostr...';
      case 'success':
        return 'Budget backed up!';
      case 'error':
        return 'Upload failed. Click to try again.';
      case 'unsaved':
        return 'You have unsaved changes. Click to save.';
      default:
        return 'Back up to Nostr';
    }
  };



  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-2">
        {/* Navigation items */}
        <div className="flex items-center gap-1 flex-1 justify-evenly">
          {navItems.map((item) => (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive(item.path) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex flex-col items-center justify-center h-auto py-1 px-2 rounded-lg transition-all',
                    isActive(item.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span className="text-[10px] mt-0.5 leading-tight">{item.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{item.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border flex-shrink-0" />

        {/* Save button - only show if logged in */}
        {user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                variant={saveState === 'success' ? 'default' : saveState === 'error' || saveState === 'unsaved' ? 'destructive' : 'ghost'}
                size="sm"
                className={cn(
                  'flex flex-col items-center justify-center h-auto py-1 px-3 rounded-lg transition-all flex-shrink-0',
                  saveState === 'success' && 'bg-green-600 hover:bg-green-700',
                  (saveState === 'error' || saveState === 'unsaved') && 'bg-red-600 hover:bg-red-700',
                  saveState !== 'success' && saveState !== 'error' && saveState !== 'unsaved' && 'text-muted-foreground hover:text-foreground'
                )}
              >
                {getSaveIcon()}
                <span className="text-[10px] mt-0.5 leading-tight">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{getSaveTooltip()}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
