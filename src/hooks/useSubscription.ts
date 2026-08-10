import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export interface SubscriptionStatus {
  pubkey: string;
  tier: 'free' | 'paid' | 'trial';
  buckets: number;
  items_per_bucket: number;
  expires_at: string | null;
  payment_type: 'none' | 'monthly' | 'yearly' | 'test';
  isGuest: boolean;
}

interface CreateInvoiceResponse {
  invoice: {
    pr: string;
    verify: string;
    status: string;
    successAction?: { message: string; tag: string };
  };
  invoiceId: string;
}

const WORKER_URL = 'https://sat-sorter-worker.satsorter.workers.dev';

/**
 * Hook to fetch the current user's subscription status.
 * - Guest users (not logged in) always get free tier with isGuest=true
 * - Logged-in users fetch from the backend, with periodic refetch
 */
export function useSubscription() {
  const { user } = useCurrentUser();

  return useQuery<SubscriptionStatus | null>({
    queryKey: ['subscription', user?.pubkey],
    queryFn: async () => {
      // Guest users (not logged in) always get free tier
      if (!user?.pubkey) {
        return {
          pubkey: '',
          tier: 'free',
          buckets: 5,
          items_per_bucket: 4,
          expires_at: null,
          payment_type: 'none',
          isGuest: true,
        };
      }

      try {
        const response = await fetch(
          `${WORKER_URL}/api/subscription/status?pubkey=${encodeURIComponent(user.pubkey)}`
        );

        if (!response.ok) {
          console.error('Failed to fetch subscription status:', response.statusText);
          return null;
        }

        const data = await response.json();
        return {
          ...data,
          isGuest: false,
        };
      } catch (error) {
        console.error('Error fetching subscription status:', error);
        return null;
      }
    },
    enabled: true,
    // Poll every 10 seconds for logged-in users (catches payment updates)
    // Guests don't need polling since their status never changes
    refetchInterval: user?.pubkey ? 10000 : undefined,
    staleTime: user?.pubkey ? 5000 : Infinity,
  });
}

/**
 * Hook to create a Lightning invoice via the backend.
 * The backend stores the invoice with the user's pubkey for later verification.
 */
export function useCreateInvoice() {
  const { user } = useCurrentUser();

  return async (amount: number, comment?: string): Promise<CreateInvoiceResponse> => {
    if (!user?.pubkey) {
      throw new Error('You must be logged in to upgrade');
    }

    const response = await fetch(`${WORKER_URL}/api/subscription/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, comment, pubkey: user.pubkey }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create invoice: ${response.statusText}`);
    }

    return response.json();
  };
}

/**
 * Hook to verify that a payment has been made.
 * This calls the backend which independently checks with Alby that the invoice was paid.
 * Once verified, the backend updates the user's subscription.
 *
 * The frontend should poll this every 3-5 seconds while waiting for payment.
 */
export function useVerifyPayment() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return async (invoiceId: string): Promise<{
    success: boolean;
    paid: boolean;
    alreadyPaid?: boolean;
    subscription?: Partial<SubscriptionStatus>;
    message?: string;
  }> => {
    if (!user?.pubkey) {
      throw new Error('You must be logged in to verify payment');
    }

    const response = await fetch(`${WORKER_URL}/api/subscription/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: user.pubkey, invoiceId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to verify payment: ${response.statusText}`);
    }

    const result = await response.json();

    // If payment was confirmed, invalidate the subscription query so UI updates
    if (result.success && result.paid) {
      queryClient.invalidateQueries({ queryKey: ['subscription', user.pubkey] });
    }

    return result;
  };
}

/**
 * Hook to apply a test code for unlimited access (development only).
 */
export function useApplyTestCode() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return async (testCode: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.pubkey) {
      throw new Error('You must be logged in to apply a test code');
    }

    const response = await fetch(`${WORKER_URL}/api/subscription/apply-test-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey: user.pubkey, testCode }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to apply test code');
    }

    const result = await response.json();

    // Force refetch of subscription status
    queryClient.invalidateQueries({ queryKey: ['subscription', user.pubkey] });

    return result;
  };
}
