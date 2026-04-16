import { createContext, useContext, useMemo, ReactNode } from 'react';
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
