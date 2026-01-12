import { useCallback, useState, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetState } from '@/lib/budgetTypes';
import { getSafeNip44 } from '@/lib/utils';

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

  // Safely check for NIP-44 support (handles extension not installed case)
  const nip44 = useMemo(() => getSafeNip44(user), [user]);
  const hasNip44 = nip44 !== null;

  // Fetch existing budget data from Nostr
  const { data: remoteBudget, isLoading: isLoadingRemote, refetch } = useQuery({
    queryKey: ['budget-sync', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey || !nip44) return null;

      const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const events = await nostr.query([
        {
          kinds: [BUDGET_KIND],
          authors: [user.pubkey],
          '#d': [APP_IDENTIFIER],
          limit: 1,
        },
      ], { signal: combinedSignal });

      console.log('[BudgetSync] Query returned', events.length, 'events');

      if (events.length === 0) {
        console.log('[BudgetSync] No existing budget data found on relays');
        return null;
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      console.log('[BudgetSync] Found budget event', {
        created_at: latestEvent.created_at,
        contentLength: latestEvent.content.length,
        contentPreview: latestEvent.content.substring(0, 50) + '...',
      });

      try {
        console.log('[BudgetSync] Decrypting budget data...');
        const decrypted = await nip44.decrypt(user.pubkey, latestEvent.content);
        const budgetData: BudgetState = JSON.parse(decrypted);

        // Validate the decrypted data
        if (!budgetData || !Array.isArray(budgetData.budgets)) {
          console.warn('[BudgetSync] Decrypted budget data is invalid', { budgetData });
          return null;
        }

        console.log('[BudgetSync] Budget decrypted successfully', {
          budgetCount: budgetData.budgets.length,
          currentMonth: budgetData.currentMonth,
        });

        return {
          data: budgetData,
          timestamp: latestEvent.created_at,
        };
      } catch (e) {
        console.error('[BudgetSync] Failed to decrypt budget data:', e);
        return null;
      }
    },
    enabled: !!user?.pubkey && hasNip44,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Upload budget data to Nostr
  const uploadBudget = useCallback(async (budgetState: BudgetState): Promise<boolean> => {
    if (!user?.pubkey || !nip44) {
      console.warn('[BudgetSync] Cannot sync: user not logged in or signer lacks NIP-44 support');
      setSyncStatus(prev => ({ ...prev, error: 'Not logged in or signer unavailable' }));
      return false;
    }

    // Validate the budget state structure
    if (!budgetState || !Array.isArray(budgetState?.budgets)) {
      console.warn('[BudgetSync] Invalid budget state structure', { budgetState, budgets: budgetState?.budgets });
      setSyncStatus(prev => ({ ...prev, error: 'Invalid budget data' }));
      return false;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Serialize the budget data
      const plaintext = JSON.stringify(budgetState);
      const budgetCount = Array.isArray(budgetState.budgets) ? budgetState.budgets.length : 0;
      console.log('[BudgetSync] Encrypting budget data...', {
        budgetCount,
        currentMonth: budgetState.currentMonth,
        plaintextLength: plaintext.length,
      });

      // Encrypt the budget data with NIP-44 (to self)
      // This uses the user's own pubkey, so only they can decrypt it
      const encrypted = await nip44.encrypt(
        user.pubkey,
        plaintext
      );

      console.log('[BudgetSync] Data encrypted successfully', {
        encryptedLength: encrypted.length,
        isEncrypted: encrypted !== plaintext && !encrypted.includes('"budgets"'),
      });

      // Publish as NIP-78 event (application-specific data)
      await publish({
        kind: BUDGET_KIND,
        content: encrypted,
        tags: [
          ['d', APP_IDENTIFIER],
          ['alt', 'Sat Sorter budget data (encrypted)'],
        ],
      });

      console.log('[BudgetSync] Budget published to relays successfully');

      setSyncStatus({
        lastSynced: Math.floor(Date.now() / 1000),
        isSyncing: false,
        error: null,
      });

      // Invalidate the query to refresh
      queryClient.invalidateQueries({ queryKey: ['budget-sync', user.pubkey] });

      return true;
    } catch (e) {
      console.error('[BudgetSync] Failed to upload budget:', e);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to sync',
      }));
      return false;
    }
  }, [user, nip44, publish, queryClient]);

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
    canSync: !!user?.pubkey && hasNip44,
  };
}
