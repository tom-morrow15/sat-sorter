import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { AddTransactionDialog } from '@/components/budget/AddTransactionDialog';
import { useBudget } from '@/hooks/useBudget';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';

interface AddTransactionContextValue {
  openAddTransaction: (defaultBucketId?: string) => void;
}

const AddTransactionContext = createContext<AddTransactionContextValue | null>(null);

export function useAddTransaction() {
  const ctx = useContext(AddTransactionContext);
  return ctx;
}

export function AddTransactionProvider({ children }: { children: ReactNode }) {
  const { currentBudget, currency, addTransaction, paymentMethods, fullState } = useBudget();
  const [open, setOpen] = useState(false);
  const [defaultBucketId, setDefaultBucketId] = useState<string | undefined>(undefined);

  const openAddTransaction = useCallback((bucketId?: string) => {
    setDefaultBucketId(bucketId);
    setOpen(true);
  }, []);

  // Determine if this is an income or expense bucket
  const defaultBucket = defaultBucketId
    ? fullState.budgets.find(b => b.month === currentBudget.month)?.buckets.find(b => b.id === defaultBucketId)
    : undefined;
  const isIncome = defaultBucket?.isIncome ?? false;

  // Get all buckets (not just the current month's, but we need the current month's buckets for the dialog)
  const buckets = currentBudget.buckets;

  return (
    <AddTransactionContext.Provider value={{ openAddTransaction }}>
      {children}
      <AddTransactionDialog
        open={open}
        onOpenChange={setOpen}
        buckets={buckets}
        defaultBucketId={defaultBucketId}
        currency={currency}
        isIncome={isIncome}
        onSave={(transaction) => addTransaction(transaction)}
        paymentMethods={paymentMethods}
      />
    </AddTransactionContext.Provider>
  );
}
