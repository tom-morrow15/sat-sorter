import { useSeoMeta } from '@unhead/react';
import { useSearchParams } from 'react-router-dom';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { TransactionsPanel } from '@/components/budget/TransactionsPanel';
import { useBudget } from '@/hooks/useBudget';

export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const lineItemIdFilter = searchParams.get('lineItemId');

  const {
    currentBudget,
    currency,
    currentMonth,
    toggleCurrency,
    setCurrentMonth,
    addTransaction,
    assignTransaction,
    deleteTransaction,
  } = useBudget();

  useSeoMeta({
    title: 'Transactions - Sat Sorter',
    description: 'View and manage all your transactions.',
  });

  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
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
        onOpenWallet={() => {}}
        onSelectMonth={setCurrentMonth}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 lg:py-6">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Transactions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              All transactions for {new Date(`${currentMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>

           {/* Transactions Panel */}
           <TransactionsPanel
             transactions={currentBudget.transactions}
             buckets={currentBudget.buckets}
             currency={currency}
             onAddTransaction={addTransaction}
             onAssignTransaction={assignTransaction}
             onDeleteTransaction={deleteTransaction}
             lineItemIdFilter={lineItemIdFilter || undefined}
           />
        </div>
      </main>
    </div>
  );
}
