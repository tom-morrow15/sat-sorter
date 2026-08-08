/**
 * BudgetBuddyMascot — A clean, Bauhaus-inspired geometric chat icon.
 * A rounded square with a tail and three dots (ellipsis) inside —
 * communicates "chat" and "thinking/AI" through simple geometry.
 * No star that gets cut off; everything stays within bounds.
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
      {/* Chat bubble — clean rounded square with tail */}
      <path
        d="M10 8 H38 Q42 8 42 12 V26 Q42 30 38 30 H22 L14 38 V30 H10 Q6 30 6 26 V12 Q6 8 10 8 Z"
        fill="currentColor"
      />
      {/* Three dots — "thinking" / ellipsis, stays well within bounds */}
      <circle cx="17" cy="19" r="2.2" fill="hsl(var(--background))" />
      <circle cx="24" cy="19" r="2.2" fill="hsl(var(--background))" />
      <circle cx="31" cy="19" r="2.2" fill="hsl(var(--background))" />
    </svg>
  );
}
