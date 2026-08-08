import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  /** Page eyebrow/label shown small above the title, e.g. "SPENDING" */
  eyebrow?: string;
  /** Large page title (Cochin serif) */
  title: string;
  /** Optional supporting line under the title */
  subtitle?: ReactNode;
  /** Optional right-aligned action(s) in the hero (e.g. a button) */
  action?: ReactNode;
  /** Content that visually overlaps the hero seam (e.g. a summary card). Sits pulled up. */
  hero?: ReactNode;
  /** Main page content */
  children: ReactNode;
  /** Constrain content width. Defaults to max-w-2xl for reading comfort. */
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
}

/**
 * PageShell — the single structural primitive every page uses.
 *
 * It renders a dark "brand hero" band (matching the app's brand surface),
 * then floats the page content up over the seam so the dark→light transition
 * feels like ONE continuous surface rather than two stacked apps.
 */
export function PageShell({
  eyebrow,
  title,
  subtitle,
  action,
  hero,
  children,
  width = 'default',
  className,
}: PageShellProps) {
  const maxW =
    width === 'narrow' ? 'max-w-xl' : width === 'wide' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div className="min-h-screen bg-background">
      {/* Brand hero band — flows down from the fixed app bar */}
      <div className="brand-hero relative overflow-hidden">
        <div className="wormhole-grid-bg" aria-hidden />
        <div className="wormhole-glow" aria-hidden />
        <div className={cn('relative z-10 mx-auto px-4 sm:px-6 pt-5 pb-24', maxW)}>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 mb-1">
                  {eyebrow}
                </p>
              )}
              <h1 className="font-display text-3xl sm:text-4xl text-white leading-none">
                {title}
              </h1>
              {subtitle && (
                <div className="text-sm text-white/55 mt-2">{subtitle}</div>
              )}
            </div>
            {action && <div className="shrink-0 pb-1">{action}</div>}
          </div>
        </div>
      </div>

      {/* Content floats up over the seam */}
      <main className={cn('relative z-20 mx-auto px-4 sm:px-6 -mt-16 pb-6', maxW, className)}>
        {hero && <div className="mb-4">{hero}</div>}
        {children}
      </main>
    </div>
  );
}
