import { useEffect, useCallback, useRef, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { encryptWithBudgetKey, decryptWithBudgetKey } from '@/lib/budgetCrypto';
import type { Transaction, MonthlyBudget } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

const BUDGET_KIND = 30078;
const APP_IDENTIFIER = 'sat-sorter/budget-data';
const MONTH_DTAG_PREFIX = 'sat-sorter/budget-data/';

interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
}

interface BudgetSyncEvent {
  type: 'transaction-added' | 'transaction-updated' | 'transaction-deleted' | 'budget-updated';
  budgetMonth: string;
  data: {
    transaction?: Transaction;
    transactionId?: string;
    snapshot?: unknown;
  };
  timestamp: number;
  version: number;
}

/**
 * useSharedBudgetSync — Real-time budget sync via a shared Nostr keypair.
 *
 * HOW IT WORKS (shared-keypair model):
 * 1. Every shared budget has its own Nostr identity (nsec/npub).
 * 2. All budget entries are published as kind 30078 events authored and
 *    encrypted by the BUDGET keypair, not by individual users.
 * 3. All partners subscribe to the budget npub's events — one subscription
 *    covers everyone (no per-partner filtering needed).
 * 4. When a partner makes a local change, they sign + encrypt with the
 *    budget keypair and publish ONE event. All other partners receive it.
 * 5. Deduplication is by transaction ID — applying the same entry twice
 *    is idempotent.
 *
 * OLD MODEL (removed):
 * - kind 4002 events, per-partner pairwise encryption
 * - RemoteOriginTracker for echo prevention
 * - authors array with multiple partner pubkeys
 */
export function useSharedBudgetSync(budgetNpub: string, budgetNsec: string) {
  const { nostr } = useNostr();
  const { state, setState } = useBudgetContext();
  const { mutateAsync: publish } = useNostrPublish();
  const { toast } = useToast();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    error: null,
  });

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Decode the budget nsec to get raw key bytes for signing + encrypting.
  const keyBytesRef = useRef<{ budgetPriv: Uint8Array; budgetPub: string } | null>(null);
  if (!keyBytesRef.current && budgetNsec) {
    try {
      const decoded = nip19.decode(budgetNsec);
      if (decoded.type === 'nsec') {
        const signer = new NSecSigner(decoded.data);
        keyBytesRef.current = {
          budgetPriv: decoded.data,
          budgetPub: signer.pubkey,
        };
      }
    } catch (e) {
      console.error('[SharedBudgetSync] Failed to decode budget nsec:', e);
    }
  }

  // Keep latest values in a ref for stable closure
  const stateRef = useRef({ state, setState });
  stateRef.current = { state, setState };

  /**
   * Publish a budget entry as a kind 30078 event signed by the budget keypair.
   */
  const publishEntry = useCallback(
    async (dTag: string, encryptedContent: string, altDescription: string): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) {
        console.warn('[SharedBudgetSync] Budget keypair not available for publishing');
        return false;
      }

      try {
        const signer = new NSecSigner(keys.budgetPriv);
        const event = await signer.signEvent({
          kind: BUDGET_KIND,
          content: encryptedContent,
          tags: [
            ['d', dTag],
            ['alt', altDescription],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        console.log(`[SharedBudgetSync] Published ${dTag} under budget npub`);
        return true;
      } catch (e) {
        console.error('[SharedBudgetSync] Publish failed:', e);
        return false;
      }
    },
    [nostr]
  );

  /**
   * Handle an incoming budget entry from the budget npub's relay stream.
   */
  const handleIncomingEvent = useCallback(
    async (rawEvent: { id: string; pubkey: string; content: string; tags: string[][] }) => {
      // Skip if already processed
      if (processedEventsRef.current.has(rawEvent.id)) return;
      processedEventsRef.current.add(rawEvent.id);

      const keys = keyBytesRef.current;
      if (!keys) return;

      // Only accept events from our budget npub
      if (rawEvent.pubkey !== keys.budgetPub) return;

      // Only process entries that look like budget data
      const dTag = rawEvent.tags.find((t) => t[0] === 'd')?.[1];
      if (!dTag || !dTag.startsWith(MONTH_DTAG_PREFIX)) return;

      try {
        const decrypted = decryptWithBudgetKey(rawEvent.content, keys.budgetPriv, keys.budgetPub);
        const syncEvent: BudgetSyncEvent = JSON.parse(decrypted);

        const monthMatch = dTag.replace(MONTH_DTAG_PREFIX, '');
        console.log(
          `[SharedBudgetSync] Received ${syncEvent.type} for month ${monthMatch}`
        );

        switch (syncEvent.type) {
          case 'transaction-added': {
            if (!syncEvent.data.transaction) break;
            const incoming = syncEvent.data.transaction;

            stateRef.current.setState((prev) => {
              const existingBudgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );

              if (existingBudgetIdx >= 0) {
                const existingBudget = prev.budgets[existingBudgetIdx];
                if (existingBudget.transactions.some((t) => t.id === incoming.id)) {
                  return prev; // Already exists — idempotent
                }
                const updatedBudget: MonthlyBudget = {
                  ...existingBudget,
                  transactions: [...existingBudget.transactions, incoming],
                };
                const newBudgets = [...prev.budgets];
                newBudgets[existingBudgetIdx] = updatedBudget;
                return { ...prev, budgets: newBudgets };
              } else {
                const newBudget: MonthlyBudget = {
                  id: generateId(),
                  month: syncEvent.budgetMonth,
                  buckets: [],
                  transactions: [incoming],
                };
                return { ...prev, budgets: [...prev.budgets, newBudget] };
              }
            });

            toast({
              title: 'Transaction synced',
              description: `${incoming.description} (${incoming.amount.toLocaleString()} sats)`,
            });
            break;
          }

          case 'transaction-updated': {
            if (!syncEvent.data.transaction) break;
            const incoming = syncEvent.data.transaction;

            stateRef.current.setState((prev) => {
              const budgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );
              if (budgetIdx < 0) return prev;

              const budget = prev.budgets[budgetIdx];
              const txIdx = budget.transactions.findIndex((t) => t.id === incoming.id);
              const newTransactions = [...budget.transactions];
              if (txIdx >= 0) {
                newTransactions[txIdx] = incoming;
              } else {
                newTransactions.push(incoming);
              }
              const updatedBudget: MonthlyBudget = { ...budget, transactions: newTransactions };
              const newBudgets = [...prev.budgets];
              newBudgets[budgetIdx] = updatedBudget;
              return { ...prev, budgets: newBudgets };
            });
            break;
          }

          case 'transaction-deleted': {
            if (!syncEvent.data.transactionId) break;
            const txId = syncEvent.data.transactionId;

            stateRef.current.setState((prev) => {
              const budgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );
              if (budgetIdx < 0) return prev;

              const budget = prev.budgets[budgetIdx];
              const updatedBudget: MonthlyBudget = {
                ...budget,
                transactions: budget.transactions.filter((t) => t.id !== txId),
              };
              const newBudgets = [...prev.budgets];
              newBudgets[budgetIdx] = updatedBudget;
              return { ...prev, budgets: newBudgets };
            });
            break;
          }

          case 'budget-updated': {
            if (!syncEvent.data.snapshot) break;
            const snapshot = syncEvent.data.snapshot as MonthlyBudget;

            stateRef.current.setState((prev) => {
              const existingBudgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );

              if (existingBudgetIdx >= 0) {
                // Merge: keep local transactions that aren't in the snapshot
                const localBudget = prev.budgets[existingBudgetIdx];
                const localTxIds = new Set(localBudget.transactions.map((t) => t.id));
                const snapshotOnlyTxs = (snapshot.transactions || []).filter(
                  (t) => !localTxIds.has(t.id)
                );
                const merged: MonthlyBudget = {
                  ...snapshot,
                  transactions: [...localBudget.transactions, ...snapshotOnlyTxs],
                };
                const newBudgets = [...prev.budgets];
                newBudgets[existingBudgetIdx] = merged;
                return { ...prev, budgets: newBudgets };
              } else {
                // New month entirely — just add it
                return { ...prev, budgets: [...prev.budgets, snapshot] };
              }
            });
            break;
          }
        }

        setSyncStatus((prev) => ({
          ...prev,
          lastSync: Math.floor(Date.now() / 1000),
          error: null,
        }));
      } catch (e) {
        console.error('[SharedBudgetSync] Error processing event:', e);
      }
    },
    [toast]
  );

  /**
   * Subscribe to all budget events from the budget npub.
   */
  useEffect(() => {
    const keys = keyBytesRef.current;
    if (!keys || !budgetNpub) return;

    console.log(`[SharedBudgetSync] Subscribing to budget npub ${budgetNpub.slice(0, 16)}...`);
    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    subscriptionRef.current = nostr.req(
      [
        {
          kinds: [BUDGET_KIND],
          authors: [keys.budgetPub],
          limit: 200,
        },
      ],
      {
        onevent: handleIncomingEvent,
        oneose: () => {
          console.log('[SharedBudgetSync] Initial events loaded (EOSE)');
          setSyncStatus((prev) => ({ ...prev, isSyncing: false }));
        },
      }
    );

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
        subscriptionRef.current = null;
      }
    };
  }, [budgetNpub, nostr, handleIncomingEvent]);

  /**
   * Publish a transaction add/update/delete to the budget npub.
   */
  const publishTransactionAdd = useCallback(
    async (transaction: Transaction, month: string): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) return false;

      const dTag = `${MONTH_DTAG_PREFIX}${month}`;
      const syncEvent: BudgetSyncEvent = {
        type: 'transaction-added',
        budgetMonth: month,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      const encrypted = encryptWithBudgetKey(
        JSON.stringify(syncEvent),
        keys.budgetPriv,
        keys.budgetPub
      );
      return publishEntry(dTag, encrypted, `Sat Sorter budget month ${month} (encrypted)`);
    },
    [publishEntry]
  );

  const publishTransactionUpdate = useCallback(
    async (transaction: Transaction, month: string): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) return false;

      const dTag = `${MONTH_DTAG_PREFIX}${month}`;
      const syncEvent: BudgetSyncEvent = {
        type: 'transaction-updated',
        budgetMonth: month,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      const encrypted = encryptWithBudgetKey(
        JSON.stringify(syncEvent),
        keys.budgetPriv,
        keys.budgetPub
      );
      return publishEntry(dTag, encrypted, `Sat Sorter budget month ${month} (encrypted)`);
    },
    [publishEntry]
  );

  const publishTransactionDelete = useCallback(
    async (transactionId: string, month: string): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) return false;

      const dTag = `${MONTH_DTAG_PREFIX}${month}`;
      const syncEvent: BudgetSyncEvent = {
        type: 'transaction-deleted',
        budgetMonth: month,
        data: { transactionId },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      const encrypted = encryptWithBudgetKey(
        JSON.stringify(syncEvent),
        keys.budgetPriv,
        keys.budgetPub
      );
      return publishEntry(dTag, encrypted, `Sat Sorter budget month ${month} (encrypted)`);
    },
    [publishEntry]
  );

  /**
   * Publish a full budget snapshot (buckets + transactions) for a month.
   * Used when a new month is created (e.g. via copy) to sync the structure
   * to the shared budget keypair.
   */
  const publishBudgetSnapshot = useCallback(
    async (budget: MonthlyBudget): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) return false;

      const dTag = `${MONTH_DTAG_PREFIX}${budget.month}`;
      const syncEvent: BudgetSyncEvent = {
        type: 'budget-updated',
        budgetMonth: budget.month,
        data: {
          snapshot: budget,
        },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      const encrypted = encryptWithBudgetKey(
        JSON.stringify(syncEvent),
        keys.budgetPriv,
        keys.budgetPub
      );
      return publishEntry(dTag, encrypted, `Sat Sorter budget snapshot ${budget.month} (encrypted)`);
    },
    [publishEntry]
  );

  return {
    syncStatus,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
    publishBudgetSnapshot,
    processedEventsCount: processedEventsRef.current.size,
    hasBudgetKeypair: !!keyBytesRef.current,
  };
}

/**
 * Lightweight hook that pages can use to sync a newly-copied budget month
 * to the shared budget keypair (if one exists). Call `syncCopiedBudget(budget)`
 * after duplicateFromMonth succeeds.
 */
export function useSyncCopiedBudget() {
  const { state } = useBudgetContext();
  const { nostr } = useNostr();
  const budgetKeypair = state.budgetKeypair;

  const syncCopiedBudget = useCallback(
    async (budget: MonthlyBudget): Promise<boolean> => {
      if (!budgetKeypair) return false;

      try {
        const decoded = nip19.decode(budgetKeypair.budgetNsec);
        if (decoded.type !== 'nsec') return false;
        const signer = new NSecSigner(decoded.data);

        const dTag = `${MONTH_DTAG_PREFIX}${budget.month}`;
        const syncEvent: BudgetSyncEvent = {
          type: 'budget-updated',
          budgetMonth: budget.month,
          data: { snapshot: budget },
          timestamp: Math.floor(Date.now() / 1000),
          version: 1,
        };

        const encrypted = encryptWithBudgetKey(
          JSON.stringify(syncEvent),
          decoded.data,
          signer.pubkey
        );

        const event = await signer.signEvent({
          kind: BUDGET_KIND,
          content: encrypted,
          tags: [
            ['d', dTag],
            ['alt', `Sat Sorter budget snapshot ${budget.month} (encrypted)`],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        console.log(`[useSyncCopiedBudget] Published budget snapshot for ${budget.month}`);
        return true;
      } catch (e) {
        console.error('[useSyncCopiedBudget] Failed to sync copied budget:', e);
        return false;
      }
    },
    [budgetKeypair, nostr]
  );

  return { syncCopiedBudget, hasBudgetKeypair: !!budgetKeypair };
}
