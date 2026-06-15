import { cn } from '@/lib/utils';

interface CircularProgressProps {
  /** Percentage value 0-100 (can exceed 100 for over-budget) */
  percentage: number;
  /** Size of the circle in pixels */
  size?: number;
  /** Stroke width of the progress ring */
  strokeWidth?: number;
  /** Optional label to display in center */
  label?: string;
  /** Optional value to display in center */
  value?: string;
  className?: string;
}

/**
 * A polished circular progress indicator like those used in professional
 * budgeting apps. Color-codes based on usage level.
 */
export function CircularProgress({
  percentage,
  size = 64,
  strokeWidth = 6,
  label,
  value,
  className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercentage = Math.min(percentage, 100);
  const offset = circumference - (clampedPercentage / 100) * circumference;

  // Color based on usage level
  const getColor = () => {
    if (percentage > 100) return 'hsl(var(--destructive))';
    if (percentage >= 90) return 'hsl(28 85% 52%)'; // orange warning
    if (percentage >= 75) return 'hsl(45 90% 50%)'; // amber
    return 'hsl(var(--success))'; // green - healthy
  };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s ease',
          }}
        />
      </svg>
      {/* Center content */}
      {(label || value) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {value && (
            <span className="text-sm font-bold leading-none tabular-nums">
              {value}
            </span>
          )}
          {label && (
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
