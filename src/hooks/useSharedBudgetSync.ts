import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { NSecSigner, NRelay1 } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { encryptWithBudgetKey, decryptWithBudgetKey } from '@/lib/budgetCrypto';
import { mapRelayUrl } from '@/lib/devRelayProxy';
import type { MonthlyBudget } from '@/lib/budgetTypes';

/**
 * SIMPLIFIED shared budget sync — full-month snapshot model.
 *
 * Instead of individual transaction add/update/delete events (complex, error-prone),
 * we publish the entire month's budget as a single replaceable event. The latest
 * snapshot always wins. This is:
 * - Simpler (one event type, one code path)
 * - Idempotent (applying the same snapshot twice is safe)
 * - Self-healing (no ordering issues, no echo loops)
 * - Reliable (one event per month, easy to verify)
 *
 * The d-tag is `sat-sorter/budget-data/{month}` so each month is independently
 * replaceable. Kind 30078 is NIP-78 addressable — the latest event for a given
 * d-tag replaces older ones on relays.
 *
 * CRITICAL: shared budget events are published to AND subscribed from a fixed
 * set of well-known public relays, NOT the user's personal relay list. This
 * ensures both partners can always reach each other's events regardless of
 * their individual relay configurations (e.g., one partner has a local Umbrel
 * relay that the other can't access).
 */

const BUDGET_KIND = 30078;
const MONTH_DTAG_PREFIX = 'sat-sorter/budget-data/';

/** Fixed set of well-known public relays for shared budget sync.
 *  Both partners publish to and subscribe from these, ensuring events
 *  are always reachable regardless of personal relay configuration. */
const SHARED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.ditto.pub',
];

/** Open direct relay connections to the shared relay set.
 *  Returns an array of NRelay1 instances. */
function openSharedRelays(): NRelay1[] {
  return SHARED_RELAYS.map((url) => mapRelayUrl(url)).map((url) => {
    try {
      return new NRelay1(url);
    } catch {
      return null;
    }
  }).filter((r): r is NRelay1 => r !== null);
}

/** Publish an event to all shared relays directly (bypassing personal relay list). */
async function publishToSharedRelays(event: any): Promise<boolean> {
  const relays = openSharedRelays();
  if (relays.length === 0) {
    console.warn('[SharedBudgetSync] Could not open any shared relays for publishing');
    return false;
  }
  let success = false;
  for (const relay of relays) {
    try {
      await relay.event(event, { signal: AbortSignal.timeout(5000) });
      success = true;
    } catch (e) {
      // Try next relay
    }
  }
  // Clean up relay connections
  for (const relay of relays) {
    try { relay.close(); } catch {}
  }
  return success;
}

/** Query shared relays directly (bypassing personal relay list). */
async function querySharedRelays(filter: any, timeoutMs = 10000): Promise<any[]> {
  const relays = openSharedRelays();
  if (relays.length === 0) return [];
  const allEvents: any[] = [];
  const seenIds = new Set<string>();
  await Promise.all(relays.map(async (relay) => {
    try {
      const events = await relay.query([filter], { signal: AbortSignal.timeout(timeoutMs) });
      for (const ev of events) {
        if (!seenIds.has(ev.id)) {
          seenIds.add(ev.id);
          allEvents.push(ev);
        }
      }
    } catch {
      // Try next relay
    }
  }));
  // Clean up
  for (const relay of relays) {
    try { relay.close(); } catch {}
  }
  return allEvents;
}

/** Compute a stable fingerprint for a budget month. Used by both the sync
 *  handler (to record received snapshots) and PartnerSyncWrapper (to detect
 *  local changes) so the values match exactly. */
export function fingerprintBudgetMonth(budget: MonthlyBudget): string {
  return JSON.stringify({
    buckets: (budget.buckets || [])
      .map(b => ({
        name: b.name,
        color: b.color,
        // Include each line item's id + planned amount so edits to amounts
        // are detected (not just add/remove of line items).
        items: (b.lineItems || []).map(li => `${li.id}:${li.plannedAmount}`).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // Include each transaction's id + its line item assignment so reassigning
    // a transaction to a different line item is detected as a change.
    txs: (budget.transactions || []).map(t => `${t.id}:${t.lineItemId || ''}`).sort(),
    // Include deletedTxIds so a deletion changes the fingerprint and triggers
    // a publish — without this, deleting a transaction wouldn't sync.
    deletedTxIds: (budget.deletedTxIds || []).sort(),
  });
}

interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
}

interface BudgetSyncEvent {
  type: 'budget-updated';
  budgetMonth: string;
  data: { snapshot: MonthlyBudget };
  timestamp: number;
  version: number;
  authorPubkey?: string;
}

/**
 * Fetch all budget snapshots published under a shared budget keypair.
 */
export async function fetchAllSharedBudgetSnapshots(
  budgetNsec: string,
  _nostr: any  // kept for API compat, not used — we query shared relays directly
): Promise<MonthlyBudget[]> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return [];
    const priv = decoded.data as Uint8Array;
    const budgetPub = getPublicKey(priv);

    const events = await querySharedRelays(
      { kinds: [BUDGET_KIND], authors: [budgetPub], limit: 200 },
      10000
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

/**
 * Publish a full month snapshot to the shared budget keypair.
 */
export async function publishBudgetSnapshotToNostr(
  budget: MonthlyBudget,
  budgetNsec: string,
  _nostr: any  // kept for API compat, not used — we publish to shared relays directly
): Promise<boolean> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return false;
    const priv = decoded.data as Uint8Array;
    const pub = getPublicKey(priv);
    const signer = new NSecSigner(priv);

    const dTag = `${MONTH_DTAG_PREFIX}${budget.month}`;
    const syncEvent: BudgetSyncEvent = {
      type: 'budget-updated',
      budgetMonth: budget.month,
      data: { snapshot: budget },
      timestamp: Math.floor(Date.now() / 1000),
      version: 1,
    };

    const encrypted = encryptWithBudgetKey(JSON.stringify(syncEvent), priv, pub);

    const event = await signer.signEvent({
      kind: BUDGET_KIND,
      content: encrypted,
      tags: [
        ['d', dTag],
        ['alt', `Sat Sorter budget snapshot ${budget.month} (encrypted)`],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Publish to shared relays directly (bypassing personal relay list)
    const ok = await publishToSharedRelays(event);
    if (ok) {
      console.log(`[publishBudgetSnapshotToNostr] Published snapshot for ${budget.month} to shared relays`);
    } else {
      console.error(`[publishBudgetSnapshotToNostr] Failed to publish snapshot for ${budget.month} to any shared relay`);
    }
    return ok;
  } catch (e) {
    console.error('[publishBudgetSnapshotToNostr] Failed to publish snapshot:', e);
    return false;
  }
}

/**
 * Seed full snapshots for multiple months to the shared budget.
 * Used right after creating the keypair or adding a partner.
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
 * Publish a sync request to the shared budget (asks the owner to re-publish).
 */
export async function publishSyncRequest(
  budgetNsec: string,
  requesterPubkey: string,
  _nostr: any  // kept for API compat, not used
): Promise<boolean> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return false;
    const priv = decoded.data as Uint8Array;
    const pub = getPublicKey(priv);
    const signer = new NSecSigner(priv);

    const syncEvent = {
      type: 'sync-request',
      budgetMonth: '',
      data: {},
      timestamp: Math.floor(Date.now() / 1000),
      version: 1,
      authorPubkey: requesterPubkey,
    };

    const encrypted = encryptWithBudgetKey(JSON.stringify(syncEvent), priv, pub);

    const event = await signer.signEvent({
      kind: BUDGET_KIND,
      content: encrypted,
      tags: [['d', `${MONTH_DTAG_PREFIX}sync-request`], ['alt', 'Sat Sorter sync request']],
      created_at: Math.floor(Date.now() / 1000),
    });

    await publishToSharedRelays(event);
    return true;
  } catch (e) {
    console.error('[publishSyncRequest] Failed:', e);
    return false;
  }
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
      return publishBudgetSnapshotToNostr(budget, budgetKeypair.budgetNsec, nostr);
    },
    [budgetKeypair, nostr]
  );

  return { syncCopiedBudget, hasBudgetKeypair: !!budgetKeypair };
}

/**
 * useSharedBudgetSync — simplified full-snapshot sync via a shared Nostr keypair.
 */
export function useSharedBudgetSync(budgetNpub: string, budgetNsec: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { state, setState } = useBudgetContext();
  const { toast } = useToast();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    error: null,
  });

  const subscriptionRef = useRef<{ close?: () => void } | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());
  /** Fingerprint of the most recently received snapshot per month.
   *  PartnerSyncWrapper skips publishing months whose fingerprint matches —
   *  this prevents the echo where a received snapshot gets re-published. */
  const receivedFingerprintsRef = useRef<Map<string, string>>(new Map());
  /** Timestamp of the last local edit per month. Snapshots older than this
   *  are ignored so we never overwrite a newer local change. */
  const lastLocalChangeRef = useRef<Map<string, number>>(new Map());

  const keyBytes = useMemo(() => {
    if (!budgetNsec) return null;
    try {
      const decoded = nip19.decode(budgetNsec);
      if (decoded.type === 'nsec') {
        const priv = decoded.data as Uint8Array;
        return { budgetPriv: priv, budgetPub: getPublicKey(priv) };
      }
    } catch (e) {
      console.error('[SharedBudgetSync] Failed to decode budget nsec:', e);
    }
    return null;
  }, [budgetNsec]);

  const keyBytesRef = useRef(keyBytes);
  keyBytesRef.current = keyBytes;
  const stateRef = useRef({ state, setState });
  stateRef.current = { state, setState };
  const userPubkeyRef = useRef(user?.pubkey);
  userPubkeyRef.current = user?.pubkey;

  /** Publish a full month snapshot (replaces the previous one). */
  const publishBudgetSnapshot = useCallback(
    async (budget: MonthlyBudget): Promise<boolean> => {
      const keys = keyBytesRef.current;
      if (!keys) return false;
      return publishBudgetSnapshotToNostr(budget, budgetNsec, nostr);
    },
    [budgetNsec, nostr]
  );

  /** Handle an incoming budget event from the relay stream. */
  const handleIncomingEvent = useCallback(
    async (rawEvent: { id: string; pubkey: string; content: string; tags: string[][]; created_at?: number }) => {
      if (processedEventsRef.current.has(rawEvent.id)) return;
      processedEventsRef.current.add(rawEvent.id);

      const keys = keyBytesRef.current;
      if (!keys) return;
      if (rawEvent.pubkey !== keys.budgetPub) return;

      const dTag = rawEvent.tags.find((t) => t[0] === 'd')?.[1];
      if (!dTag || !dTag.startsWith(MONTH_DTAG_PREFIX)) return;

      try {
        const decrypted = decryptWithBudgetKey(rawEvent.content, keys.budgetPriv, keys.budgetPub);
        const syncEvent = JSON.parse(decrypted);

        if (syncEvent.type === 'sync-request') {
          if (syncEvent.authorPubkey === userPubkeyRef.current) return;
          const currentBudgets = stateRef.current.state.budgets;
          const hasData = currentBudgets.some(b => b.buckets && b.buckets.length > 0);
          if (!hasData) return;

          console.log('[SharedBudgetSync] Sync request received — re-publishing all budgets');
          for (const budget of currentBudgets) {
            if (budget.buckets && budget.buckets.length > 0) {
              await publishBudgetSnapshot(budget);
            }
          }
          toast({ title: 'Sync request received', description: 'Re-published all budget data to your partner.' });
          return;
        }

        if (syncEvent.type !== 'budget-updated') return;
        const snapshot = syncEvent.data?.snapshot as MonthlyBudget;
        if (!snapshot?.month) return;

        // Record the fingerprint so PartnerSyncWrapper doesn't echo this back
        receivedFingerprintsRef.current.set(snapshot.month, fingerprintBudgetMonth(snapshot));

        console.log(`[SharedBudgetSync] Received snapshot for ${snapshot.month}`);

        // Merge the incoming snapshot into local state — union by ID so neither
        // partner's edits are ever lost. This is the key fix for the
        // "transactions disappear / don't sync both ways" problem: we never
        // discard local data just because the other partner published a snapshot.
        stateRef.current.setState((prev) => {
          const existingIdx = prev.budgets.findIndex((b) => b.month === snapshot.month);
          const snapshotDeleted = new Set(snapshot.deletedTxIds || []);

          if (existingIdx >= 0) {
            const local = prev.budgets[existingIdx];

            // Merge transactions: keep all local txs, add any from snapshot we
            // don't have, and remove any that the snapshot says were deleted.
            const localTxIds = new Set(local.transactions.map(t => t.id));
            const newFromSnapshot = (snapshot.transactions || []).filter(
              t => !localTxIds.has(t.id) && !snapshotDeleted.has(t.id)
            );
            const mergedTxs = [
              ...local.transactions.filter(t => !snapshotDeleted.has(t.id)),
              ...newFromSnapshot,
            ];

            // Merge buckets: keep all local buckets, add any from snapshot we
            // don't have (matched by bucket id). Line items within each bucket
            // are unioned by id so neither partner's line items are lost.
            const localBucketIds = new Set(local.buckets.map(b => b.id));
            const newBuckets = (snapshot.buckets || []).filter(b => !localBucketIds.has(b.id));
            const mergedBuckets = [
              ...local.buckets.map(lb => {
                const snapBucket = (snapshot.buckets || []).find(sb => sb.id === lb.id);
                if (!snapBucket) return lb;
                // Union line items by id
                const localItemIds = new Set(lb.lineItems.map(li => li.id));
                const newItems = (snapBucket.lineItems || []).filter(li => !localItemIds.has(li.id));
                return { ...lb, lineItems: [...lb.lineItems, ...newItems] };
              }),
              ...newBuckets,
            ];

            // Union deletedTxIds so deletions propagate both ways
            const mergedDeleted = Array.from(new Set([
              ...(local.deletedTxIds || []),
              ...(snapshot.deletedTxIds || []),
            ]));

            const merged: MonthlyBudget = {
              ...local,
              buckets: mergedBuckets,
              transactions: mergedTxs,
              deletedTxIds: mergedDeleted,
            };

            const newBudgets = [...prev.budgets];
            newBudgets[existingIdx] = merged;
            return { ...prev, budgets: newBudgets };
          }

          // New month entirely — just add the snapshot
          return { ...prev, budgets: [...prev.budgets, snapshot] };
        });

        setSyncStatus((prev) => ({ ...prev, lastSync: Math.floor(Date.now() / 1000), error: null }));
      } catch (e) {
        console.error('[SharedBudgetSync] Error processing event:', e);
      }
    },
    [toast, publishBudgetSnapshot]
  );

  // Ref for the latest handleIncomingEvent so the subscription callback always
  // calls the current version without needing to re-subscribe on every render.
  const handleIncomingEventRef = useRef(handleIncomingEvent);
  handleIncomingEventRef.current = handleIncomingEvent;

  /** Subscribe to budget events from the budget npub. */
  useEffect(() => {
    const keys = keyBytes;
    if (!keys || !budgetNpub) {
      console.log('[SharedBudgetSync] Not starting subscription — keyBytes:', !!keys, 'budgetNpub:', !!budgetNpub);
      return;
    }

    // Prevent re-subscribing when the effect re-runs due to non-key changes
    // (e.g. toast/publishBudgetSnapshot reference changes). The subscription
    // should only re-start when the keypair or relay pool actually changes.
    if (subscriptionRef.current) return;

    console.log(`[SharedBudgetSync] Subscribing to budget npub ${budgetNpub.slice(0, 16)}...`);
    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    let cancelled = false;

    (async () => {
      try {
        // Query shared relays directly (bypassing personal relay list)
        const existing = await querySharedRelays(
          { kinds: [BUDGET_KIND], authors: [keys.budgetPub], limit: 200 },
          10000
        );
        console.log(`[SharedBudgetSync] Fetched ${existing.length} existing budget events from shared relays`);

        // Sort by created_at ascending so the newest snapshot for each month
        // is applied LAST — prevents an older snapshot from overwriting a newer one.
        const sorted = [...existing].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

        for (const ev of sorted) {
          if (!cancelled) await handleIncomingEventRef.current(ev);
        }
      } catch (e) {
        console.warn('[SharedBudgetSync] Initial fetch failed:', e);
      }

      if (cancelled) return;
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }));

      // Live subscription: open direct relay connections to shared relays
      // and subscribe for new events. This bypasses the personal relay list
      // so both partners always receive each other's events.
      const now = Math.floor(Date.now() / 1000);
      const sharedRelays = openSharedRelays();
      const subscriptions: { close?: () => void }[] = [];

      for (const relay of sharedRelays) {
        try {
          // NRelay1.req() returns an async generator of relay messages.
          const sub = relay.req([
            { kinds: [BUDGET_KIND], authors: [keys.budgetPub], since: now - 30 },
          ]);
          subscriptions.push({
            close: () => { void sub.return(undefined); },
          });
          // Drain the subscription stream in the background
          void (async () => {
            try {
              for await (const msg of sub) {
                if (msg[0] === 'EVENT' && msg[2]) {
                  handleIncomingEventRef.current(msg[2]);
                } else if (msg[0] === 'EOSE') {
                  console.log(`[SharedBudgetSync] Live subscription active on ${relay.constructor.name}`);
                }
              }
            } catch {
              // relay connection closed
            }
          })();
        } catch (e) {
          console.warn('[SharedBudgetSync] Failed to subscribe on a shared relay:', e);
        }
      }

      // Store a combined "subscription" that can close all of them
      subscriptionRef.current = {
        close: () => {
          for (const sub of subscriptions) {
            try { sub.close?.(); } catch {}
          }
          for (const relay of sharedRelays) {
            try { relay.close(); } catch {}
          }
        },
      };
    })();

    return () => {
      cancelled = true;
      if (subscriptionRef.current && typeof subscriptionRef.current.close === 'function') {
        subscriptionRef.current.close();
        subscriptionRef.current = null;
      }
    };
  }, [budgetNpub, keyBytes]);

  /** Manually re-fetch all existing budget events from relays. */
  const forceSync = useCallback(async () => {
    const keys = keyBytesRef.current;
    if (!keys) return;

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    try {
      const existing = await querySharedRelays(
        { kinds: [BUDGET_KIND], authors: [keys.budgetPub], limit: 200 },
        10000
      );
      console.log(`[SharedBudgetSync] Force sync fetched ${existing.length} events from shared relays`);

      // Sort by created_at ascending so the newest snapshot per month is applied last
      const sorted = [...existing].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      for (const ev of sorted) {
        await handleIncomingEventRef.current(ev);
      }
      setSyncStatus((prev) => ({ ...prev, isSyncing: false, lastSync: Math.floor(Date.now() / 1000) }));
    } catch (e) {
      console.error('[SharedBudgetSync] Force sync failed:', e);
      setSyncStatus((prev) => ({ ...prev, isSyncing: false, error: e instanceof Error ? e.message : 'Sync failed' }));
    }
  }, []);

  /** Publish a sync request asking the owner to re-publish all data. */
  const requestSync = useCallback(async (): Promise<boolean> => {
    if (!budgetNsec || !user?.pubkey) return false;
    return publishSyncRequest(budgetNsec, user.pubkey, nostr);
  }, [budgetNsec, nostr, user?.pubkey]);

  /** Mark that a local edit happened for a month — used by PartnerSyncWrapper
   *  so it doesn't treat an incoming snapshot as a local change. */
  const markLocalChange = useCallback((month: string) => {
    lastLocalChangeRef.current.set(month, Math.floor(Date.now() / 1000));
  }, []);

  /** Mark a month as "just received from sync/invite" so PartnerSyncWrapper
   *  doesn't echo it back. Called by ManagePartnersDialog after applying an
   *  invite snapshot, and internally when a relay snapshot arrives. */
  const markReceivedSnapshot = useCallback((month: string, snapshot: MonthlyBudget) => {
    receivedFingerprintsRef.current.set(month, fingerprintBudgetMonth(snapshot));
  }, []);

  return {
    syncStatus,
    publishBudgetSnapshot,
    hasBudgetKeypair: !!keyBytesRef.current,
    forceSync,
    requestSync,
    /** Fingerprints of recently received snapshots (per month). */
    receivedFingerprints: receivedFingerprintsRef,
    /** Call when a local edit happens so incoming snapshots don't overwrite it. */
    markLocalChange,
    /** Call when applying a snapshot from an invite so it isn't echoed back. */
    markReceivedSnapshot,
    /** Timestamp of last local edit per month. */
    lastLocalChange: lastLocalChangeRef,
  };
}
