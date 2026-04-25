import { useEffect, useRef } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { usePartners } from '@/hooks/usePartners';
import { usePartnerTransactionSync } from '@/hooks/usePartnerTransactionSync';
import { usePartnerInviteResponses } from '@/hooks/usePartnerInviteResponses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Transaction } from '@/lib/budgetTypes';

/**
 * PartnerSyncWrapper - Detects local transaction changes and publishes them to partners.
 *
 * Works alongside usePartnerTransactionSync which handles receiving events and
 * updating local state. This wrapper only publishes LOCAL changes.
 *
 * Echo-loop prevention: When a transaction arrives from a partner, the sync hook
 * marks it in the `remoteTracker`. When this wrapper detects that transaction
 * in local state, it checks the tracker and skips publishing it (since it already
 * came from a partner).
 */
export function PartnerSyncWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const { fullState } = useBudget();
  const { partners: nostrPartners } = usePartners();
  const localPartners = fullState.partners || [];

  // Combine partner sources (same logic as the sync hook)
  const combinedPartners = [
    ...nostrPartners,
    ...localPartners.filter(
      (lp) => !nostrPartners.some((np) => np.pubkey === lp.pubkey)
    ),
  ];

  const {
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
    remoteTracker,
  } = usePartnerTransactionSync();

  // Listen for invite accept/decline responses to keep partner status in sync
  usePartnerInviteResponses();

  // Track previous state for change detection
  const prevStateRef = useRef<{
    // Map of month -> transaction ID -> serialized transaction
    byMonth: Map<string, Map<string, string>>;
    initialized: boolean;
  }>({
    byMonth: new Map(),
    initialized: false,
  });

  // Include pending partners — optimistic sync even before accept response received
  const acceptedPartnerCount = combinedPartners.filter(
    (p) => p.status === 'accepted' || p.status === 'pending'
  ).length;

  // Publish local transaction changes
  useEffect(() => {
    // Skip if no user or no accepted partners
    if (!user?.pubkey || acceptedPartnerCount === 0) {
      return;
    }

    const prev = prevStateRef.current;

    // Build current state: Map<month, Map<txId, serialized>>
    const currentByMonth = new Map<string, Map<string, string>>();
    for (const budget of fullState.budgets) {
      const monthMap = new Map<string, string>();
      for (const tx of budget.transactions) {
        monthMap.set(tx.id, JSON.stringify(tx));
      }
      currentByMonth.set(budget.month, monthMap);
    }

    // On first run, just initialize — don't publish anything yet.
    // Existing transactions are considered "already synced" (they may have
    // come from the initial invite snapshot or an earlier session).
    if (!prev.initialized) {
      prevStateRef.current = {
        byMonth: currentByMonth,
        initialized: true,
      };
      console.log('[PartnerSyncWrapper] Initialized with', fullState.budgets.length, 'budget(s)');
      return;
    }

    // Walk each month and detect changes
    for (const [month, currentTxs] of currentByMonth) {
      const prevTxs = prev.byMonth.get(month) || new Map<string, string>();

      // Detect added or updated transactions
      for (const [txId, currentSerialized] of currentTxs) {
        const prevSerialized = prevTxs.get(txId);

        if (prevSerialized === undefined) {
          // New transaction
          // Check if this was added by a REMOTE partner event (echo prevention)
          if (remoteTracker.remoteAdded.has(txId)) {
            remoteTracker.remoteAdded.delete(txId); // Consume the marker
            console.log('[PartnerSyncWrapper] Skipping publish for remote-added tx:', txId);
            continue;
          }

          // Locally added — publish to partners
          try {
            const tx: Transaction = JSON.parse(currentSerialized);
            console.log('[PartnerSyncWrapper] Publishing new local tx:', txId, 'for month', month);
            publishTransactionAdd(tx, month).catch((e) => {
              console.error('[PartnerSyncWrapper] Publish add failed:', e);
            });
          } catch (e) {
            console.error('[PartnerSyncWrapper] Could not parse tx:', e);
          }
        } else if (prevSerialized !== currentSerialized) {
          // Updated transaction
          // Check if this update came from a REMOTE event (echo prevention)
          const remoteSerialized = remoteTracker.remoteUpdated.get(txId);
          if (remoteSerialized === currentSerialized) {
            remoteTracker.remoteUpdated.delete(txId);
            console.log('[PartnerSyncWrapper] Skipping publish for remote-updated tx:', txId);
            continue;
          }

          try {
            const tx: Transaction = JSON.parse(currentSerialized);
            console.log('[PartnerSyncWrapper] Publishing updated local tx:', txId, 'for month', month);
            publishTransactionUpdate(tx, month).catch((e) => {
              console.error('[PartnerSyncWrapper] Publish update failed:', e);
            });
          } catch (e) {
            console.error('[PartnerSyncWrapper] Could not parse tx:', e);
          }
        }
      }

      // Detect deleted transactions
      for (const prevTxId of prevTxs.keys()) {
        if (!currentTxs.has(prevTxId)) {
          // Transaction was deleted
          // Check if this was a remote deletion (echo prevention)
          if (remoteTracker.remoteDeleted.has(prevTxId)) {
            remoteTracker.remoteDeleted.delete(prevTxId);
            console.log('[PartnerSyncWrapper] Skipping publish for remote-deleted tx:', prevTxId);
            continue;
          }

          console.log('[PartnerSyncWrapper] Publishing deletion of local tx:', prevTxId, 'for month', month);
          publishTransactionDelete(prevTxId, month).catch((e) => {
            console.error('[PartnerSyncWrapper] Publish delete failed:', e);
          });
        }
      }
    }

    // Also check for fully removed months (all transactions gone)
    for (const [month, prevTxs] of prev.byMonth) {
      if (!currentByMonth.has(month)) {
        // Entire month was removed; publish deletions for all its transactions
        for (const txId of prevTxs.keys()) {
          if (remoteTracker.remoteDeleted.has(txId)) {
            remoteTracker.remoteDeleted.delete(txId);
            continue;
          }
          console.log('[PartnerSyncWrapper] Month removed, publishing deletion of tx:', txId);
          publishTransactionDelete(txId, month).catch((e) => {
            console.error('[PartnerSyncWrapper] Publish delete failed:', e);
          });
        }
      }
    }

    // Update snapshot
    prevStateRef.current = {
      byMonth: currentByMonth,
      initialized: true,
    };
  }, [
    user?.pubkey,
    acceptedPartnerCount,
    fullState.budgets,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
    remoteTracker,
  ]);

  // When partners list changes (e.g. first partner added), reset the initialization
  // so we re-snapshot the current state without re-publishing existing transactions.
  useEffect(() => {
    if (acceptedPartnerCount > 0) {
      // Keep initialized = true if we already had partners
      // Only reset on transition from 0 -> 1+
      if (!prevStateRef.current.initialized) {
        prevStateRef.current.initialized = false;
      }
    }
  }, [acceptedPartnerCount]);

  return <>{children}</>;
}
