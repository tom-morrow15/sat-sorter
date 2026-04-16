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

    // SAFETY GUARD: refuse to upload an empty budget. This prevents a bad
    // state (e.g. freshly-initialized browser that hasn't finished downloading
    // the user's remote budget) from wiping out the user's saved data.
    if (!budgetState.budgets || budgetState.budgets.length === 0) {
      console.warn('[useBudgetSync] Refusing to upload empty budget state to protect remote data');
      setSyncStatus(prev => ({
        ...prev,
        error: 'Refusing to upload an empty budget. Reload the app and try again.',
      }));
      return false;
    }

    // SAFETY GUARD: if the remote already has a budget that is significantly
    // larger than what we're about to upload, warn and refuse. This catches
    // the case where another device has more data than this one.
    try {
      const existingEvents = await nostr.query(
        [{
          kinds: [BUDGET_KIND],
          authors: [user.pubkey],
          '#d': [APP_IDENTIFIER],
          limit: 1,
        }],
        { signal: AbortSignal.timeout(5000) }
      );

      if (existingEvents.length > 0 && user.signer.nip44) {
        try {
          const existingContent = await user.signer.nip44.decrypt(
            user.pubkey,
            existingEvents[0].content
          );
          const parsed = JSON.parse(existingContent);
          // Handle both plain BudgetState and snapshot-wrapped payloads
          const existingState: BudgetState = parsed?.data?.budgets ? parsed.data : parsed;

          if (existingState?.budgets?.length) {
            const localMonths = new Set(budgetState.budgets.map(b => b.month));
            const missingMonths = existingState.budgets.filter(b => !localMonths.has(b.month));

            if (missingMonths.length > 0) {
              console.warn(
                '[useBudgetSync] Upload would drop months present on remote, aborting',
                { missing: missingMonths.map(b => b.month) }
              );
              setSyncStatus(prev => ({
                ...prev,
                isSyncing: false,
                error: `Cannot save: remote has ${missingMonths.length} month(s) not in local data (${missingMonths.map(b => b.month).join(', ')}). Please reload to merge first.`,
              }));
              return false;
            }
          }
        } catch (e) {
          // If we can't decrypt/parse remote, proceed with upload
          console.log('[useBudgetSync] Could not verify remote state before upload:', e);
        }
      }
    } catch (e) {
      // If the pre-check fails entirely (network), proceed with upload
      console.log('[useBudgetSync] Pre-upload check failed, proceeding:', e);
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
  }, [user, publish, queryClient, nostr]);

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
