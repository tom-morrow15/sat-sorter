import { useNavigate, useLocation } from 'react-router-dom';
import { useAISettings } from '@/hooks/useAISettings';
import { BudgetBuddyMascot } from '@/components/maple/BudgetBuddyMascot';
import { cn } from '@/lib/utils';

/**
 * Floating Budget Buddy button — appears on budget-related pages
 * (Home, Breakdown) as a floating chat bubble in the bottom-right corner.
 *
 * - Orange and clickable when API key is set + disclaimer accepted
 * - Greyed out and non-clickable when not configured
 * - Hidden on the Buddy page itself and non-budget pages
 */
export function BudgetBuddyFAB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMapleEnabled } = useAISettings();

  // Only show on budget-related pages — not on the Buddy page itself,
  // not on Wealth, or onboarding pages
  const visiblePages = ['/home', '/breakdown'];
  if (!visiblePages.includes(location.pathname)) return null;

  return (
    <button
      onClick={() => isMapleEnabled && navigate('/buddy')}
      disabled={!isMapleEnabled}
      className={cn(
        'fixed bottom-24 right-4 z-30 flex items-center justify-center',
        'h-14 w-14 rounded-full shadow-lg transition-all',
        'press-feedback',
        isMapleEnabled
          ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95 cursor-pointer'
          : 'bg-muted text-muted-foreground/40 border-2 border-dashed border-muted-foreground/30 cursor-not-allowed'
      )}
      title={isMapleEnabled ? 'Ask your Budget Buddy' : 'Set up Budget Buddy in the menu and accept the disclaimer'}
      aria-label="Budget Buddy"
    >
      <BudgetBuddyMascot size={28} />
    </button>
  );
}
