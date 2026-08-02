/**
 * BudgetBuddyMascot — A custom SVG of a financial advisor character
 * doing the "shh" (finger to lips) gesture to signify privacy.
 *
 * Designed to be clean and readable at small sizes (24-56px).
 * Uses currentColor for strokes so it adapts to light/dark mode.
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
      {/* Head — rounded, friendly */}
      <circle
        cx="24"
        cy="20"
        r="13"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Left eye */}
      <circle cx="19" cy="18" r="1.8" fill="currentColor" />

      {/* Right eye */}
      <circle cx="29" cy="18" r="1.8" fill="currentColor" />

      {/* Eyebrows — slight concerned/attentive look */}
      <path
        d="M16 14.5 L21.5 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M26.5 14 L32 14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* The "shh" finger — index finger raised vertically to the lips.
          Positioned over the mouth area, slightly offset to look natural. */}
      <path
        d="M24 24 L24 32"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Finger tip — rounded top */}
      <circle
        cx="24"
        cy="24"
        r="1.8"
        fill="currentColor"
      />

      {/* Closed lips — small horizontal line below the finger, 
          slightly curved to suggest "shh" */}
      <path
        d="M20.5 26.5 Q24 27.5 27.5 26.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Shoulders — simple suggestion of a body/torso */}
      <path
        d="M14 35 Q14 40 24 41 Q34 40 34 35"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Tie or collar suggestion — minimal professional touch */}
      <path
        d="M22 41 L22 45 M26 41 L26 45 M22 43 L26 43"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
