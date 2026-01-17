import { cn } from '@/lib/utils';

interface SpendingProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
  /**
   * When true, uses a tolerance for over-budget detection to account for
   * exchange rate drift between USD and sats conversions.
   * Tolerance is 0.1% of budget or minimum of 0.05 (for USD) / 10 (for sats).
   */
  useTolerance?: boolean;
  /** Whether we're in USD mode (affects tolerance calculation) */
  isUsdMode?: boolean;
}

export function SpendingProgressBar({
  spent,
  budget,
  className,
  showLabel = true,
  useTolerance = false,
  isUsdMode = false,
}: SpendingProgressBarProps) {
  // Calculate percentage spent
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  // Calculate tolerance for over-budget detection
  // This prevents false positives from exchange rate drift and rounding errors
  const tolerance = useTolerance
    ? (isUsdMode ? Math.max(0.05, budget * 0.001) : Math.max(10, budget * 0.001))
    : 0;

  const isOverBudget = spent > budget + tolerance;

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>
            {percentage.toFixed(0)}% spent
          </span>
          {isOverBudget && (
            <span className="text-destructive font-medium">
              Over budget!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
