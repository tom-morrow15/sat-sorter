import { cn } from '@/lib/utils';

interface SpendingProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
  currency?: 'sats' | 'usd';
  formatAmount?: (amount: number) => string;
}

export function SpendingProgressBar({
  spent,
  budget,
  className,
  showLabel = true,
  currency = 'usd',
  formatAmount,
}: SpendingProgressBarProps) {
  // Calculate percentage spent
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const actualPercentage = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = budget - spent;
  const remainingPercent = budget > 0 ? (remaining / budget) * 100 : 0;

  const formatDisplayAmount = (amount: number) => {
    if (formatAmount) return formatAmount(amount);
    if (currency === 'usd') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return `${amount.toLocaleString()} sats`;
  };

  const isOverBudget = spent > budget;
  const isWarning = remainingPercent <= 20 && remainingPercent > 0; // < 20% remaining
  const isCritical = remainingPercent <= 10 && remainingPercent > 0; // < 10% remaining
  const isNearFull = remainingPercent <= 5 && remainingPercent > 0; // < 5% remaining

  // Determine gradient based on status for a more polished look
  const barGradient = isOverBudget
    ? 'bg-gradient-to-r from-red-500 to-destructive'
    : isNearFull
    ? 'bg-gradient-to-r from-orange-500 to-red-500'
    : isCritical
    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
    : isWarning
    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
    : 'bg-gradient-to-r from-primary to-orange-500';

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden shadow-inner">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            barGradient
          )}
          style={{
            width: `${percentage}%`,
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium tabular-nums">
            {actualPercentage.toFixed(0)}% spent
          </span>
           {!isOverBudget && remaining > 0 ? (
             <span className="text-muted-foreground tabular-nums">
               {remainingPercent.toFixed(0)}% left
             </span>
           ) : isOverBudget ? (
             <span className="text-destructive font-medium">
               {formatDisplayAmount(Math.abs(remaining))} over
             </span>
           ) : null}
        </div>
      )}
    </div>
  );
}
