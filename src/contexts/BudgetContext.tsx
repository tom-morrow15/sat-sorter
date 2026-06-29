import { createContext, useContext, useMemo, useEffect, useRef, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  BudgetState,
  getCurrentMonth,
} from '@/lib/budgetTypes';

const DEFAULT_STATE: BudgetState = {
  currentMonth: getCurrentMonth(),
  budgets: [],
  currency: 'sats',
  accessibleBudgets: [],
};

interface BudgetContextValue {
  state: BudgetState;
  setState: (value: BudgetState | ((prev: BudgetState) => BudgetState)) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

  const MIGRATION_KEY = 'sat-sorter-partner-migration-shown';
  const PAYMENT_METHODS_MIGRATION_KEY = 'sat-sorter-payment-methods-migrated';

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<BudgetState>('sat-sorter-budget', DEFAULT_STATE);
  const hasAutoSetMonth = useRef(false);
  const hasRunMigration = useRef(false);
  const hasMigratedPaymentMethods = useRef(false);

  // ---------------------------------------------------------------------------
  // Migration: import standalone payment methods into BudgetState
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasMigratedPaymentMethods.current) return;
    hasMigratedPaymentMethods.current = true;

    // Check if already migrated (one-time operation)
    try {
      if (localStorage.getItem(PAYMENT_METHODS_MIGRATION_KEY)) return;
    } catch {
      // localStorage may not be available
    }

    try {
      const oldRaw = localStorage.getItem('sat-sorter:payment-methods');
      if (oldRaw) {
        const oldMethods: string[] = JSON.parse(oldRaw);
        if (Array.isArray(oldMethods) && oldMethods.length > 0) {
          const filtered = oldMethods.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
          if (filtered.length > 0) {
            setState(prev => {
              const existing = new Set(prev.paymentMethods || []);
              let added = false;
              for (const m of filtered) {
                if (!existing.has(m)) {
                  existing.add(m);
                  added = true;
                }
              }
              if (!added) return prev;
              const unioned = Array.from(existing);
              console.log('[BudgetProvider] Migrated standalone payment methods:', filtered.length);
              return { ...prev, paymentMethods: unioned };
            });
          }
        }
        localStorage.removeItem('sat-sorter:payment-methods');
      }
    } catch {
      // Ignore migration errors
    }

    try {
      localStorage.setItem(PAYMENT_METHODS_MIGRATION_KEY, '1');
    } catch {
      // localStorage may not be available
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On initial load, always reset currentMonth to the REAL current month.
  // This prevents issues where the stored month (e.g. from an accepted invite
  // months ago, or a different device's state) is out of date. Users can still
  // navigate to past/future months manually, but the app always opens to today.
  useEffect(() => {
    if (hasAutoSetMonth.current) return;
    hasAutoSetMonth.current = true;

    const realCurrentMonth = getCurrentMonth();
    if (state.currentMonth !== realCurrentMonth) {
      console.log(
        `[BudgetProvider] Auto-updating currentMonth from ${state.currentMonth} to ${realCurrentMonth}`
      );
      setState(prev => ({ ...prev, currentMonth: realCurrentMonth }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Migration: upgrade existing partner setup to shared-budget-keypair model
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasRunMigration.current) return;
    hasRunMigration.current = true;

    // Already migrated or fresh install — nothing to do
    if (state.accessibleBudgets.length > 0) return;
    if (state.budgetKeypair) return;

    // No partners = no migration needed
    const partners = state.partners || [];
    if (partners.length === 0) return;

    // Do we have existing partners but no budgetKeypair? Show a one-time banner.
    console.log(
      '[BudgetProvider] Existing partners found without budgetKeypair. Migration banner needed.'
    );

    // We don't auto-generate a keypair here because existing kind-4002 events
    // cannot be migrated automatically. The banner will inform the user to
    // re-invite partners for improved sync.
    //
    // Persist the fact that we've flagged this so we don't flag again.
    try {
      localStorage.setItem(MIGRATION_KEY, '1');
    } catch {
      // Storage may not be available
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure accessibleBudgets and budgetKeypair are always present (for older
  // localStorage data that predates these fields).
  const normalizedState = useMemo<BudgetState>(() => {
    let next = state;
    let changed = false;

    if (!next.accessibleBudgets) {
      next = { ...next, accessibleBudgets: [] };
      changed = true;
    }

    // If the user has a personal budget (no shared keypair), add it to
    // accessibleBudgets implicitly so the selector always has an entry.
    if (!next.budgetKeypair && next.accessibleBudgets.length === 0) {
      // Personal budget — no shared keypair needed
      next = {
        ...next,
        accessibleBudgets: [
          ...next.accessibleBudgets,
          {
            budgetNpub: '',
            budgetNsec: '',
            role: 'owner' as const,
          },
        ],
      };
      changed = true;
    }

    return changed ? next : state;
  }, [state]);

  const value = useMemo(
    () => ({ state: normalizedState, setState }),
    [normalizedState, setState]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

/**
 * Hook to switch to a different shared budget.
 * When switching, the app loads the appropriate budget nsec and subscribes
 * to events under the target budget npub.
 */
export function useSwitchBudget() {
  const { state, setState } = useBudgetContext();

  const switchToBudget = (budgetNpub: string) => {
    const target = state.accessibleBudgets.find(b => b.budgetNpub === budgetNpub);
    if (!target) {
      console.warn('[BudgetContext] Cannot switch to unknown budget:', budgetNpub);
      return;
    }

    setState(prev => ({
      ...prev,
      budgetKeypair: target.budgetNpub
        ? {
            budgetNsec: target.budgetNsec,
            budgetNpub: target.budgetNpub,
          }
        : undefined,
    }));

    console.log('[BudgetContext] Switched to budget:', budgetNpub.slice(0, 16) + '...');
  };

  return {
    accessibleBudgets: state.accessibleBudgets,
    activeBudgetNpub: state.budgetKeypair?.budgetNpub || '',
    switchToBudget,
  };
}

export function useBudgetContext() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudgetContext must be used within a BudgetProvider');
  }
  return context;
}
