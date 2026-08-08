import { cn } from '@/lib/utils';

interface SpendingProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
  currency?: 'sats' | 'usd';
  formatAmount?: (amount: number) => string;
  /** Brand-palette color for the fill. Defaults to burnt orange. */
  accentColor?: string;
}

export function SpendingProgressBar({
  spent, budget, className, showLabel = true, currency = 'usd', formatAmount, accentColor,
}: SpendingProgressBarProps) {
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
  const isCritical = remainingPercent <= 10 && remainingPercent > 0;

  // Flat color only — no gradient, no glow.
  const fillColor = isOverBudget
    ? 'hsl(var(--destructive))'
    : isCritical
    ? 'hsl(var(--mustard))'
    : accentColor || 'hsl(var(--primary))';

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      <div className="w-full h-2 bh-track">
        <div className="h-full bh-fill" style={{ width: `${percentage}%`, backgroundColor: fillColor }} />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-muted-foreground">{actualPercentage.toFixed(0)}% spent</span>
          {!isOverBudget && remaining > 0 ? (
            <span className="text-muted-foreground">{remainingPercent.toFixed(0)}% left</span>
          ) : isOverBudget ? (
            <span className="text-destructive">{formatDisplayAmount(Math.abs(remaining))} over</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
