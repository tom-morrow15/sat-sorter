import { useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { useBudget } from '@/hooks/useBudget';
import { calculateSpentForBucket } from '@/lib/budgetTypes';
import { formatSats, satsToUsd } from '@/hooks/useBitcoinPrice';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#d97706', // orange-600
];

export default function SpendingBreakdownPage() {
  const { currentBudget, currency, currentMonth, toggleCurrency, setCurrentMonth } = useBudget();
  const { data: priceData } = useBitcoinPrice();

  useSeoMeta({
    title: 'Spending Breakdown - Sat Sorter',
    description: 'See your spending breakdown by category.',
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

  // Calculate spending by bucket
  const breakdownData = useMemo(() => {
    const expenseBuckets = currentBudget.buckets.filter(b => !b.isIncome);
    
    return expenseBuckets
      .map(bucket => {
        const spent = calculateSpentForBucket(bucket, currentBudget.transactions);
        return {
          name: bucket.name,
          value: spent,
          spent: spent,
          budget: bucket.lineItems.reduce((sum, item) => sum + item.plannedAmount, 0),
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [currentBudget]);

  const totalSpent = useMemo(() => {
    return breakdownData.reduce((sum, item) => sum + item.value, 0);
  }, [breakdownData]);

  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      const usd = satsToUsd(sats, priceData.usdPerBtc);
      return `$${usd.toFixed(2)}`;
    }
    return `${formatSats(sats)} sats`;
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
            <h1 className="text-2xl sm:text-3xl font-bold">Spending Breakdown</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your expenses by category this month
            </p>
          </div>

          {breakdownData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No spending data yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pie Chart */}
              <div className="lg:col-span-2">
                <div className="bg-card border rounded-lg p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={breakdownData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {breakdownData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatAmount(value as number)}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Legend and Stats */}
              <div className="space-y-4">
                <div className="bg-card border rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Total Spent</h3>
                  <p className="text-3xl font-bold text-primary">
                    {formatAmount(totalSpent)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {breakdownData.length} categories
                  </p>
                </div>

                {/* Category Breakdown List */}
                <div className="bg-card border rounded-lg p-6 space-y-3 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold mb-3">By Category</h3>
                  {breakdownData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{formatAmount(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
