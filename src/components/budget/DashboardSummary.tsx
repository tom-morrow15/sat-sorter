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

export function DashboardSummary({ buckets, transactions, currency }: DashboardSummaryProps) {
  const { data: priceData } = useBitcoinPrice();
  const btcPrice = priceData?.usdPerBtc ?? 0;

  const totals = deriveBudgetTotals({ buckets, transactions } as MonthlyBudget, btcPrice);
  const totalPlannedUsd = totals.plannedUsd;
  const totalSpentUsd = totals.spentUsd;
  const leftToSpendUsd = totals.remainingToSpendUsd;

  const totalPlanned = currency === 'usd' ? totalPlannedUsd : usdToSats(totalPlannedUsd, btcPrice);
  const totalSpent = currency === 'usd' ? totalSpentUsd : usdToSats(totalSpentUsd, btcPrice);
  const leftToSpend = currency === 'usd' ? leftToSpendUsd : usdToSats(leftToSpendUsd, btcPrice);

  const spentPercentage = totalPlannedUsd > 0 ? Math.round((totalSpentUsd / totalPlannedUsd) * 100) : 0;
  const isOverspent = totalSpentUsd > totalPlannedUsd;
  const isOnTrack = spentPercentage <= 75;
  const overBudgetCount = totals.expenseBuckets.filter((b) => b.isOverBudget).length;

  const formatAmount = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    return `${formatSats(Math.round(amount))}`;
  };

  if (totalPlanned === 0) return null;

  return (
    <div className="card-base p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
          <div>
            <h2 className="font-serif-display text-base tracking-tight">Spending This Month</h2>
            <p className="text-xs text-muted-foreground">
              {isOverspent ? 'Exceeded your plan' : `${formatAmount(leftToSpend)} left to spend`}
            </p>
          </div>
        </div>
        {/* Status pill */}
        {isOverspent ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium">
            <AlertTriangle className="h-3 w-3" /> Overspent
          </div>
        ) : isOnTrack ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3" /> On track
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
            <TrendingDown className="h-3 w-3" /> Watch spending
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 sm:gap-6">
        {/* Circular progress */}
        <div className="flex-shrink-0">
          <CircularProgress
            percentage={spentPercentage}
            size={96}
            strokeWidth={8}
            value={`${spentPercentage}%`}
            label="of plan"
          />
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Spent</p>
              <p className="font-serif-display text-base tabular-nums leading-tight truncate">
                {formatAmount(totalSpent)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
              isOverspent ? 'bg-destructive/10' : 'bg-success/10'
            )}>
              <PiggyBank className={cn('h-4 w-4', isOverspent ? 'text-destructive' : 'text-success')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {isOverspent ? 'Over by' : 'Left to spend'}
              </p>
              <p className={cn(
                'font-serif-display text-base tabular-nums leading-tight truncate',
                isOverspent ? 'text-destructive' : 'text-foreground'
              )}>
                {formatAmount(Math.abs(leftToSpend))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {overBudgetCount > 0 && (
        <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-2 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />
          <span>{overBudgetCount} {overBudgetCount === 1 ? 'category is' : 'categories are'} over budget</span>
        </div>
      )}
    </div>
  );
}
