import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { getSecretKey, hasSession, saveSession } from '@/utils/sessionStore';
import { encryptSecretKey } from '@/utils/nostrAuth';
import type { KeyPair } from '@/utils/nostrAuth';
import type { BudgetState } from '@/lib/budgetTypes';
import type { useBudgetSync } from '@/hooks/useBudgetSync';

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
  upgradeGuest: (opts: {
    secretKey: Uint8Array;
    nsec: string;
    npub: string;
    budgetState: BudgetState;
    publishBudget: (budgetState: BudgetState) => Promise<boolean>;
  }) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const GUEST_KEY = 'sat-sorter-guest-mode';
const GUEST_BUDGET_KEY = 'sat-sorter-budget';

/**
 * Generate a browser-local encryption password.
 * This is derived from the browser's crypto API and stays on-device.
 */
function generateBrowserPassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>('loading');
  const [keys, setKeys] = useState<OnboardingKeys | null>(null);

  // Access NostrLoginProvider to check for existing browser extension logins
  const { logins } = useNostrLogin();

  const hasNostrLogin = logins.length > 0;

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Priority 1: If NostrLoginProvider already has logins (NIP-07 extension, etc.),
        // the user is already authenticated. Skip onboarding entirely.
        if (hasNostrLogin) {
          setState('authenticated');
          return;
        }

        // Priority 2: Check if guest mode was previously selected
        const isGuest = localStorage.getItem(GUEST_KEY) === 'true';
        if (isGuest) {
          setState('guest');
          return;
        }

        // Priority 3: Check for existing encrypted session (our onboarding flow)
        const hasExistingSession = await hasSession();
        if (hasExistingSession) {
          const secretKey = await getSecretKey();
          if (secretKey) {
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
  }, [hasNostrLogin]);

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

  /**
   * Upgrade from guest mode to a Nostr account.
   * Encrypts existing localStorage budget data and publishes to relays.
   */
  const upgradeGuest = useCallback(async (opts: {
    secretKey: Uint8Array;
    nsec: string;
    npub: string;
    budgetState: BudgetState;
    publishBudget: (budgetState: BudgetState) => Promise<boolean>;
  }): Promise<void> => {
    const { secretKey, nsec, npub, budgetState, publishBudget } = opts;

    // 1. Encrypt and save the session
    const password = generateBrowserPassword();
    const ncryptsec = encryptSecretKey(secretKey, password);
    await saveSession(ncryptsec, password);

    // 2. Publish existing budget data to relays
    const success = await publishBudget(budgetState);

    // 3. If successful, clean up guest localStorage data
    if (success) {
      localStorage.removeItem(GUEST_BUDGET_KEY);
      localStorage.removeItem(GUEST_KEY);
    }

    // 4. Transition to authenticated state
    setKeys({
      secretKey,
      nsec,
      npub,
      displayName: '',
      currency: 'USD',
      showSats: false,
    });
    localStorage.setItem('sat-sorter-onboarded', 'true');
    setState('authenticated');
  }, []);

  return (
    <OnboardingContext.Provider value={{ state, keys, setGuestMode, completeOnboarding, signOut, upgradeGuest }}>
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
