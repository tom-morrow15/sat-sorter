import { useEffect, useRef } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useSharedBudgetSync } from '@/hooks/useSharedBudgetSync';
import { usePartnerInviteResponses } from '@/hooks/usePartnerInviteResponses';
import type { Transaction } from '@/lib/budgetTypes';

/**
 * PartnerSyncWrapper — Detects local transaction changes and publishes them
 * to the shared budget keypair (kind 30078).
 *
 * OLD BEHAVIOR (removed):
 * - Compared previous vs current state serialized JSON
 * - Published one kind 4002 event per partner
 * - Used RemoteOriginTracker for echo prevention
 *
 * NEW BEHAVIOR:
 * - When local transactions change, publishes a single kind 30078 event
 *   under the budget npub. All partners receive it via their subscription.
 */
export function PartnerSyncWrapper({ children }: { children: React.ReactNode }) {
  const { fullState } = useBudget();
  const { state } = useBudgetContext();
  const budgetKeypair = state.budgetKeypair;

  // Use the new shared-budget sync hook if we have a keypair
  const {
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
  } = useSharedBudgetSync(
    budgetKeypair?.budgetNpub || '',
    budgetKeypair?.budgetNsec || ''
  );

  // Listen for invite accept/decline responses to keep partner status in sync
  usePartnerInviteResponses();

  // Track previous state for change detection
  const prevStateRef = useRef<{
    byMonth: Map<string, Map<string, string>>;
    initialized: boolean;
  }>({
    byMonth: new Map(),
    initialized: false,
  });

  // Publish local transaction changes (only if we have a budget keypair)
  useEffect(() => {
    if (!budgetKeypair) return;

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

    // On first run, just initialize — don't publish existing transactions.
    // Existing transactions are considered "already synced" (they may have
    // come from the initial data load or an earlier session).
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
          // New transaction — publish under budget npub
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
          console.log('[PartnerSyncWrapper] Publishing deletion of local tx:', prevTxId, 'for month', month);
          publishTransactionDelete(prevTxId, month).catch((e) => {
            console.error('[PartnerSyncWrapper] Publish delete failed:', e);
          });
        }
      }
    }

    // Also check for fully removed months
    for (const [month, prevTxs] of prev.byMonth) {
      if (!currentByMonth.has(month)) {
        for (const txId of prevTxs.keys()) {
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
    budgetKeypair,
    fullState.budgets,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
  ]);

  return <>{children}</>;
}
