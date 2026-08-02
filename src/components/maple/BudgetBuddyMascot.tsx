/**
 * BudgetBuddyMascot — A speech bubble with a sparkle/star inside.
 * Communicates "AI chat" instantly: the bubble says "talk" and the
 * sparkle says "AI". Uses currentColor so it adapts to light/dark mode.
 */

interface MascotProps {
  className?: string;
  size?: number;
}

export function BudgetBuddyMascot({ className, size = 28 }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Speech bubble — rounded rectangle with a tail */}
      <path
        d="M8 10 H40 Q44 10 44 14 V28 Q44 32 40 32 H20 L12 40 V32 H8 Q4 32 4 28 V14 Q4 10 8 10 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />

      {/* AI Sparkle — four-pointed star inside the bubble */}
      <path
        d="M24 14 L26.5 21.5 L34 24 L26.5 26.5 L24 34 L21.5 26.5 L14 24 L21.5 21.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}
