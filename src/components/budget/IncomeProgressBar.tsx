import { cn } from '@/lib/utils';

interface IncomeProgressBarProps {
  earned: number;
  target: number;
  className?: string;
  showLabel?: boolean;
}

export function IncomeProgressBar({
  earned,
  target,
  className,
  showLabel = true,
}: IncomeProgressBarProps) {
  // Calculate percentage earned
  const percentage = target > 0 ? Math.min((earned / target) * 100, 100) : 0;
  const isSurplusIncome = earned > target;

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            'bg-success'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>
            {percentage.toFixed(0)}% earned
          </span>
          {isSurplusIncome && (
            <span className="text-success font-medium">
              Goal achieved!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
