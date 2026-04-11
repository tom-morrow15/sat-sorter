import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetState } from '@/lib/budgetTypes';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078; // NIP-78 Application-specific data

interface SyncStatus {
  lastSynced: number | null;
  isSyncing: boolean;
  error: string | null;
}

export function useBudgetSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSynced: null,
    isSyncing: false,
    error: null,
  });

  // Fetch existing budget data from Nostr
  const { data: remoteBudget, isLoading: isLoadingRemote, refetch } = useQuery({
    queryKey: ['budget-sync', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return null;

      const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      
      const events = await nostr.query([
        {
          kinds: [BUDGET_KIND],
          authors: [user.pubkey],
          '#d': [APP_IDENTIFIER],
          limit: 1,
        },
      ], { signal: combinedSignal });

      if (events.length === 0) return null;

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      
      try {
        // Content is encrypted with NIP-44
        if (!user.signer.nip44) {
          console.warn('Signer does not support NIP-44 encryption');
          return null;
        }

        const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
        const budgetData: BudgetState = JSON.parse(decrypted);
        
        return {
          data: budgetData,
          timestamp: latestEvent.created_at,
        };
      } catch (e) {
        console.error('Failed to decrypt budget data:', e);
        return null;
      }
    },
    enabled: !!user?.pubkey && !!user?.signer?.nip44,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Upload budget data to Nostr
  const uploadBudget = useCallback(async (budgetState: BudgetState): Promise<boolean> => {
    if (!user?.pubkey || !user?.signer?.nip44) {
      setSyncStatus(prev => ({ ...prev, error: 'Not logged in or signer unavailable' }));
      return false;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Encrypt the budget data with NIP-44 (to self)
      const encrypted = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(budgetState)
      );

      // Publish as NIP-78 event
      await publish({
        kind: BUDGET_KIND,
        content: encrypted,
        tags: [
          ['d', APP_IDENTIFIER],
          ['alt', 'Sat Sorter budget data (encrypted)'],
        ],
      });

      setSyncStatus({
        lastSynced: Math.floor(Date.now() / 1000),
        isSyncing: false,
        error: null,
      });

      // Invalidate the query to refresh
      queryClient.invalidateQueries({ queryKey: ['budget-sync', user.pubkey] });
      
      return true;
    } catch (e) {
      console.error('Failed to upload budget:', e);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to sync',
      }));
      return false;
    }
  }, [user, publish, queryClient]);

  // Download budget data from Nostr
  const downloadBudget = useCallback(async (): Promise<BudgetState | null> => {
    if (!user?.pubkey) return null;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await refetch();
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: result.data?.timestamp || prev.lastSynced,
      }));

      return result.data?.data || null;
    } catch (e) {
      console.error('Failed to download budget:', e);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to download',
      }));
      return null;
    }
  }, [user, refetch]);

  return {
    // Remote data
    remoteBudget: remoteBudget?.data || null,
    remoteTimestamp: remoteBudget?.timestamp || null,
    isLoadingRemote,

    // Sync actions
    uploadBudget,
    downloadBudget,

    // Status
    syncStatus,
    canSync: !!user?.pubkey && !!user?.signer?.nip44,
  };
}
