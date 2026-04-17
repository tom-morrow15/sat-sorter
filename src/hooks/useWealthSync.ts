import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { WealthTrackerState } from '@/lib/wealthTypes';
import { scoreWealthState } from '@/lib/wealthTypes';

/**
 * Nostr sync for the Wealth Tracker.
 *
 * Mirrors the budget-sync architecture:
 * - Kind 30078 (NIP-78 application-specific data, addressable)
 * - NIP-44 encrypted to self (only the owner can decrypt)
 * - d-tag = `sat-sorter/wealth-data` (separate from budget so the two
 *   datasets can evolve independently)
 *
 * Intentionally kept separate from useBudgetSync so the two datasets can be
 * loaded / updated independently and wealth-only changes don't bloat the
 * budget event.
 */

export const WEALTH_APP_IDENTIFIER = 'sat-sorter/wealth-data';
export const WEALTH_KIND = 30078;

interface WealthSyncStatus {
  lastSynced: number | null;
  isSyncing: boolean;
  error: string | null;
}

export function useWealthSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  const [syncStatus, setSyncStatus] = useState<WealthSyncStatus>({
    lastSynced: null,
    isSyncing: false,
    error: null,
  });

  // Fetch existing wealth data from Nostr.
  const {
    data: remoteWealth,
    isLoading: isLoadingRemote,
    refetch,
  } = useQuery({
    queryKey: ['wealth-sync', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return null;
      if (!user.signer.nip44) return null;

      const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const events = await nostr.query(
        [
          {
            kinds: [WEALTH_KIND],
            authors: [user.pubkey],
            '#d': [WEALTH_APP_IDENTIFIER],
            limit: 1,
          },
        ],
        { signal: combinedSignal }
      );

      if (events.length === 0) return null;

      // Most recent event wins (relays should already return the latest for
      // an addressable event, but sort defensively).
      const latest = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        const decrypted = await user.signer.nip44.decrypt(user.pubkey, latest.content);
        const parsed = JSON.parse(decrypted);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.watchedAddresses)) {
          console.warn('[useWealthSync] Unknown remote wealth shape');
          return null;
        }
        return {
          data: parsed as WealthTrackerState,
          timestamp: latest.created_at,
        };
      } catch (e) {
        console.error('[useWealthSync] Failed to decrypt wealth data:', e);
        return null;
      }
    },
    enabled: !!user?.pubkey && !!user?.signer?.nip44,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  /**
   * Upload wealth data to Nostr.
   *
   * Options:
   *   allowEmpty      – allow uploading a state with zero addresses (used for
   *                     legitimate "remove all" flows). Otherwise rejected.
   *   skipRemoteCheck – skip the pre-upload "is remote richer than local?"
   *                     safety guard.
   */
  const uploadWealth = useCallback(
    async (
      state: WealthTrackerState,
      options: { allowEmpty?: boolean; skipRemoteCheck?: boolean } = {}
    ): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        setSyncStatus((prev) => ({ ...prev, error: 'Not logged in or signer unavailable' }));
        return false;
      }

      // SAFETY: don't blast over remote if local has nothing to say.
      if (!options.allowEmpty && (!state.watchedAddresses || state.watchedAddresses.length === 0)) {
        console.warn('[useWealthSync] Refusing to upload empty wealth state');
        setSyncStatus((prev) => ({
          ...prev,
          error:
            'Refusing to upload empty wealth data — this would wipe addresses saved on other devices.',
        }));
        return false;
      }

      // SAFETY: check the remote's richness. If it has strictly more data than
      // us, abort — we're probably uploading before the login-time download
      // finished.
      if (!options.skipRemoteCheck) {
        try {
          const existingEvents = await nostr.query(
            [
              {
                kinds: [WEALTH_KIND],
                authors: [user.pubkey],
                '#d': [WEALTH_APP_IDENTIFIER],
                limit: 1,
              },
            ],
            { signal: AbortSignal.timeout(5000) }
          );

          if (existingEvents.length > 0) {
            try {
              const existingContent = await user.signer.nip44.decrypt(
                user.pubkey,
                existingEvents[0].content
              );
              const parsed = JSON.parse(existingContent);
              if (parsed && Array.isArray(parsed.watchedAddresses)) {
                const remoteScore = scoreWealthState(parsed);
                const localScore = scoreWealthState(state);
                // If remote has substantially more data, abort. Allow small
                // differences (e.g. one missed snapshot) through.
                if (remoteScore > 0 && localScore < remoteScore * 0.5) {
                  console.warn(
                    '[useWealthSync] Upload would lose data vs remote, aborting',
                    { remoteScore, localScore }
                  );
                  setSyncStatus((prev) => ({
                    ...prev,
                    isSyncing: false,
                    error:
                      'Cannot save wealth data: the cloud copy has more addresses or history than this device. Reload to sync first.',
                  }));
                  return false;
                }
              }
            } catch (e) {
              // Can't decrypt/parse — proceed.
              console.log('[useWealthSync] Pre-upload verification skipped:', e);
            }
          }
        } catch (e) {
          console.log('[useWealthSync] Pre-upload network check failed, proceeding:', e);
        }
      }

      setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

      try {
        const encrypted = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(state)
        );

        await publish({
          kind: WEALTH_KIND,
          content: encrypted,
          tags: [
            ['d', WEALTH_APP_IDENTIFIER],
            ['alt', 'Sat Sorter wealth tracker data (encrypted)'],
          ],
        });

        setSyncStatus({
          lastSynced: Math.floor(Date.now() / 1000),
          isSyncing: false,
          error: null,
        });

        queryClient.invalidateQueries({ queryKey: ['wealth-sync', user.pubkey] });
        return true;
      } catch (e) {
        console.error('[useWealthSync] Failed to upload wealth data:', e);
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          error: e instanceof Error ? e.message : 'Failed to sync',
        }));
        return false;
      }
    },
    [user, publish, queryClient, nostr]
  );

  /** Manually pull remote wealth data. Returns the decrypted state or null. */
  const downloadWealth = useCallback(async (): Promise<WealthTrackerState | null> => {
    if (!user?.pubkey) return null;
    setSyncStatus((prev) => ({ ...prev, isSyncing: true, error: null }));
    try {
      const result = await refetch();
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSynced: result.data?.timestamp || prev.lastSynced,
      }));
      return result.data?.data || null;
    } catch (e) {
      console.error('[useWealthSync] Failed to download wealth data:', e);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to download',
      }));
      return null;
    }
  }, [user, refetch]);

  return {
    // Remote data
    remoteWealth: remoteWealth?.data || null,
    remoteTimestamp: remoteWealth?.timestamp || null,
    isLoadingRemote,

    // Actions
    uploadWealth,
    downloadWealth,

    // Status
    syncStatus,
    canSync: !!user?.pubkey && !!user?.signer?.nip44,
  };
}
