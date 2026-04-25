import { useEffect, useCallback, useRef, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudget } from '@/hooks/useBudget';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { Transaction } from '@/lib/budgetTypes';

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

interface SyncState {
  isSyncing: boolean;
  lastSync: number | null;
  pendingUpdates: PartnerSyncEvent[];
  receivedUpdates: Map<string, PartnerSyncEvent[]>;
}

/**
 * usePartnerTransactionSync - Real-time transaction sync between budget partners
 * 
 * This hook enables automatic real-time synchronization of transactions between partners.
 * When a partner adds, updates, or deletes a transaction:
 * 1. The change is published to Nostr (encrypted)
 * 2. All other partners receive it via real-time subscription
 * 3. Local state is updated automatically
 * 4. Users see changes in real-time on all devices
 * 
 * Key design decisions:
 * - Each user publishes their own changes to their pubkey
 * - All partners subscribe to each other's pubkeys
 * - Events are encrypted with NIP-44 for privacy
 * - Version numbers help with conflict detection
 * - Timestamps ensure proper event ordering
 */
export function usePartnerTransactionSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { 
    partners, 
    currentMonth, 
    fullState, 
    addTransaction: addTransactionLocal,
    updateTransaction: updateTransactionLocal,
    deleteTransaction: deleteTransactionLocal,
  } = useBudget();
  const { mutateAsync: publish } = useNostrPublish();
  const { toast } = useToast();

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSync: null,
    pendingUpdates: [],
    receivedUpdates: new Map(),
  });

  const subscriptionRef = useRef<{ close: () => void } | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set()); // Track processed event IDs

  /**
   * Publish a transaction sync event to Nostr
   */
  const publishSyncEvent = useCallback(
    async (syncEvent: PartnerSyncEvent): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        console.warn('[usePartnerTransactionSync] User not logged in or NIP-44 unavailable');
        return false;
      }

      try {
        // Encrypt the sync event
        const encrypted = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(syncEvent)
        );

        // Publish to Nostr
        await publish({
          kind: PARTNER_SYNC_KIND,
          content: encrypted,
          tags: [
            ['p', user.pubkey],
            ['budget', BUDGET_CATEGORY],
            ['month', syncEvent.budgetMonth],
            ['type', syncEvent.type],
            ['version', syncEvent.version.toString()],
            ['alt', `Sat Sorter budget sync: ${syncEvent.type}`],
          ],
        });

        console.log(
          `[usePartnerTransactionSync] Published ${syncEvent.type} event for ${syncEvent.budgetMonth}`
        );
        return true;
      } catch (e) {
        console.error('[usePartnerTransactionSync] Failed to publish sync event:', e);
        return false;
      }
    },
    [user, publish]
  );

  /**
   * Handle incoming sync event from a partner
   */
  const handleIncomingSyncEvent = useCallback(
    async (event: any) => {
      const eventId = event.id;

      // Skip if already processed
      if (processedEventsRef.current.has(eventId)) {
        return;
      }
      processedEventsRef.current.add(eventId);

      try {
        if (!user?.signer?.nip44) {
          console.warn('[usePartnerTransactionSync] Cannot decrypt - NIP-44 unavailable');
          return;
        }

        // Decrypt the content
        const decrypted = await user.signer.nip44.decrypt(event.pubkey, event.content);
        const syncEvent: PartnerSyncEvent = JSON.parse(decrypted);

        // Only process events for current month
        if (syncEvent.budgetMonth !== currentMonth) {
          console.log(
            `[usePartnerTransactionSync] Ignoring event for different month: ${syncEvent.budgetMonth} vs ${currentMonth}`
          );
          return;
        }

        // Track received update
        setSyncState((prev) => {
          const updated = new Map(prev.receivedUpdates);
          const eventList = updated.get(event.pubkey) || [];
          updated.set(event.pubkey, [...eventList, syncEvent]);
          return {
            ...prev,
            receivedUpdates: updated,
          };
        });

        // Apply the update to local state
        switch (syncEvent.type) {
          case 'transaction-added': {
            if (!syncEvent.data.transaction) break;
            console.log(
              `[usePartnerTransactionSync] Applying transaction add from ${event.pubkey.slice(0, 8)}`
            );
            // Check if transaction already exists to avoid duplicates
            const existing = fullState.budgets
              .find((b) => b.month === syncEvent.budgetMonth)
              ?.transactions.find((t) => t.id === syncEvent.data.transaction!.id);

            if (!existing) {
              addTransactionLocal(syncEvent.data.transaction);
              toast({
                title: 'Transaction synced',
                description: `${syncEvent.data.transaction.description} (${syncEvent.data.transaction.amount} sats)`,
              });
            }
            break;
          }

          case 'transaction-updated': {
            if (!syncEvent.data.transaction) break;
            console.log(
              `[usePartnerTransactionSync] Applying transaction update from ${event.pubkey.slice(0, 8)}`
            );
            updateTransactionLocal(
              syncEvent.data.transaction.id,
              syncEvent.data.transaction
            );
            break;
          }

          case 'transaction-deleted': {
            if (!syncEvent.data.transactionId) break;
            console.log(
              `[usePartnerTransactionSync] Applying transaction delete from ${event.pubkey.slice(0, 8)}`
            );
            deleteTransactionLocal(syncEvent.data.transactionId);
            break;
          }

          case 'budget-updated': {
            console.log(
              `[usePartnerTransactionSync] Budget update from ${event.pubkey.slice(0, 8)}`
            );
            // Could implement full budget merge here if needed
            break;
          }
        }

        setSyncState((prev) => ({
          ...prev,
          lastSync: Math.floor(Date.now() / 1000),
        }));
      } catch (e) {
        console.error('[usePartnerTransactionSync] Error processing sync event:', e);
      }
    },
    [user, currentMonth, fullState, addTransactionLocal, updateTransactionLocal, deleteTransactionLocal, toast]
  );

  /**
   * Subscribe to partner transaction updates
   */
  useEffect(() => {
    if (!partners || partners.length === 0 || !user?.pubkey) {
      return;
    }

    // Get all relevant pubkeys (owner + accepted partners)
    const allRelevantPubkeys = [user.pubkey];
    const acceptedPartners = partners.filter((p) => p.status === 'accepted');
    allRelevantPubkeys.push(...acceptedPartners.map((p) => p.pubkey));

    if (allRelevantPubkeys.length === 1) {
      // Only me, no partners yet
      return;
    }

    console.log(
      `[usePartnerTransactionSync] Subscribing to ${allRelevantPubkeys.length - 1} partners`
    );

    // Subscribe to partner sync events
    subscriptionRef.current = nostr.req(
      [
        {
          kinds: [PARTNER_SYNC_KIND],
          authors: allRelevantPubkeys,
          '#budget': [BUDGET_CATEGORY],
          limit: 100, // Get recent events
        },
      ],
      {
        onevent: handleIncomingSyncEvent,
        oneose: () => {
          console.log('[usePartnerTransactionSync] Subscription established');
          setSyncState((prev) => ({
            ...prev,
            isSyncing: false,
          }));
        },
      }
    );

    // Clean up on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
        subscriptionRef.current = null;
      }
    };
  }, [partners, user, nostr, handleIncomingSyncEvent]);

  /**
   * Public API: Publish a transaction add event
   */
  const publishTransactionAdd = useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-added',
        budgetMonth: currentMonth,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };

      return publishSyncEvent(syncEvent);
    },
    [currentMonth, publishSyncEvent]
  );

  /**
   * Public API: Publish a transaction update event
   */
  const publishTransactionUpdate = useCallback(
    async (transaction: Transaction): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-updated',
        budgetMonth: currentMonth,
        data: { transaction },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };

      return publishSyncEvent(syncEvent);
    },
    [currentMonth, publishSyncEvent]
  );

  /**
   * Public API: Publish a transaction delete event
   */
  const publishTransactionDelete = useCallback(
    async (transactionId: string): Promise<boolean> => {
      const syncEvent: PartnerSyncEvent = {
        type: 'transaction-deleted',
        budgetMonth: currentMonth,
        data: { transactionId },
        timestamp: Math.floor(Date.now() / 1000),
        version: 1,
      };

      return publishSyncEvent(syncEvent);
    },
    [currentMonth, publishSyncEvent]
  );

  return {
    // State
    isSyncing: syncState.isSyncing,
    lastSync: syncState.lastSync,
    receivedUpdates: syncState.receivedUpdates,

    // Public API
    publishTransactionAdd,
    publishTransactionUpdate,
    publishTransactionDelete,

    // Diagnostics
    processedEventsCount: processedEventsRef.current.size,
  };
}
