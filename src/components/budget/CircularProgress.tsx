import { cn } from '@/lib/utils';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  value?: string;
  className?: string;
}

/**
 * Flat Bauhaus donut. Burnt-orange arc on a muted track, mono numerals.
 * No gradient, no glow.
 */
export function CircularProgress({
  percentage, size = 64, strokeWidth = 8, label, value, className,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercentage = Math.min(percentage, 100);
  const offset = circumference - (clampedPercentage / 100) * circumference;

  const getColor = () => {
    if (percentage > 100) return 'hsl(var(--destructive))';
    if (percentage >= 90) return 'hsl(var(--mustard))';
    return 'hsl(var(--primary))';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease' }}
        />
      </svg>
      {(label || value) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {value && <span className="font-mono text-base leading-none">{value}</span>}
          {label && <span className="bh-caption text-muted-foreground leading-none mt-1">{label}</span>}
        </div>
      )}
    </div>
  );
}
