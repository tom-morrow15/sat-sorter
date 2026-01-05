import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateRemainingToBudget,
  calculateSpentForBucket,
  type Bucket,
  type Transaction,
} from '@/lib/budgetTypes';
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
  month,
}: BudgetDashboardProps) {
  const { data: priceData } = useBitcoinPrice();

  // Calculate totals
  const totalIncome = calculateTotalIncome(buckets);
  const totalBudgeted = calculateTotalExpenses(buckets);
  const remaining = calculateRemainingToBudget(buckets);

  // Calculate actual spending per category
  const expenseBuckets = buckets.filter((b) => !b.isIncome);
  const spendingByBucket = expenseBuckets
    .map((bucket) => ({
      bucket,
      spent: calculateSpentForBucket(bucket, transactions),
    }))
    .sort((a, b) => b.spent - a.spent);

  const totalSpent = spendingByBucket.reduce((sum, item) => sum + item.spent, 0);

  // Format amount based on currency
  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  // Format month
  const [year, monthNum] = month.split('-');
  const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{monthName} Budget</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial overview for the month
        </p>
      </div>

      {/* Key Metrics - 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatAmount(totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Budgeted for this month
            </p>
          </CardContent>
        </Card>

        {/* Budgeted Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatAmount(totalBudgeted)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all categories
            </p>
          </CardContent>
        </Card>

        {/* Remaining Card */}
        <Card className={remaining < 0 ? 'border-destructive' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                remaining < 0 ? 'text-destructive' : 'text-amber-600'
              )}
            >
              {formatAmount(Math.abs(remaining))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {remaining < 0 ? 'Over budget' : 'Left to allocate'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Overview - Pie Chart Style */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Pie Chart Visualization */}
            <div className="flex items-center justify-center py-6">
              <div className="relative w-48 h-48">
                {/* Simple Pie Chart using SVG-like approach */}
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {formatAmount(totalSpent)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total Spent
                    </div>
                  </div>
                </div>

                {/* Ring-style pie chart */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  {generatePieSlices(spendingByBucket, totalSpent).map((slice, idx) => (
                    <circle
                      key={idx}
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke={getColorForIndex(idx)}
                      strokeWidth="20"
                      strokeDasharray={`${slice.dashArray} 502.4`}
                      strokeDashoffset={`${slice.dashOffset}`}
                      opacity="0.8"
                    />
                  ))}
                </svg>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t">
              {spendingByBucket.map((item, idx) => {
                const percentage =
                  totalSpent > 0 ? ((item.spent / totalSpent) * 100).toFixed(1) : '0';
                return (
                  <div key={item.bucket.id} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: getColorForIndex(idx) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {item.bucket.name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {percentage}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatAmount(item.spent)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {totalSpent > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-sm font-semibold">{formatAmount(totalSpent)}</p>
                </div>
                {totalBudgeted > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">Budgeted</p>
                    <p className="text-sm font-semibold">{formatAmount(totalBudgeted)}</p>
                  </div>
                )}
                {totalBudgeted > 0 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <p className="text-sm font-medium">Budget Remaining</p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        totalBudgeted - totalSpent < 0
                          ? 'text-destructive'
                          : 'text-green-600'
                      )}
                    >
                      {formatAmount(Math.abs(totalBudgeted - totalSpent))}
                    </p>
                  </div>
                )}
              </div>
            )}

            {totalSpent === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No spending tracked yet for this month</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to generate pie slices
function generatePieSlices(
  spendingByBucket: Array<{ bucket: any; spent: number }>,
  totalSpent: number
) {
  const slices = [];
  let currentOffset = 0;

  for (const item of spendingByBucket) {
    const percentage = totalSpent > 0 ? item.spent / totalSpent : 0;
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
