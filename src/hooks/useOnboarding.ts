import { useLocalStorage } from '@/hooks/useLocalStorage';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  completedAt?: number;
  skippedAt?: number;
  version: number; // For future onboarding updates
}

const DEFAULT_STATE: OnboardingState = {
  hasCompletedOnboarding: false,
  version: 1,
};

const CURRENT_VERSION = 1;

export function useOnboarding() {
  const [state, setState] = useLocalStorage<OnboardingState>(
    'sat-sorter-onboarding',
    DEFAULT_STATE
  );

  const completeOnboarding = () => {
    setState({
      hasCompletedOnboarding: true,
      completedAt: Date.now(),
      version: CURRENT_VERSION,
    });
  };

  const resetOnboarding = () => {
    setState(DEFAULT_STATE);
  };

  // Check if user should see onboarding
  // Show if they haven't completed it OR if there's a new version
  const shouldShowOnboarding = !state.hasCompletedOnboarding || state.version < CURRENT_VERSION;

  return {
    shouldShowOnboarding,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
}
