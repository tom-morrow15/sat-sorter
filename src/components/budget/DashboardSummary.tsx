import { TrendingUp, TrendingDown, Wallet, Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CircularProgress } from './CircularProgress';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalIncomeSats,
  calculateTotalExpensesSats,
  calculateTotalIncomeUsd,
  calculateTotalExpensesUsd,
  calculateSpentForBucket,
} from '@/lib/budgetTypes';
import type { Bucket, Transaction } from '@/lib/budgetTypes';

interface DashboardSummaryProps {
  buckets: Bucket[];
  transactions: Transaction[];
  currency: 'sats' | 'usd';
}

/**
 * Professional dashboard summary showing key budget metrics at a glance.
 * Inspired by EveryDollar/YNAB dashboard overviews.
 */
export function DashboardSummary({ buckets, transactions, currency }: DashboardSummaryProps) {
  const { data: priceData } = useBitcoinPrice();
  const btcPrice = priceData?.usdPerBtc ?? 0;

  // Calculate totals
  const expenseBuckets = buckets.filter((b) => !b.isIncome);

  const totalIncome = currency === 'usd' && btcPrice
    ? calculateTotalIncomeUsd(buckets, btcPrice)
    : calculateTotalIncomeSats(buckets, btcPrice);

  const totalPlanned = currency === 'usd' && btcPrice
    ? calculateTotalExpensesUsd(buckets, btcPrice)
    : calculateTotalExpensesSats(buckets, btcPrice);

  // Calculate total spent (in sats, then convert)
  const totalSpentSats = expenseBuckets.reduce(
    (sum, bucket) => sum + calculateSpentForBucket(bucket, transactions),
    0
  );
  const totalSpent = currency === 'usd' && btcPrice
    ? satsToUsd(totalSpentSats, btcPrice)
    : totalSpentSats;

  const remaining = totalIncome - totalPlanned;

  // Percentage spent of planned budget
  const spentPercentage = totalPlanned > 0
    ? Math.round((totalSpent / totalPlanned) * 100)
    : 0;

  // Budget status
  const isZeroed = Math.abs(remaining) < (currency === 'usd' ? 0.01 : 1) && totalIncome > 0;
  const isOver = remaining < 0;

  const formatAmount = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    return `${formatSats(Math.round(amount))}`;
  };

  const metrics = [
    {
      label: 'Income',
      value: formatAmount(totalIncome),
      icon: TrendingUp,
      iconColor: 'text-success',
      iconBg: 'bg-success/10',
    },
    {
      label: 'Planned',
      value: formatAmount(totalPlanned),
      icon: Target,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Spent',
      value: formatAmount(totalSpent),
      icon: Wallet,
      iconColor: spentPercentage > 90 ? 'text-orange-500' : 'text-blue-500',
      iconBg: spentPercentage > 90 ? 'bg-orange-500/10' : 'bg-blue-500/10',
    },
  ];

  return (
    <div className="bg-card rounded-2xl border shadow-sm p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Circular progress indicator */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <CircularProgress
            percentage={spentPercentage}
            size={96}
            strokeWidth={8}
            value={`${spentPercentage}%`}
            label="spent"
          />
          <div className="text-center">
            {isOver ? (
              <div className="flex items-center gap-1 text-destructive text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                Over budget
              </div>
            ) : isZeroed ? (
              <div className="flex items-center gap-1 text-success text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Fully budgeted
              </div>
            ) : (
              <div className="text-xs text-muted-foreground font-medium">
                {formatAmount(Math.abs(remaining))} to budget
              </div>
            )}
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 flex-1 w-full">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex flex-col items-center sm:items-start gap-2 p-3 rounded-xl bg-muted/30"
              >
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', metric.iconBg)}>
                  <Icon className={cn('h-4.5 w-4.5', metric.iconColor)} />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    {metric.label}
                  </p>
                  <p className="text-base sm:text-lg font-bold tabular-nums leading-tight">
                    {metric.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
