import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useEffect } from 'react';

export interface SubscriptionStatus {
  pubkey: string;
  tier: 'free' | 'paid' | 'trial';
  buckets: number;
  items_per_bucket: number;
  expires_at: string | null;
  payment_type: 'none' | 'monthly' | 'yearly';
}

const WORKER_URL = 'https://sat-sorter-worker.satsorter.workers.dev';

export function useSubscription() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { nostr } = useNostr();

  const query = useQuery<SubscriptionStatus | null>({
    queryKey: ['subscription', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return null;

      try {
        const response = await fetch(
          `${WORKER_URL}/api/subscription/status?pubkey=${encodeURIComponent(user.pubkey)}`
        );

        if (!response.ok) {
          console.error('Failed to fetch subscription status:', response.statusText);
          return null;
        }

        return response.json();
      } catch (error) {
        console.error('Error fetching subscription status:', error);
        return null;
      }
    },
    enabled: !!user?.pubkey,
    refetchInterval: 5000, // Refetch every 5 seconds to catch payments quickly
    staleTime: 2000, // Consider data stale after 2 seconds
  });

  // Listen for incoming zap receipts (kind 9735) to your lightning address
  useEffect(() => {
    if (!user?.pubkey || !nostr) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const listenForZaps = async () => {
      try {
        // Query for zap receipts to your pubkey (as recipient)
        // Your lightning address (devin@getalby.com) should be tied to a specific pubkey
        // For now, we'll skip this as it requires knowing the Alby provider pubkey
        // Instead, we rely on periodic polling for now

        // In production, you'd listen for kind 9735 events with your pubkey as recipient
      } catch (error) {
        console.error('Error listening for zaps:', error);
      }
    };

    listenForZaps();

    return () => {
      controller.abort();
    };
  }, [user?.pubkey, nostr]);

  return query;
}

export function useCreateInvoice() {
  return async (amount: number, comment?: string) => {
    try {
      const response = await fetch(`${WORKER_URL}/api/subscription/create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, comment }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  };
}

export function useApplyPayment() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return async (amountMsat: number, tier: 'monthly' | 'yearly' = 'monthly') => {
    if (!user?.pubkey) throw new Error('User not logged in');

    try {
      const response = await fetch(`${WORKER_URL}/api/subscription/apply-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pubkey: user.pubkey,
          amountMsat,
          tier,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to apply payment: ${response.statusText}`);
      }

      const result = await response.json();

      // Invalidate subscription query to force refetch
      queryClient.invalidateQueries({ queryKey: ['subscription', user.pubkey] });

      return result;
    } catch (error) {
      console.error('Error applying payment:', error);
      throw error;
    }
  };
}
