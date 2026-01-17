import { cn } from '@/lib/utils';

interface SpendingProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
  /**
   * Optional USD values for accurate over-budget detection.
   * When provided, these are used for the over-budget comparison instead of
   * the display values, preventing false positives from exchange rate drift.
   */
  spentUsdForComparison?: number;
  budgetUsdForComparison?: number;
}

export function SpendingProgressBar({
  spent,
  budget,
  className,
  showLabel = true,
  spentUsdForComparison,
  budgetUsdForComparison,
}: SpendingProgressBarProps) {
  // Calculate percentage spent (using display values)
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  // For over-budget detection, use USD comparison if available (more accurate)
  // Otherwise fall back to the display values with a small tolerance
  const isOverBudget = (() => {
    if (spentUsdForComparison !== undefined && budgetUsdForComparison !== undefined) {
      // Use USD comparison with small tolerance for rounding ($0.05 or 0.1%)
      const tolerance = Math.max(0.05, budgetUsdForComparison * 0.001);
      return spentUsdForComparison > budgetUsdForComparison + tolerance;
    }
    // Fallback: direct comparison with small tolerance
    const tolerance = Math.max(10, budget * 0.001);
    return spent > budget + tolerance;
  })();

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
