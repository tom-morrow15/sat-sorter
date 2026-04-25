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
};

interface BudgetContextValue {
  state: BudgetState;
  setState: (value: BudgetState | ((prev: BudgetState) => BudgetState)) => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<BudgetState>('sat-sorter-budget', DEFAULT_STATE);
  const hasAutoSetMonth = useRef(false);

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

  const value = useMemo(
    () => ({ state, setState }),
    [state, setState]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudgetContext() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudgetContext must be used within a BudgetProvider');
  }
  return context;
}
