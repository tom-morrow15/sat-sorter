import { useNavigate, useLocation } from 'react-router-dom';
import { useAISettings } from '@/hooks/useAISettings';
import { BudgetBuddyMascot } from '@/components/maple/BudgetBuddyMascot';
import { cn } from '@/lib/utils';

/**
 * Floating Budget Buddy button — appears on budget-related pages
 * (Home, Breakdown) as a floating chat bubble in the bottom-right corner.
 *
 * - Orange when configured, grey when not
 * - Navigates to /buddy on tap
 * - Hidden on the Buddy page itself and non-budget pages
 */
export function BudgetBuddyFAB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasKey } = useAISettings();

  // Only show on budget-related pages — not on the Buddy page itself,
  // not on Wealth, or onboarding pages
  const visiblePages = ['/home', '/breakdown'];
  if (!visiblePages.includes(location.pathname)) return null;

  return (
    <button
      onClick={() => navigate('/buddy')}
      className={cn(
        'fixed bottom-20 right-4 z-50 flex items-center justify-center',
        'h-14 w-14 rounded-full shadow-lg transition-all',
        'hover:scale-105 active:scale-95 press-feedback',
        hasKey
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/40'
      )}
      title={hasKey ? 'Ask your Budget Buddy' : 'Set up Budget Buddy in the menu'}
      aria-label="Budget Buddy"
    >
      <BudgetBuddyMascot size={28} />
    </button>
  );
}
