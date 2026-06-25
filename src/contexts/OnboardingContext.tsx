import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSecretKey, hasSession } from '@/utils/sessionStore';
import type { KeyPair } from '@/utils/nostrAuth';

export type OnboardingState = 'loading' | 'welcome' | 'authenticated' | 'guest';

export interface OnboardingKeys extends KeyPair {
  displayName: string;
  currency: string;
  showSats: boolean;
}

interface OnboardingContextValue {
  state: OnboardingState;
  keys: OnboardingKeys | null;
  setGuestMode: () => void;
  completeOnboarding: (keys: OnboardingKeys) => void;
  signOut: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const GUEST_KEY = 'sat-sorter-guest-mode';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>('loading');
  const [keys, setKeys] = useState<OnboardingKeys | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if guest mode was previously selected
        const isGuest = localStorage.getItem(GUEST_KEY) === 'true';
        if (isGuest) {
          setState('guest');
          return;
        }

        // Check for existing encrypted session
        const hasExistingSession = await hasSession();
        if (hasExistingSession) {
          const secretKey = await getSecretKey();
          if (secretKey) {
            // We have a valid session but need to reconstruct the identity
            // For now, just mark as authenticated - the existing Nostr login handles this
            setState('authenticated');
            return;
          }
        }

        // No session found
        setState('welcome');
      } catch {
        setState('welcome');
      }
    };

    checkSession();
  }, []);

  const setGuestMode = useCallback(() => {
    localStorage.setItem(GUEST_KEY, 'true');
    setState('guest');
  }, []);

  const completeOnboarding = useCallback((onboardingKeys: OnboardingKeys) => {
    localStorage.removeItem(GUEST_KEY);
    localStorage.setItem('sat-sorter-onboarded', 'true');
    setKeys(onboardingKeys);
    setState('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    const { clearSession } = await import('@/utils/sessionStore');
    await clearSession();
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem('sat-sorter-onboarded');
    setKeys(null);
    setState('welcome');
  }, []);

  return (
    <OnboardingContext.Provider value={{ state, keys, setGuestMode, completeOnboarding, signOut }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
