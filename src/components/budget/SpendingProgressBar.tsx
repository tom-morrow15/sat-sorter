import { cn } from '@/lib/utils';

interface SpendingProgressBarProps {
  spent: number;
  budget: number;
  className?: string;
  showLabel?: boolean;
}

export function SpendingProgressBar({
  spent,
  budget,
  className,
  showLabel = true,
}: SpendingProgressBarProps) {
  // Calculate percentage spent
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const isOverBudget = spent > budget;

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
