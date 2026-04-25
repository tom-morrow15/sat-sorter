import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { usePartners } from '@/hooks/usePartners';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { Transaction, MonthlyBudget, BudgetPartner } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

const PARTNER_SYNC_KIND = 4002; // Budget Partner Transaction Sync
const BUDGET_CATEGORY = 'sat-sorter';

interface PartnerSyncEvent {
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

interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
}

/**
 * A ref-based tracker shared between the sync hook and the wrapper component.
 * Transactions added/updated/deleted from REMOTE partner events are marked
 * here so the wrapper doesn't publish them back out (echo loop prevention).
 */
export interface RemoteOriginTracker {
  // Transaction IDs that were added remotely (wrapper should skip publishing)
  remoteAdded: Set<string>;
  // Transaction IDs that were updated remotely with the stringified data
  remoteUpdated: Map<string, string>;
  // Transaction IDs that were deleted remotely
  remoteDeleted: Set<string>;
}

// Shared singleton tracker (lives for the lifetime of the page)
const globalRemoteTracker: RemoteOriginTracker = {
  remoteAdded: new Set(),
  remoteUpdated: new Map(),
  remoteDeleted: new Set(),
};

export function getRemoteOriginTracker(): RemoteOriginTracker {
  return globalRemoteTracker;
}

/**
 * usePartnerTransactionSync - Real-time transaction sync between budget partners
 *
 * How it works:
 * 1. Each user subscribes to sync events from all their partners' pubkeys
 * 2. When publishing, we encrypt to EACH partner's pubkey (one event per partner)
 *    so they can decrypt using NIP-44's shared secret (derived from both keys)
 * 3. On receipt, we decrypt using the sender's pubkey + our own signer
 * 4. Incoming transactions are marked in the "remote origin tracker" so the
 *    wrapper component doesn't publish them back out
 * 5. Only accepted partners are involved in sync
 */
export function usePartnerTransactionSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { state, setState } = useBudgetContext();
  const { partners: nostrPartners } = usePartners();
  const { mutateAsync: publish } = useNostrPublish();
  const { toast } = useToast();

  // Combine both partner sources:
  // - usePartners (Nostr kind 30078) — used by the OWNER to track their partners
  // - state.partners (localStorage) — used by INVITEES to track the owner they accepted
  // Deduplicate by pubkey, prefer accepted status from either source.
  const partners = useMemo<BudgetPartner[]>(() => {
    const localPartners = state.partners || [];
    const combined = new Map<string, BudgetPartner>();

    for (const p of nostrPartners || []) {
      combined.set(p.pubkey, p);
    }
    for (const p of localPartners) {
      const existing = combined.get(p.pubkey);
      if (existing) {
        // Prefer "accepted" status from either source
        if (existing.status !== 'accepted' && p.status === 'accepted') {
          combined.set(p.pubkey, { ...existing, status: 'accepted', acceptedAt: p.acceptedAt });
        }
      } else {
        combined.set(p.pubkey, p);
      }
    }

    return Array.from(combined.values());
  }, [nostrPartners, state.partners]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    error: null,
  });

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Keep latest values in a ref so handleIncomingSyncEvent has stable closure
  const stateRef = useRef({ state, user, setState });
  stateRef.current = { state, user, setState };

  // Keep latest partners list for publishSyncEvent
  const latestPartnersRef = useRef(partners);
  latestPartnersRef.current = partners;

  /**
   * Publish a sync event to all accepted partners.
   * Each partner gets their own event (encrypted to them specifically).
   */
  const publishSyncEvent = useCallback(
    async (syncEvent: PartnerSyncEvent): Promise<boolean> => {
      const currentUser = stateRef.current.user;
      if (!currentUser?.pubkey || !currentUser?.signer?.nip44) {
        console.warn('[PartnerSync] User not logged in or NIP-44 unavailable');
        return false;
      }

      // Publish to partners that are accepted OR pending (optimistic).
      // We use the latest combined list from the hook's state via closure.
      const allPartners = latestPartnersRef.current.filter(
        (p) => p.status === 'accepted' || p.status === 'pending'
      );

      if (allPartners.length === 0) {
        console.log('[PartnerSync] No partners to sync with');
        return true;
      }
      const acceptedPartners = allPartners;

      const payload = JSON.stringify(syncEvent);
      let successCount = 0;

      // Publish one event per partner, encrypted to each partner's pubkey
      for (const partner of acceptedPartners) {
        try {
          const encrypted = await currentUser.signer.nip44.encrypt(
            partner.pubkey,
            payload
          );

          await publish({
            kind: PARTNER_SYNC_KIND,
            content: encrypted,
            tags: [
              ['p', partner.pubkey], // Recipient pubkey (for filtering)
              ['budget', BUDGET_CATEGORY],
              ['month', syncEvent.budgetMonth],
              ['type', syncEvent.type],
              ['version', syncEvent.version.toString()],
              ['alt', `Sat Sorter budget sync: ${syncEvent.type}`],
            ],
          });

          successCount++;
          console.log(
            `[PartnerSync] Published ${syncEvent.type} to partner ${partner.pubkey.slice(0, 8)}`
          );
        } catch (e) {
          console.error(
            `[PartnerSync] Failed to publish to ${partner.pubkey.slice(0, 8)}:`,
            e
          );
        }
      }

      setSyncStatus((prev) => ({
        ...prev,
        lastSync: Math.floor(Date.now() / 1000),
      }));

      return successCount > 0;
    },
    [publish]
  );

  /**
   * Handle incoming sync event from a partner.
   * This updates local state AND marks the change in the remote tracker
   * so the wrapper doesn't republish it.
   */
  const handleIncomingSyncEvent = useCallback(
    async (event: { id: string; pubkey: string; content: string; tags: string[][] }) => {
      // Skip if already processed
      if (processedEventsRef.current.has(event.id)) {
        return;
      }
      processedEventsRef.current.add(event.id);

      const currentUser = stateRef.current.user;
      if (!currentUser?.signer?.nip44 || !currentUser.pubkey) {
        console.warn('[PartnerSync] Cannot decrypt - NIP-44 unavailable');
        return;
      }

      // Ignore our own events
      if (event.pubkey === currentUser.pubkey) {
        return;
      }

      // Only process events addressed to us
      const recipientTag = event.tags.find((t) => t[0] === 'p')?.[1];
      if (recipientTag !== currentUser.pubkey) {
        return;
      }

      try {
        // Decrypt using sender's pubkey (NIP-44 shared secret)
        const decrypted = await currentUser.signer.nip44.decrypt(
          event.pubkey,
          event.content
        );
        const syncEvent: PartnerSyncEvent = JSON.parse(decrypted);

        console.log(
          `[PartnerSync] Received ${syncEvent.type} from ${event.pubkey.slice(0, 8)} for month ${syncEvent.budgetMonth}`
        );

        // Apply the update to local state.
        // IMPORTANT: We update directly via setState to ensure we don't
        // re-trigger the publish loop (wrapper uses remote tracker).
        const setStateFn = stateRef.current.setState;

        switch (syncEvent.type) {
          case 'transaction-added': {
            if (!syncEvent.data.transaction) break;
            const incoming = syncEvent.data.transaction;

            // Mark in remote tracker BEFORE state update so wrapper skips it
            globalRemoteTracker.remoteAdded.add(incoming.id);

            setStateFn((prev) => {
              // Find or create the budget for this month
              const existingBudgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );

              if (existingBudgetIdx >= 0) {
                const existingBudget = prev.budgets[existingBudgetIdx];
                // Check if transaction already exists (avoid duplicates)
                if (existingBudget.transactions.some((t) => t.id === incoming.id)) {
                  console.log('[PartnerSync] Transaction already exists, skipping');
                  return prev;
                }
                const updatedBudget: MonthlyBudget = {
                  ...existingBudget,
                  transactions: [...existingBudget.transactions, incoming],
                };
                const newBudgets = [...prev.budgets];
                newBudgets[existingBudgetIdx] = updatedBudget;
                return { ...prev, budgets: newBudgets };
              } else {
                // Create new budget for this month with just this transaction
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

            // Mark in remote tracker with serialized data
            globalRemoteTracker.remoteUpdated.set(incoming.id, JSON.stringify(incoming));

            setStateFn((prev) => {
              const budgetIdx = prev.budgets.findIndex(
                (b) => b.month === syncEvent.budgetMonth
              );
              if (budgetIdx < 0) return prev;

              const budget = prev.budgets[budgetIdx];
              const txIdx = budget.transactions.findIndex((t) => t.id === incoming.id);
              if (txIdx < 0) {
                // Transaction doesn't exist locally; treat as add
                const updatedBudget: MonthlyBudget = {
                  ...budget,
                  transactions: [...budget.transactions, incoming],
                };
                const newBudgets = [...prev.budgets];
                newBudgets[budgetIdx] = updatedBudget;
                return { ...prev, budgets: newBudgets };
              }

              const newTransactions = [...budget.transactions];
              newTransactions[txIdx] = incoming;
              const updatedBudget: MonthlyBudget = {
                ...budget,
                transactions: newTransactions,
              };
              const newBudgets = [...prev.budgets];
              newBudgets[budgetIdx] = updatedBudget;
              return { ...prev, budgets: newBudgets };
            });
            break;
          }

          case 'transaction-deleted': {
            if (!syncEvent.data.transactionId) break;
            const txId = syncEvent.data.transactionId;

            // Mark in remote tracker
            globalRemoteTracker.remoteDeleted.add(txId);

            setStateFn((prev) => {
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
        }

        setSyncStatus((prev) => ({
          ...prev,
          lastSync: Math.floor(Date.now() / 1000),
          error: null,
        }));
      } catch (e) {
        console.error('[PartnerSync] Error processing event:', e);
      }
    },
    [toast]
  );

  /**
   * Subscribe to partner events addressed to us.
   * Re-subscribes whenever partner list changes.
   */
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44) {
      return;
    }

    // Subscribe to all partners (accepted + pending). If a partner is pending
    // because we haven't seen their accept response yet, we still want to
    // receive their sync events.
    const relevantPartnerPubkeys = partners
      .filter((p) => p.status === 'accepted' || p.status === 'pending')
      .map((p) => p.pubkey);

    if (relevantPartnerPubkeys.length === 0) {
      console.log('[PartnerSync] No partners, skipping subscription');
      return;
    }

    console.log(
      `[PartnerSync] Subscribing to events from ${relevantPartnerPubkeys.length} partner(s) addressed to us`
    );

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    // Subscribe to events:
    // - authored by any accepted partner
    // - addressed to us (#p tag)
    // - in the sat-sorter budget category
    subscriptionRef.current = nostr.req(
      [
        {
          kinds: [PARTNER_SYNC_KIND],
          authors: relevantPartnerPubkeys,
          '#p': [user.pubkey],
          '#budget': [BUDGET_CATEGORY],
          limit: 200,
        },
      ],
      {
        onevent: handleIncomingSyncEvent,
        oneose: () => {
          console.log('[PartnerSync] Subscription EOSE (initial events loaded)');
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
    // Only re-subscribe when the set of partner pubkeys changes, not on every
    // partners array mutation (which happens frequently during sync).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.pubkey,
    user?.signer?.nip44,
    nostr,
    partners
      .filter((p) => p.status === 'accepted' || p.status === 'pending')
      .map((p) => p.pubkey)
      .sort()
      .join(','),
  ]);

  /**
   * Public API: Publish a transaction add event
   */
  const publishTransactionAdd = useCallback(
    async (transaction: Transaction, month: string): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-added',
        budgetMonth: month,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      return publishSyncEvent(syncEvent);
    },
    [publishSyncEvent]
  );

  const publishTransactionUpdate = useCallback(
    async (transaction: Transaction, month: string): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-updated',
        budgetMonth: month,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      return publishSyncEvent(syncEvent);
    },
    [publishSyncEvent]
  );

  const publishTransactionDelete = useCallback(
    async (transactionId: string, month: string): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-deleted',
        budgetMonth: month,
        data: { transactionId },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };
      return publishSyncEvent(syncEvent);
    },
    [publishSyncEvent]
  );

  return {
    syncStatus,
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,
    // Expose tracker for wrapper to check origin of changes
    remoteTracker: globalRemoteTracker,
    // For diagnostics
    processedEventsCount: processedEventsRef.current.size,
    acceptedPartnerCount: partners.filter((p) => p.status === 'accepted').length,
    activePartnerCount: partners.filter((p) => p.status === 'accepted' || p.status === 'pending').length,
  };
}
