import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalExpenses,
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
}: BudgetDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: priceData } = useBitcoinPrice();

  const totalBudgeted = calculateTotalExpenses(buckets);

  // Calculate actual spending per category
  const expenseBuckets = buckets.filter((b) => !b.isIncome);
  const spendingByBucket = expenseBuckets
    .map((bucket) => ({
      bucket,
      spent: calculateSpentForBucket(bucket, transactions),
    }))
    .filter((item) => item.spent > 0) // Only show categories with spending
    .sort((a, b) => b.spent - a.spent);

  const totalSpent = spendingByBucket.reduce((sum, item) => sum + item.spent, 0);

  // Format amount based on currency - compact version for chart center
  const formatAmountCompact = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    // Format with K/M suffix for large numbers
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(1)}M`;
    }
    if (sats >= 10000) {
      return `${(sats / 1000).toFixed(0)}K`;
    }
    return formatSats(sats);
  };

  // Format amount based on currency - full version for legend
  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  // Don't render anything if there's no spending data
  if (totalSpent === 0 && spendingByBucket.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Spending Breakdown</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8 p-0"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="flex justify-center">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0">
                {/* SVG Ring Chart */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  {generatePieSlices(spendingByBucket, totalSpent).map((slice, idx) => (
                    <circle
                      key={idx}
                      cx="100"
                      cy="100"
                      r="70"
                      fill="none"
                      stroke={getColorForIndex(idx)}
                      strokeWidth="28"
                      strokeDasharray={`${slice.dashArray} 439.8`}
                      strokeDashoffset={`${slice.dashOffset}`}
                    />
                  ))}
                </svg>

                {/* Center Text - Compact */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-base sm:text-xl font-bold text-center leading-tight">
                    {formatAmountCompact(totalSpent)}
                  </div>
                  {currency === 'sats' && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5">
                      sats
                    </div>
                  )}
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    spent
                  </div>
                </div>
              </div>
            </div>

            {/* Categories List - Compact and shows ALL */}
            <div className="space-y-1">
              {spendingByBucket.map((item, idx) => {
                const percentage =
                  totalSpent > 0 ? ((item.spent / totalSpent) * 100).toFixed(0) : '0';
                return (
                  <div
                    key={item.bucket.id}
                    className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 transition-colors"
                  >
                    {/* Color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getColorForIndex(idx) }}
                    />
                    {/* Category name */}
                    <span className="text-sm font-medium flex-1 truncate min-w-0">
                      {item.bucket.name}
                    </span>
                    {/* Amount */}
                    <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                      {formatAmount(item.spent)}
                    </span>
                    {/* Percentage badge */}
                    <span className="text-xs font-medium text-muted-foreground w-8 text-right tabular-nums flex-shrink-0">
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Summary bar */}
            {totalBudgeted > 0 && (
              <div className="pt-2 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget remaining</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    totalBudgeted - totalSpent < 0
                      ? 'text-destructive'
                      : 'text-green-600'
                  )}
                >
                  {totalBudgeted - totalSpent < 0 ? '-' : ''}
                  {formatAmount(Math.abs(totalBudgeted - totalSpent))}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Helper function to generate pie slices
function generatePieSlices(
  spendingByBucket: Array<{ bucket: Bucket; spent: number }>,
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
