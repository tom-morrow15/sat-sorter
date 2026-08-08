import { cn } from '@/lib/utils';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  value?: string;
  className?: string;
}

export function CircularProgress({
  percentage, size = 64, strokeWidth = 6, label, value, className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercentage = Math.min(percentage, 100);
  const offset = circumference - (clampedPercentage / 100) * circumference;

  const getColor = () => {
    if (percentage > 100) return 'hsl(var(--destructive))';
    if (percentage >= 90) return 'hsl(28 82% 52%)';
    if (percentage >= 75) return 'hsl(45 85% 50%)';
    return 'hsl(var(--success))';
  };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} opacity={0.5}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s ease',
          }}
        />
      </svg>
      {(label || value) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {value && (
            <span className="font-serif-display text-sm leading-none tabular-nums">{value}</span>
          )}
          {label && (
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}
