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
        const parsed = JSON.parse(decrypted);
        // Handle both plain BudgetState and snapshot-wrapped payloads
        // (useManualSync wraps data in { data, version, checksum, ... })
        let budgetData: BudgetState;
        if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data && 'budgets' in parsed.data) {
          budgetData = parsed.data as BudgetState;
        } else if (parsed && typeof parsed === 'object' && 'budgets' in parsed) {
          budgetData = parsed as BudgetState;
        } else {
          console.warn('[useBudgetSync] Unknown remote budget shape');
          return null;
        }

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

  // Upload budget data to Nostr.
  // Options:
  //   allowEmpty   – allow uploading a budget with zero months (normally rejected
  //                  as a safety measure). Use only for legitimate "wipe all" flows.
  //   skipRemoteCheck – skip the pre-upload remote sanity check (used when the
  //                     caller has already confirmed the operation with the user).
  const uploadBudget = useCallback(async (
    budgetState: BudgetState,
    options: { allowEmpty?: boolean; skipRemoteCheck?: boolean } = {}
  ): Promise<boolean> => {
    if (!user?.pubkey || !user?.signer?.nip44) {
      setSyncStatus(prev => ({ ...prev, error: 'Not logged in or signer unavailable' }));
      return false;
    }

    // SAFETY GUARD: refuse to upload an empty budget unless explicitly allowed.
    // This prevents a bad state (e.g. freshly-initialized browser that hasn't
    // finished downloading the user's remote budget) from wiping out saved data.
    if (!options.allowEmpty && (!budgetState.budgets || budgetState.budgets.length === 0)) {
      console.warn('[useBudgetSync] Refusing to upload empty budget state to protect remote data');
      setSyncStatus(prev => ({
        ...prev,
        error: 'Refusing to upload an empty budget — this would wipe your saved data on other devices. If this is intentional, use the Backup dialog to force-sync.',
      }));
      return false;
    }

    // SAFETY GUARD: if the remote has MORE data than we're about to upload
    // (extra months, or richer content in overlapping months), warn and refuse.
    // This catches the case where another device has more data than this one
    // — usually because the login-time sync hasn't completed yet. Legitimate
    // destructive flows (reset, delete month) can opt out via skipRemoteCheck.
    if (!options.skipRemoteCheck) {
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
              // Score each month by richness (transactions + line items +
              // non-zero amounts). Refuse if the remote's total score is
              // strictly greater than ours — that would indicate data loss.
              const scoreBudget = (b: typeof existingState.budgets[number]): number => {
                const liCount = b.buckets.reduce((s, bk) => s + bk.lineItems.length, 0);
                const plannedSum = b.buckets.reduce(
                  (s, bk) => s + bk.lineItems.reduce(
                    (x, li) => x + (li.plannedAmount || 0) + (li.plannedAmountUsd || 0), 0
                  ), 0
                );
                return b.transactions.length * 1000 + liCount * 10 + (plannedSum > 0 ? 5 : 0);
              };
              const totalScore = (bs: typeof existingState.budgets) =>
                bs.reduce((s, b) => s + scoreBudget(b), 0);

              const remoteScore = totalScore(existingState.budgets);
              const localScore = totalScore(budgetState.budgets);

              // Significant data loss: remote is substantially richer than local
              if (remoteScore > 0 && localScore < remoteScore * 0.5) {
                const localMonths = new Set(budgetState.budgets.map(b => b.month));
                const missingMonths = existingState.budgets
                  .filter(b => !localMonths.has(b.month))
                  .map(b => b.month);
                console.warn(
                  '[useBudgetSync] Upload would lose data vs remote, aborting',
                  { remoteScore, localScore, missingMonths }
                );
                setSyncStatus(prev => ({
                  ...prev,
                  isSyncing: false,
                  error: missingMonths.length > 0
                    ? `Cannot save: remote has additional months not in local data (${missingMonths.join(', ')}). Please reload to merge first.`
                    : 'Cannot save: remote has more data than local. Please reload to merge first.',
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
