import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { NSecSigner } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { encryptWithBudgetKey, decryptWithBudgetKey } from '@/lib/budgetCrypto';
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
 */

const BUDGET_KIND = 30078;
const MONTH_DTAG_PREFIX = 'sat-sorter/budget-data/';

/** Compute a stable fingerprint for a budget month. Used by both the sync
 *  handler (to record received snapshots) and PartnerSyncWrapper (to detect
 *  local changes) so the values match exactly. */
export function fingerprintBudgetMonth(budget: MonthlyBudget): string {
  return JSON.stringify({
    buckets: (budget.buckets || [])
      .map(b => ({ name: b.name, color: b.color, items: b.lineItems?.length }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    txIds: (budget.transactions || []).map(t => t.id).sort(),
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
  nostr: any
): Promise<MonthlyBudget[]> {
  try {
    const decoded = nip19.decode(budgetNsec);
    if (decoded.type !== 'nsec') return [];
    const priv = decoded.data as Uint8Array;
    const budgetPub = getPublicKey(priv);

    const events = await nostr.query(
      [{ kinds: [BUDGET_KIND], authors: [budgetPub], limit: 200 }],
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

/**
 * Publish a full month snapshot to the shared budget keypair.
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
  nostr: any
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

    await nostr.event(event, { signal: AbortSignal.timeout(5000) });
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

        // Timestamp guard: only apply snapshots newer than the last local edit.
        // This prevents an older relay event from overwriting a newer local change.
        const eventTimestamp = rawEvent.created_at || syncEvent.timestamp || 0;
        const lastLocalChange = lastLocalChangeRef.current.get(snapshot.month) || 0;
        if (lastLocalChange > 0 && eventTimestamp > 0 && eventTimestamp < lastLocalChange) {
          console.log(`[SharedBudgetSync] Skipping older snapshot for ${snapshot.month} (local is newer)`);
          return;
        }

        // Record the fingerprint so PartnerSyncWrapper doesn't echo this back
        receivedFingerprintsRef.current.set(snapshot.month, fingerprintBudgetMonth(snapshot));

        console.log(`[SharedBudgetSync] Received snapshot for ${snapshot.month}`);

        // Replace the local month entirely with the snapshot — the snapshot is
        // the source of truth for the shared budget. This ensures deletions
        // propagate and both partners always converge to the same state.
        stateRef.current.setState((prev) => {
          const existingIdx = prev.budgets.findIndex((b) => b.month === snapshot.month);
          if (existingIdx >= 0) {
            const newBudgets = [...prev.budgets];
            newBudgets[existingIdx] = snapshot;
            return { ...prev, budgets: newBudgets };
          }
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
        const existing = await nostr.query(
          [{ kinds: [BUDGET_KIND], authors: [keys.budgetPub], limit: 200 }],
          { signal: AbortSignal.timeout(10000) }
        );
        console.log(`[SharedBudgetSync] Fetched ${existing.length} existing budget events`);

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

      // Use `since` to only receive NEW events published after the initial fetch.
      const now = Math.floor(Date.now() / 1000);
      subscriptionRef.current = nostr.req(
        [{ kinds: [BUDGET_KIND], authors: [keys.budgetPub], since: now }],
        {
          onevent: (ev) => handleIncomingEventRef.current(ev),
          oneose: () => { console.log('[SharedBudgetSync] Live subscription active'); },
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
  }, [budgetNpub, keyBytes]);

  /** Manually re-fetch all existing budget events from relays. */
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
  }, [nostr]);

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
