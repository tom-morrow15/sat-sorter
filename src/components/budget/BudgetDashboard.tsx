import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBitcoinPrice, formatSats, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { deriveBudgetTotals, type BucketDerived } from '@/lib/budgetSelectors';
import type { Bucket, Transaction, MonthlyBudget } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface BudgetDashboardProps {
  buckets: Bucket[];
  transactions: Transaction[];
  currency: 'sats' | 'usd';
  month: string;
}

export function BudgetDashboard({
  buckets,
  transactions,
  currency,
}: BudgetDashboardProps) {
  const { data: priceData } = useBitcoinPrice();
  const btcPrice = priceData?.usdPerBtc ?? 0;

  // Use the SHARED selector so the dashboard agrees with the Breakdown page and
  // Maple to the penny. All amounts are USD-anchored (source of truth).
  const totals = deriveBudgetTotals(
    { buckets, transactions } as MonthlyBudget,
    btcPrice
  );
  const totalBudgetedUsd = totals.plannedUsd;
  const totalSpentUsd = totals.spentUsd;

  const spendingByBucket = totals.expenseBuckets
    .map((bucket) => ({ bucket, spentUsd: bucket.spentUsd }))
    .sort((a, b) => b.spentUsd - a.spentUsd);

  // Format a USD value in the active display currency.
  const formatAmount = (usd: number) => {
    if (currency === 'usd') {
      return formatUsd(usd);
    }
    const sats = btcPrice ? usdToSats(usd, btcPrice) : 0;
    return `${formatSats(sats)} sats`;
  };

  // Don't render anything if there's no spending data
  if (totalSpentUsd === 0 && spendingByBucket.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Spending Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Pie Chart - Centered and larger */}
          <div className="flex justify-center pt-2">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
              {/* SVG Ring Chart */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                {generatePieSlices(spendingByBucket, totalSpentUsd).map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke={getColorForIndex(idx)}
                    strokeWidth="24"
                    strokeDasharray={`${slice.dashArray} 439.8`}
                    strokeDashoffset={`${slice.dashOffset}`}
                    opacity="0.85"
                  />
                ))}
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-lg sm:text-2xl font-bold text-center px-2 line-clamp-2">
                  {formatAmount(totalSpentUsd)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Spent
                </div>
              </div>
            </div>
          </div>

          {/* Legend - Better organized */}
          <div className="space-y-3">
            {/* Grid for legend items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {spendingByBucket.slice(0, 6).map((item, idx) => {
                const percentage =
                  totalSpentUsd > 0 ? ((item.spentUsd / totalSpentUsd) * 100).toFixed(0) : '0';
                return (
                  <div key={item.bucket.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 mt-1"
                      style={{ backgroundColor: getColorForIndex(idx) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {item.bucket.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatAmount(item.spentUsd)}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        {percentage}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {spendingByBucket.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{spendingByBucket.length - 6} more categories
              </p>
            )}
          </div>

          {/* Summary bar */}
          {totalBudgetedUsd > 0 && (
            <div className="pt-3 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Budget remaining</span>
              <span
                className={cn(
                  'font-semibold',
                  totalBudgetedUsd - totalSpentUsd < 0
                    ? 'text-destructive'
                    : 'text-green-600'
                )}
              >
                {totalBudgetedUsd - totalSpentUsd < 0 ? '-' : ''}
                {formatAmount(Math.abs(totalBudgetedUsd - totalSpentUsd))}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate pie slices
function generatePieSlices(
  spendingByBucket: Array<{ bucket: BucketDerived; spentUsd: number }>,
  totalSpent: number
) {
  const slices: { dashArray: string; dashOffset: string }[] = [];
  let currentOffset = 0;

  for (const item of spendingByBucket) {
    const percentage = totalSpent > 0 ? item.spentUsd / totalSpent : 0;
    const circumference = 502.4; // 2 * π * 80
    const dashArray = circumference * percentage;

    slices.push({
      dashArray: dashArray.toFixed(2),
      dashOffset: (-currentOffset).toFixed(2),
    });

    currentOffset += dashArray;
  }

  return slices;
}

// Color palette for pie chart
function getColorForIndex(idx: number) {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
    '#14b8a6', // teal
    '#22c55e', // green
  ];
  return colors[idx % colors.length];
}
