import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetState } from '@/lib/budgetTypes';
import {
  BudgetSnapshot,
  DeletionRecord,
  SyncStatus,
  createSnapshot,
  compareSnapshots,
  verifyIntegrity,
  deserializeSnapshot,
} from '@/lib/budgetVersioning';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078; // NIP-78 Application-specific data

interface ManualSyncState {
  localSnapshot: BudgetSnapshot | null;
  cloudSnapshot: BudgetSnapshot | null;
  syncStatus: SyncStatus | null;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
}

export function useManualSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<ManualSyncState>({
    localSnapshot: null,
    cloudSnapshot: null,
    syncStatus: null,
    isLoading: false,
    isSyncing: false,
    error: null,
  });

  // Fetch cloud snapshot from Nostr
  const { data: cloudEvent, isLoading: isLoadingCloud, refetch } = useQuery({
    queryKey: ['budget-cloud', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return null;

      const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const events = await nostr.query(
        [
          {
            kinds: [BUDGET_KIND],
            authors: [user.pubkey],
            '#d': [APP_IDENTIFIER],
            limit: 1,
          },
        ],
        { signal: combinedSignal }
      );

      if (events.length === 0) return null;

      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        if (!user.signer.nip44) {
          throw new Error('Signer does not support NIP-44 encryption');
        }

        const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
        const snapshot = deserializeSnapshot(decrypted);

        // Verify integrity
        const integrity = await verifyIntegrity(snapshot);
        if (!integrity.valid) {
          throw new Error(`Cloud snapshot corrupted: ${integrity.reason}`);
        }

        return snapshot;
      } catch (e) {
        console.error('Failed to decrypt budget data:', e);
        throw e;
      }
    },
    enabled: !!user?.pubkey && !!user?.signer?.nip44,
    staleTime: Infinity, // Manual sync, never auto-refetch
    refetchOnWindowFocus: false,
  });

  /**
   * Check sync status (compare local vs cloud)
   */
  const checkSyncStatus = useCallback(
    (localSnapshot: BudgetSnapshot) => {
      setState(prev => ({
        ...prev,
        localSnapshot,
      }));

      if (!cloudEvent) {
        const status = compareSnapshots(localSnapshot, null);
        setState(prev => ({
          ...prev,
          syncStatus: status,
          error: null,
        }));
        return status;
      }

      const status = compareSnapshots(localSnapshot, cloudEvent);
      setState(prev => ({
        ...prev,
        syncStatus: status,
        error: null,
      }));
      return status;
    },
    [cloudEvent]
  );

  /**
   * Push local snapshot to cloud
   */
  const pushToCloud = useCallback(
    async (localSnapshot: BudgetSnapshot): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        setState(prev => ({
          ...prev,
          error: 'Not logged in or signer unavailable',
        }));
        return false;
      }

      setState(prev => ({
        ...prev,
        isSyncing: true,
        error: null,
      }));

      try {
        const encrypted = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(localSnapshot)
        );

        await publish({
          kind: BUDGET_KIND,
          content: encrypted,
          tags: [
            ['d', APP_IDENTIFIER],
            ['version', localSnapshot.version.toString()],
            ['checksum', localSnapshot.checksum],
            ['alt', `Sat Sorter budget snapshot v${localSnapshot.version}`],
          ],
        });

        setState(prev => ({
          ...prev,
          isSyncing: false,
          cloudSnapshot: localSnapshot,
        }));

        // Refetch to confirm
        queryClient.invalidateQueries({ queryKey: ['budget-cloud', user.pubkey] });

        return true;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to push to cloud';
        setState(prev => ({
          ...prev,
          isSyncing: false,
          error: errorMsg,
        }));
        console.error('Push to cloud failed:', e);
        return false;
      }
    },
    [user, publish, queryClient]
  );

  /**
   * Pull cloud snapshot to local
   */
  const pullFromCloud = useCallback(async (): Promise<BudgetSnapshot | null> => {
    if (!cloudEvent) {
      setState(prev => ({
        ...prev,
        error: 'No cloud backup found',
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isSyncing: true,
      error: null,
    }));

    try {
      const result = await refetch();

      if (result.data) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          cloudSnapshot: result.data,
        }));
        return result.data;
      }

      throw new Error('Failed to retrieve cloud snapshot');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to pull from cloud';
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMsg,
      }));
      console.error('Pull from cloud failed:', e);
      return null;
    }
  }, [cloudEvent, refetch]);

  /**
   * Refresh cloud status
   */
  const refreshCloudStatus = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
    }));

    try {
      await refetch();
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    } catch (e) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to refresh',
      }));
    }
  }, [refetch]);

  return {
    // State
    localSnapshot: state.localSnapshot,
    cloudSnapshot: state.cloudSnapshot,
    syncStatus: state.syncStatus,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    error: state.error,
    canSync: !!user?.pubkey && !!user?.signer?.nip44,

    // Actions
    checkSyncStatus,
    pushToCloud,
    pullFromCloud,
    refreshCloudStatus,
  };
}
