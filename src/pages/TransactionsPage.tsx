import { useSeoMeta } from '@unhead/react';
import { useSearchParams } from 'react-router-dom';
import { X, Filter } from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { TransactionsPanel } from '@/components/budget/TransactionsPanel';
import { Button } from '@/components/ui/button';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const lineItemIdFilter = searchParams.get('lineItemId');
  const { toast } = useToast();

  const {
    currentBudget,
    currency,
    currentMonth,
    toggleCurrency,
    setCurrentMonth,
    addTransaction,
    assignTransaction,
    deleteTransaction,
    splitTransaction,
    duplicateFromMonth,
    resetCurrentMonth,
    availableMonths,
    fullState,
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
        availableMonths={availableMonths}
        allBudgets={fullState.budgets}
        onCopyPreviousMonth={(sourceMonth) => {
          const result = duplicateFromMonth(sourceMonth);
          if (result.success) {
            toast({
              title: 'Budget copied!',
              description: result.message,
            });
          } else if (result.message) {
            toast({
              title: 'Cannot copy budget',
              description: result.message,
              variant: 'destructive',
            });
          }
        }}
        onResetBudgetMonth={() => {
          resetCurrentMonth();
          toast({
            title: 'Budget reset',
            description: 'Your budget for this month has been cleared.',
          });
        }}
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

           {/* Active filter banner - shown when filtering by a specific line item */}
           {lineItemIdFilter && (() => {
             const filteredLineItem = currentBudget.buckets
               .flatMap(b => b.lineItems.map(li => ({ ...li, bucketName: b.name, bucketColor: b.color })))
               .find(li => li.id === lineItemIdFilter);
             return (
               <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                 <div className="flex items-center gap-2 min-w-0 flex-1">
                   <Filter className="h-4 w-4 text-primary flex-shrink-0" />
                   <div className="min-w-0 flex-1">
                     <p className="text-sm font-medium truncate">
                       Filtered by: {filteredLineItem?.name || 'Unknown line item'}
                     </p>
                     {filteredLineItem?.bucketName && (
                       <p className="text-xs text-muted-foreground truncate">
                         in {filteredLineItem.bucketName}
                       </p>
                     )}
                   </div>
                 </div>
                 <Button
                   variant="ghost"
                   size="sm"
                   onClick={() => {
                     searchParams.delete('lineItemId');
                     setSearchParams(searchParams);
                   }}
                   className="flex-shrink-0"
                 >
                   <X className="h-4 w-4 mr-1" />
                   Clear
                 </Button>
               </div>
             );
           })()}

            {/* Transactions Panel */}
            <TransactionsPanel
              transactions={currentBudget.transactions}
              buckets={currentBudget.buckets}
              currency={currency}
              onAddTransaction={addTransaction}
              onAssignTransaction={assignTransaction}
              onDeleteTransaction={deleteTransaction}
              onSplitTransaction={splitTransaction}
              lineItemIdFilter={lineItemIdFilter || undefined}
            />
        </div>
      </main>
    </div>
  );
}
