import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export interface SubscriptionStatus {
  pubkey: string;
  tier: 'free' | 'paid';
  buckets: number;
  items_per_bucket: number;
  expires_at: string | null;
}

const WORKER_URL = 'https://sat-sorter-worker.satsorter.workers.dev';

export function useSubscription() {
  const { user } = useCurrentUser();

  return useQuery<SubscriptionStatus | null>({
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
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
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
