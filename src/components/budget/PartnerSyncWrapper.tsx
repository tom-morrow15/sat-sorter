import { useEffect, useRef, useCallback } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { usePartnerTransactionSync } from '@/hooks/usePartnerTransactionSync';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Transaction } from '@/lib/budgetTypes';

/**
 * PartnerSyncWrapper - Intercepts budget transactions and publishes them to partners
 * 
 * This component hooks into the budget context and automatically publishes transaction
 * changes to all partners when:
 * - A transaction is added
 * - A transaction is updated
 * - A transaction is deleted
 * 
 * The component should be placed high in the component tree, wrapping the Budget page.
 */
export function PartnerSyncWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const { fullState, currentMonth, partners } = useBudget();
  const { 
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
  } = usePartnerTransactionSync();

  // Track the previous state to detect changes
  const prevStateRef = useRef<{
    transactionIds: Set<string>;
    transactions: Map<string, Transaction>;
    month: string;
  }>({
    transactionIds: new Set(),
    transactions: new Map(),
    month: currentMonth,
  });

  // Track ongoing publishes to avoid duplicate publishes
  const publishingRef = useRef<Set<string>>(new Set());

  const detectAndPublishChanges = useCallback(() => {
    // Skip if not logged in, no partners, or no user
    if (!user?.pubkey || !partners || partners.length === 0) {
      return;
    }

    // Get current month's budget
    const currentBudget = fullState.budgets.find((b) => b.month === currentMonth);
    if (!currentBudget) {
      return;
    }

    const currentTransactions = currentBudget.transactions;
    const prevState = prevStateRef.current;

    // Reset if month changed
    if (prevState.month !== currentMonth) {
      prevStateRef.current = {
        transactionIds: new Set(),
        transactions: new Map(),
        month: currentMonth,
      };
      publishingRef.current.clear();
      return;
    }

    // Build current state
    const currentIds = new Set(currentTransactions.map((t) => t.id));
    const currentMap = new Map(currentTransactions.map((t) => [t.id, t]));

    // Detect added transactions
    for (const transaction of currentTransactions) {
      if (!prevState.transactionIds.has(transaction.id)) {
        const publishKey = `add-${transaction.id}`;
        if (!publishingRef.current.has(publishKey)) {
          publishingRef.current.add(publishKey);
          console.log('[PartnerSyncWrapper] New transaction detected, publishing:', transaction.id);
          publishTransactionAdd(transaction)
            .catch((e) => {
              console.error('[PartnerSyncWrapper] Failed to publish transaction add:', e);
            })
            .finally(() => {
              publishingRef.current.delete(publishKey);
            });
        }
      }
    }

    // Detect updated transactions
    for (const [id, transaction] of currentMap) {
      const prevTransaction = prevState.transactions.get(id);
      if (prevTransaction && JSON.stringify(prevTransaction) !== JSON.stringify(transaction)) {
        const publishKey = `update-${id}`;
        if (!publishingRef.current.has(publishKey)) {
          publishingRef.current.add(publishKey);
          console.log('[PartnerSyncWrapper] Transaction updated, publishing:', id);
          publishTransactionUpdate(transaction)
            .catch((e) => {
              console.error('[PartnerSyncWrapper] Failed to publish transaction update:', e);
            })
            .finally(() => {
              publishingRef.current.delete(publishKey);
            });
        }
      }
    }

    // Detect deleted transactions
    for (const prevId of prevState.transactionIds) {
      if (!currentIds.has(prevId)) {
        const publishKey = `delete-${prevId}`;
        if (!publishingRef.current.has(publishKey)) {
          publishingRef.current.add(publishKey);
          console.log('[PartnerSyncWrapper] Transaction deleted, publishing:', prevId);
          publishTransactionDelete(prevId)
            .catch((e) => {
              console.error('[PartnerSyncWrapper] Failed to publish transaction delete:', e);
            })
            .finally(() => {
              publishingRef.current.delete(publishKey);
            });
        }
      }
    }

    // Update ref for next comparison
    prevStateRef.current = {
      transactionIds: currentIds,
      transactions: currentMap,
      month: currentMonth,
    };
  }, [
    user,
    partners,
    fullState,
    currentMonth,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
  ]);

  // Auto-publish transaction changes to partners
  useEffect(() => {
    detectAndPublishChanges();
  }, [detectAndPublishChanges]);

  return <>{children}</>;
}
