import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { NSecSigner } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { encryptWithBudgetKey, decryptWithBudgetKey } from '@/lib/budgetCrypto';
import type { Transaction, MonthlyBudget } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

/**
 * Fetch and decrypt all budget snapshots that have been published under a shared budget keypair.
 * Used on invite acceptance to immediately populate the partner's local state with
 * buckets/line items for all months (not just the current one).
 */
export async function fetchAllSharedBudgetSnapshots(
  budgetNsec: string,
  nostr: any
): Promise<MonthlyBudget[]> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return [];
    const priv = decoded.data as Uint8Array;
    const signer = new NSecSigner(priv);
    // Use nostr-tools' getPublicKey for guaranteed x-only hex format
    const budgetPub = getPublicKey(priv);

    // NPool already routes queries to all read relays — no need for a
    // separate relay group. Use the default pool directly.
    const events = await nostr.query(
      [
        {
          kinds: [BUDGET_KIND],
          authors: [budgetPub],
          limit: 200,
        },
      ],
      { signal: AbortSignal.timeout(10000) }
    );

    const results: { snapshot: MonthlyBudget; createdAt: number }[] = [];
    for (const ev of events) {
      const dTag = ev.tags.find((t: string[]) => t[0] === 'd')?.[1];
      if (!dTag || !dTag.startsWith(MONTH_DTAG_PREFIX)) continue;

      try {
        const decrypted = decryptWithBudgetKey(ev.content, priv, budgetPub);
        const parsed = JSON.parse(decrypted);
        if (parsed?.type === 'budget-updated' && parsed.data?.snapshot) {
          const snap = parsed.data.snapshot as MonthlyBudget;
          if (snap?.month) {
            results.push({ snapshot: snap, createdAt: ev.created_at || 0 });
          }
        }
      } catch {
        // ignore bad events
      }
    }

    // Dedup by month, keep newest by created_at
    const byMonth = new Map<string, { snapshot: MonthlyBudget; createdAt: number }>();
    for (const r of results) {
      const existing = byMonth.get(r.snapshot.month);
      if (!existing || r.createdAt >= existing.createdAt) {
        byMonth.set(r.snapshot.month, r);
      }
    }
    return Array.from(byMonth.values()).map(v => v.snapshot);
  } catch (e) {
    console.warn('[fetchAllSharedBudgetSnapshots] Failed:', e);
    return [];
  }
}

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
  /** Pubkey of the user who made the change (for attribution in shared budgets). */
  authorPubkey?: string;
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
  const { user } = useCurrentUser();
  const { state, setState } = useBudgetContext();
  const { mutateAsync: publish } = useNostrPublish();
  const { toast } = useToast();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    error: null,
  });

  const subscriptionRef = useRef<{ close?: () => void } | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());
  // Track transaction IDs that arrived via sync (not local edits) so
  // PartnerSyncWrapper can skip re-publishing them (prevents echo loops).
  const syncedTxIdsRef = useRef<Set<string>>(new Set());
  // Track structure hashes (serialized buckets) that arrived via sync so
  // PartnerSyncWrapper doesn't echo structure snapshots back either.
  const syncedStructureHashesRef = useRef<Map<string, string>>(new Map());

  // Decode the budget nsec to get raw key bytes for signing + encrypting.
  // Use a memo so it re-computes when budgetNsec changes (e.g., after accept).
  const keyBytes = useMemo(() => {
    if (!budgetNsec) return null;
    try {
      const decoded = nip19.decode(budgetNsec);
      if (decoded.type === 'nsec') {
        const priv = decoded.data as Uint8Array;
        // Use nostr-tools' getPublicKey to guarantee x-only hex format
        // compatible with nip44.getConversationKey (NSecSigner.pubkey may
        // return a format that nostr-tools rejects).
        return {
          budgetPriv: priv,
          budgetPub: getPublicKey(priv),
        };
      }
    } catch (e) {
      console.error('[SharedBudgetSync] Failed to decode budget nsec:', e);
    }
    return null;
  }, [budgetNsec]);

  // Keep latest values in a ref for stable closure
  const stateRef = useRef({ state, setState });
  stateRef.current = { state, setState };

  // Store keyBytes in a ref so callbacks can access it without stale closures
  const keyBytesRef = useRef(keyBytes);
  keyBytesRef.current = keyBytes;

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
            // Stamp the author pubkey for attribution (if provided)
            if (syncEvent.authorPubkey && !incoming.partnerPubkey) {
              incoming.partnerPubkey = syncEvent.authorPubkey;
            }
            // Mark as synced so PartnerSyncWrapper doesn't echo it back
            syncedTxIdsRef.current.add(incoming.id);

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
            if (syncEvent.authorPubkey && !incoming.partnerPubkey) {
              incoming.partnerPubkey = syncEvent.authorPubkey;
            }
            // Mark as synced so PartnerSyncWrapper doesn't echo it back
            syncedTxIdsRef.current.add(incoming.id);

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
            // Mark all snapshot transactions as synced so PartnerSyncWrapper doesn't echo
            if (snapshot.transactions) {
              for (const tx of snapshot.transactions) {
                syncedTxIdsRef.current.add(tx.id);
              }
            }
            // Mark the structure hash so PartnerSyncWrapper doesn't echo the snapshot back
            if (snapshot.buckets) {
              syncedStructureHashesRef.current.set(
                syncEvent.budgetMonth,
                JSON.stringify(snapshot.buckets)
              );
            }

            stateRef.current.setState((prev) => {
              const existingBudgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );

              if (existingBudgetIdx >= 0) {
                // Merge: prefer the incoming snapshot's buckets/lineItems (structure),
                // but keep local transactions that aren't in the snapshot.
                const localBudget = prev.budgets[existingBudgetIdx];
                const localTxIds = new Set(localBudget.transactions.map((t) => t.id));
                const snapshotOnlyTxs = (snapshot.transactions || []).filter(
                  (t) => !localTxIds.has(t.id)
                );
                const merged: MonthlyBudget = {
                  ...snapshot,
                  // Adopt the authoritative bucket structure from the snapshot
                  buckets: snapshot.buckets || localBudget.buckets || [],
                  transactions: [...localBudget.transactions, ...snapshotOnlyTxs],
                };
                const newBudgets = [...prev.budgets];
                newBudgets[existingBudgetIdx] = merged;
                return { ...prev, budgets: newBudgets };
              } else {
                // New month entirely — just add the snapshot (full buckets + txs)
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
   * First does an explicit query to load existing events (reliable initial load),
   * then subscribes for new events going forward.
   */
  useEffect(() => {
    const keys = keyBytes;
    if (!keys || !budgetNpub) return;

    console.log(`[SharedBudgetSync] Subscribing to budget npub ${budgetNpub.slice(0, 16)}...`);
    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    let cancelled = false;

    // Step 1: Explicitly fetch existing events (more reliable than relying on
    // the subscription's initial batch, which can be flaky on some relays).
    (async () => {
      try {
        const existing = await nostr.query(
          [{ kinds: [BUDGET_KIND], authors: [keys.budgetPub], limit: 200 }],
          { signal: AbortSignal.timeout(10000) }
        );
        console.log(`[SharedBudgetSync] Fetched ${existing.length} existing budget events`);
        for (const ev of existing) {
          if (!cancelled) await handleIncomingEvent(ev);
        }
      } catch (e) {
        console.warn('[SharedBudgetSync] Initial fetch failed:', e);
      }

      if (cancelled) return;
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));

      // Step 2: Subscribe for new events going forward
      subscriptionRef.current = nostr.req(
        [
          {
            kinds: [BUDGET_KIND],
            authors: [keys.budgetPub],
            limit: 0, // Only new events — we already loaded existing ones above
          },
        ],
        {
          onevent: handleIncomingEvent,
          oneose: () => {
            console.log('[SharedBudgetSync] Live subscription active');
          },
        }
      );
    })();

    return () => {
      cancelled = true;
      if (subscriptionRef.current && typeof subscriptionRef.current.close === 'function') {
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
        authorPubkey: user?.pubkey,
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

  /**
   * Manually force a re-fetch of all existing budget events from relays.
   * Useful as a "pull to refresh" or retry after accepting an invite.
   */
  const forceSync = useCallback(async () => {
    const keys = keyBytesRef.current;
    if (!keys) return;

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    try {
      const existing = await nostr.query(
        [{ kinds: [BUDGET_KIND], authors: [keys.budgetPub], limit: 200 }],
        { signal: AbortSignal.timeout(10000) }
      );
      console.log(`[SharedBudgetSync] Force sync fetched ${existing.length} events`);
      for (const ev of existing) {
        await handleIncomingEvent(ev);
      }
      setSyncStatus((prev) => ({ ...prev, isSyncing: false, lastSync: Math.floor(Date.now() / 1000) }));
    } catch (e) {
      console.error('[SharedBudgetSync] Force sync failed:', e);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false, error: e instanceof Error ? e.message : 'Sync failed' }));
    }
  }, [nostr, handleIncomingEvent]);

  return {
    syncStatus,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
    publishBudgetSnapshot,
    hasBudgetKeypair: !!keyBytesRef.current,
    /** Transaction IDs that arrived via sync — PartnerSyncWrapper should skip re-publishing these. */
    syncedTxIds: syncedTxIdsRef,
    /** Structure hashes (month → serialized buckets) that arrived via sync. */
    syncedStructureHashes: syncedStructureHashesRef,
    /** Manually re-fetch all existing budget events from relays. */
    forceSync,
  };
}

/**
 * Standalone publisher for a full month snapshot under the shared budget keypair.
 * Can be called from anywhere (e.g. partner invite flow) given the raw nsec.
 */
export async function publishBudgetSnapshotToNostr(
  budget: MonthlyBudget,
  budgetNsec: string,
  nostr: any
): Promise<boolean> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return false;
    const priv = decoded.data as Uint8Array;
    const signer = new NSecSigner(priv);
    // Use nostr-tools' getPublicKey for guaranteed x-only hex format
    const pub = getPublicKey(priv);

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
      priv,
      pub
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
    console.log(`[publishBudgetSnapshotToNostr] Published snapshot for ${budget.month}`);
    return true;
  } catch (e) {
    console.error('[publishBudgetSnapshotToNostr] Failed to publish snapshot:', e);
    return false;
  }
}

/**
 * Seed full snapshots for multiple months to the shared budget.
 * Useful right after creating the keypair or adding the first partner.
 */
export async function seedAllBudgetSnapshots(
  budgets: MonthlyBudget[],
  budgetNsec: string,
  nostr: any
): Promise<number> {
  let seeded = 0;
  for (const budget of budgets || []) {
    if (budget.buckets && budget.buckets.length > 0) {
      const ok = await publishBudgetSnapshotToNostr(budget, budgetNsec, nostr);
      if (ok) seeded++;
    }
  }
  return seeded;
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
        // Use nostr-tools' getPublicKey for guaranteed x-only hex format
        const budgetPub = getPublicKey(decoded.data);

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
          budgetPub
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
