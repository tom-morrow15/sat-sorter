import { TrendingDown, Wallet, PiggyBank, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CircularProgress } from './CircularProgress';
import { useBitcoinPrice, formatSats, formatUsd, usdToSats } from '@/hooks/useBitcoinPrice';
import { deriveBudgetTotals } from '@/lib/budgetSelectors';
import type { Bucket, Transaction, MonthlyBudget } from '@/lib/budgetTypes';

interface DashboardSummaryProps {
  buckets: Bucket[];
  transactions: Transaction[];
  currency: 'sats' | 'usd';
}

/**
 * Spending tracker dashboard. Focuses on actual spending vs. plan —
 * complementing (not duplicating) the header's Income/Planned/Remaining.
 *
 * The header answers: "Is my budget balanced?"
 * This answers: "How am I tracking against my plan this month?"
 */
export function DashboardSummary({ buckets, transactions, currency }: DashboardSummaryProps) {
  const { data: priceData } = useBitcoinPrice();
  const btcPrice = priceData?.usdPerBtc ?? 0;

  // Use the SHARED selector so this card's numbers match the Breakdown page,
  // LineItemRow, and Maple. All figures are USD-anchored; we convert to sats
  // only for the sats-view label.
  const totals = deriveBudgetTotals({ buckets, transactions } as MonthlyBudget, btcPrice);
  const totalPlannedUsd = totals.plannedUsd;
  const totalSpentUsd = totals.spentUsd;
  const leftToSpendUsd = totals.remainingToSpendUsd;

  const totalPlanned = currency === 'usd' ? totalPlannedUsd : usdToSats(totalPlannedUsd, btcPrice);
  const totalSpent = currency === 'usd' ? totalSpentUsd : usdToSats(totalSpentUsd, btcPrice);
  const leftToSpend = currency === 'usd' ? leftToSpendUsd : usdToSats(leftToSpendUsd, btcPrice);

  const spentPercentage = totalPlannedUsd > 0
    ? Math.round((totalSpentUsd / totalPlannedUsd) * 100)
    : 0;

  const isOverspent = totalSpentUsd > totalPlannedUsd;
  const isOnTrack = spentPercentage <= 75;

  // Count categories over budget (using the already-derived bucket data)
  const overBudgetCount = totals.expenseBuckets.filter((b) => b.isOverBudget).length;

  const formatAmount = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    return `${formatSats(Math.round(amount))}`;
  };

  // Don't render if there's no budget to track yet
  if (totalPlanned === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">Spending This Month</h2>
            <p className="text-xs text-muted-foreground">
              {isOverspent ? 'You\'ve exceeded your plan' : `${formatAmount(leftToSpend)} left to spend`}
            </p>
          </div>
        </div>
        {/* Status pill */}
        {isOverspent ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overspent
          </div>
        ) : isOnTrack ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            On track
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <TrendingDown className="h-3.5 w-3.5" />
            Watch spending
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Circular progress indicator */}
        <div className="flex-shrink-0">
          <CircularProgress
            percentage={spentPercentage}
            size={104}
            strokeWidth={9}
            value={`${spentPercentage}%`}
            label="of plan"
          />
        </div>

        {/* Spent vs Left breakdown */}
        <div className="flex-1 space-y-3">
          {/* Spent */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Spent
              </p>
              <p className="text-lg font-bold tabular-nums leading-tight">
                {formatAmount(totalSpent)}
              </p>
            </div>
          </div>

          {/* Left to spend */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
              isOverspent ? 'bg-destructive/10' : 'bg-success/10'
            )}>
              <PiggyBank className={cn(
                'h-5 w-5',
                isOverspent ? 'text-destructive' : 'text-success'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {isOverspent ? 'Over by' : 'Left to spend'}
              </p>
              <p className={cn(
                'text-lg font-bold tabular-nums leading-tight',
                isOverspent ? 'text-destructive' : 'text-foreground'
              )}>
                {formatAmount(Math.abs(leftToSpend))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Over-budget categories warning */}
      {overBudgetCount > 0 && (
        <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
          <span>
            {overBudgetCount} {overBudgetCount === 1 ? 'category is' : 'categories are'} over budget
          </span>
        </div>
      )}
    </div>
  );
}
