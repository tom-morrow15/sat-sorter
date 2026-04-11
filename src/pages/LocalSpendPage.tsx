import { useSeoMeta } from '@unhead/react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BTCMapBanner } from '@/components/budget/BTCMapBanner';
import { useBudget } from '@/hooks/useBudget';

export default function LocalSpendPage() {
  const { currentBudget, currency, currentMonth, toggleCurrency, setCurrentMonth } = useBudget();

  useSeoMeta({
    title: 'Spend Bitcoin Locally - Sat Sorter',
    description: 'Find places to spend Bitcoin in your area.',
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
        <div className="space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Spend Bitcoin Locally</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Find merchants and places around you that accept Bitcoin
            </p>
          </div>

          {/* BTCMap Banner */}
          <BTCMapBanner />
        </div>
      </main>
    </div>
  );
}
