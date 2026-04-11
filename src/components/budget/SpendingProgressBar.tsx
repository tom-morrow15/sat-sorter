import { AlertCircle } from 'lucide-react';
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
  const remaining = budget - spent;
  const remainingPercent = budget > 0 ? (remaining / budget) * 100 : 0;
  
  const isOverBudget = spent > budget;
  const isWarning = remainingPercent <= 20 && remainingPercent > 0; // < 20% remaining
  const isCritical = remainingPercent <= 10 && remainingPercent > 0; // < 10% remaining
  const isNearFull = remainingPercent <= 5 && remainingPercent > 0; // < 5% remaining

  // Determine bar color based on status
  const barColor = isOverBudget 
    ? 'bg-destructive' 
    : isNearFull
    ? 'bg-red-500'
    : isCritical
    ? 'bg-orange-500'
    : isWarning
    ? 'bg-yellow-500'
    : 'bg-primary';

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            barColor
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {percentage.toFixed(0)}% spent
            {!isOverBudget && remaining > 0 && (
              <span className="ml-1">({remainingPercent.toFixed(0)}% left)</span>
            )}
          </span>
          {isOverBudget && (
            <span className="text-destructive font-medium">
              Over budget!
            </span>
          )}
          {isWarning && !isOverBudget && (
            <div className="flex items-center gap-1 text-yellow-600 font-medium">
              <AlertCircle className="h-3 w-3" />
              {isCritical ? 'Critical' : 'Low'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
