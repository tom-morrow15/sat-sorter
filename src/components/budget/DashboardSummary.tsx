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

  const totalSpent = currency === 'usd' ? totalSpentUsd : usdToSats(totalSpentUsd, btcPrice);
  const leftToSpend = currency === 'usd' ? leftToSpendUsd : usdToSats(leftToSpendUsd, btcPrice);
  const totalPlanned = currency === 'usd' ? totalPlannedUsd : usdToSats(totalPlannedUsd, btcPrice);

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
    <div className="bh-card p-5 animate-slide-in-up" style={{ animationFillMode: 'both' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="bh-caption text-muted-foreground mb-1">Spending this month</p>
          <p className="text-sm text-muted-foreground">
            {isOverspent ? "You've exceeded your plan" : `${formatAmount(leftToSpend)} left to spend`}
          </p>
        </div>
        {isOverspent ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-destructive/12 text-destructive text-[11px] font-medium">
            <AlertTriangle className="h-3 w-3" /> Overspent
          </div>
        ) : isOnTrack ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-success/15 text-[hsl(var(--success))] text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3" /> On track
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-mustard/15 text-mustard text-[11px] font-medium">
            <TrendingDown className="h-3 w-3" /> Watch spending
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 sm:gap-7">
        <div className="flex-shrink-0">
          <CircularProgress percentage={spentPercentage} size={100} strokeWidth={10} value={`${spentPercentage}%`} label="of plan" />
        </div>

        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="bh-caption text-muted-foreground">Spent</p>
              <p className="font-mono text-xl leading-none mt-1 truncate">{formatAmount(totalSpent)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0', isOverspent ? 'bg-destructive/12' : 'bg-success/15')}>
              <PiggyBank className={cn('h-[18px] w-[18px]', isOverspent ? 'text-destructive' : 'text-[hsl(var(--success))]')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="bh-caption text-muted-foreground">{isOverspent ? 'Over by' : 'Left to spend'}</p>
              <p className={cn('font-mono text-xl leading-none mt-1 truncate', isOverspent ? 'text-destructive' : 'text-foreground')}>
                {formatAmount(Math.abs(leftToSpend))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {overBudgetCount > 0 && (
        <div className="mt-5 pt-4 divider-soft flex items-center gap-2 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3 w-3 text-mustard flex-shrink-0" />
          <span>{overBudgetCount} {overBudgetCount === 1 ? 'category is' : 'categories are'} over budget</span>
        </div>
      )}
    </div>
  );
}
