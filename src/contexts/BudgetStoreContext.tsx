import { createContext, useContext, type ReactNode } from 'react';
import { useBudgetStore } from '@/hooks/useBudgetStore';

type BudgetStoreContextType = ReturnType<typeof useBudgetStore>;

const BudgetStoreContext = createContext<BudgetStoreContextType | null>(null);

export function BudgetStoreProvider({ children }: { children: ReactNode }) {
  const store = useBudgetStore();
  return (
    <BudgetStoreContext.Provider value={store}>
      {children}
    </BudgetStoreContext.Provider>
  );
}

export function useBudgetStoreContext(): BudgetStoreContextType {
  const context = useContext(BudgetStoreContext);
  if (!context) {
    throw new Error('useBudgetStoreContext must be used within a BudgetStoreProvider');
  }
  return context;
}
