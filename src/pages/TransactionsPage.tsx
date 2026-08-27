import { useState, useMemo, useEffect } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useSearchParams } from 'react-router-dom';
import { X, Filter } from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { TransactionsPanel } from '@/components/budget/TransactionsPanel';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { CopyMonthPrompt, type AvailableMonth } from '@/components/budget/CopyMonthPrompt';
import { Button } from '@/components/ui/button';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { useSyncCopiedBudget } from '@/hooks/useSharedBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { formatMonth } from '@/lib/budgetTypes';

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lineItemIdFilter = searchParams.get('lineItemId');
  const { toast } = useToast();
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Clear the unviewed NWC import count when the user visits this page
  const [, setUnviewedCount] = useLocalStorage<number>('nwc-unviewed-count', 0);
  useEffect(() => {
    setUnviewedCount(0);
  }, [setUnviewedCount]);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);

  const { data: priceData } = useBitcoinPrice();
  const { syncCopiedBudget } = useSyncCopiedBudget();

  const {
    currentBudget, currency, currentMonth, fullState, toggleCurrency, setCurrentMonth,
    addTransaction, addTransactions, assignTransaction, updateTransaction, deleteTransaction,
    duplicateFromMonth, resetCurrentMonth, availableMonths, paymentMethods, addPaymentMethod,
  } = useBudget();

  useSeoMeta({ title: 'Transactions - Sat Sorter', description: 'View and manage all your transactions.' });

  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const availableCopyMonths = useMemo<AvailableMonth[]>(() => {
    return fullState.budgets
      .filter(b => b.month !== currentMonth && b.buckets.length > 0)
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(b => ({ month: b.month, budget: b }));
  }, [fullState.budgets, currentMonth]);

  const handleCopyPreviousMonth = (sourceMonth: string) => {
    const currentPrice = priceData?.usdPerBtc;
    const result = duplicateFromMonth(sourceMonth, currentMonth, currentPrice);
    if (result.success) {
      toast({ title: 'Budget copied!', description: result.message });
      setShowCopyPrompt(false);
      const newBudget = fullState.budgets.find(b => b.month === currentMonth);
      if (newBudget && newBudget.buckets.length > 0) {
        syncCopiedBudget(newBudget).catch(e => console.error('[TransactionsPage] Failed to sync:', e));
      }
    } else {
      toast({ title: 'Cannot copy budget', description: result.message ?? 'An unknown error occurred', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <BudgetHeader
        buckets={currentBudget.buckets}
        currentMonth={currentMonth}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onOpenWallet={() => setShowWalletModal(true)}
        onSelectMonth={setCurrentMonth}
        availableMonths={availableMonths}
        allBudgets={fullState.budgets}
        onCopyPreviousMonth={() => setShowCopyPrompt(true)}
        onResetBudgetMonth={() => {
          resetCurrentMonth();
          toast({ title: 'Budget reset', description: 'Your budget for this month has been cleared.' });
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-6">
        <div className="mb-4">
          <p className="bh-caption text-muted-foreground mb-1">Activity</p>
          <h1 className="font-serif text-3xl leading-none">Transactions</h1>
        </div>

        <div className="space-y-4">
          {/* Active filter banner */}
          {lineItemIdFilter && (() => {
            const filteredLineItem = currentBudget.buckets
              .flatMap(b => b.lineItems.map(li => ({ ...li, bucketName: b.name, bucketColor: b.color })))
              .find(li => li.id === lineItemIdFilter);
            return (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Filter className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      Filtered by: {filteredLineItem?.name || 'Unknown'}
                    </p>
                    {filteredLineItem?.bucketName && (
                      <p className="text-xs text-muted-foreground truncate">in {filteredLineItem.bucketName}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { searchParams.delete('lineItemId'); setSearchParams(searchParams); }}
                  className="flex-shrink-0 touch-target-sm"
                >
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            );
          })()}

          <TransactionsPanel
            transactions={currentBudget.transactions}
            buckets={currentBudget.buckets}
            currency={currency}
            onAddTransaction={addTransaction}
            onAddTransactions={addTransactions}
            onAssignTransaction={assignTransaction}
            onUpdateTransaction={updateTransaction}
            onDeleteTransaction={deleteTransaction}
            lineItemIdFilter={lineItemIdFilter || undefined}
            paymentMethods={paymentMethods}
            onAddPaymentMethod={addPaymentMethod}
          />
        </div>
      </main>

      <CopyMonthPrompt
        open={showCopyPrompt}
        onOpenChange={setShowCopyPrompt}
        currentMonth={currentMonth}
        availableMonths={availableCopyMonths}
        onStartFresh={() => toast({ title: 'Starting fresh', description: 'Your new month is ready.' })}
        onCopyPrevious={handleCopyPreviousMonth}
      />

      {showWalletModal && (
        <WalletModalControlled open={showWalletModal} onOpenChange={setShowWalletModal} />
      )}
    </div>
  );
}
