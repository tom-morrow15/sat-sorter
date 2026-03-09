import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { getSafeNip44 } from '@/lib/utils';
import { useExtensionReady } from '@/hooks/useExtensionReady';
import {
  BudgetState,
  MonthlyBudget,
  Bucket,
  LineItem,
  Transaction,
  SplitAllocation,
  BudgetInvitation,
  PendingInvitation,
  SentInvitation,
  createDefaultBuckets,
  getCurrentMonth,
  generateId,
} from '@/lib/budgetTypes';
import { nip19 } from 'nostr-tools';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078; // NIP-78 Application-specific data
const INVITE_KIND = 10078; // Budget invitation events
const AUTO_SAVE_DEBOUNCE_MS = 2000; // 2 seconds after last change - gives time for rapid edits to settle

// Helper to create d-tag for shared budgets (gift-wrapped to specific recipient)
const getSharedBudgetDTag = (budgetId: string, forPubkey: string) =>
  `sat-sorter/shared-budget/${budgetId}/for/${forPubkey}`;

// Helper to get a comparable string for budget data, excluding version/metadata
// This prevents infinite save loops when version is incremented
const getComparableState = (state: BudgetState): string => {
  const { version, lastEditedBy, lastEditedAt, ...dataOnly } = state;
  return JSON.stringify(dataOnly);
};

/**
 * Merge all local-only transactions from local state into remote state.
 * This prevents losing transactions that were added locally (manually or via NWC)
 * but haven't been saved to relays yet (e.g., app was closed before the debounce fired).
 *
 * Matching strategy (in priority order):
 *  1. By transaction ID — exact match (all transaction types)
 *  2. By payment hash — for NWC/Lightning transactions that share a hash
 */
const mergeNWCTransactions = (localState: BudgetState, remoteState: BudgetState): BudgetState => {
  // Create sets of all IDs and payment hashes in remote state for fast lookup
  const remoteTransactionIds = new Set<string>();
  const remotePaymentHashes = new Set<string>();
  for (const budget of remoteState.budgets) {
    for (const tx of budget.transactions) {
      remoteTransactionIds.add(tx.id);
      if (tx.paymentHash) {
        remotePaymentHashes.add(tx.paymentHash);
      }
    }
  }

  // Find ALL transactions in local state that don't exist in remote
  // (not just NWC — this covers manually added transactions too)
  const localOnlyTransactions: Array<{ tx: Transaction; month: string }> = [];
  for (const budget of localState.budgets) {
    for (const tx of budget.transactions) {
      const existsInRemoteById = remoteTransactionIds.has(tx.id);
      const existsInRemoteByHash = tx.paymentHash ? remotePaymentHashes.has(tx.paymentHash) : false;

      if (!existsInRemoteById && !existsInRemoteByHash) {
        localOnlyTransactions.push({ tx, month: budget.month });
        console.log('[BudgetStore] Found local transaction missing from remote:', {
          id: tx.id,
          source: tx.source || 'manual',
          paymentHash: tx.paymentHash ? tx.paymentHash.slice(0, 16) + '...' : 'none',
          amount: tx.amount,
          description: tx.description,
          month: budget.month,
        });
      }
    }
  }

  // If no local-only transactions are missing, return remote as-is
  if (localOnlyTransactions.length === 0) {
    return remoteState;
  }

  console.log('[BudgetStore] Merging', localOnlyTransactions.length, 'local-only transactions into remote state');

  // Clone remote state and add the missing transactions
  const mergedBudgets = remoteState.budgets.map(budget => ({
    ...budget,
    transactions: [...budget.transactions],
  }));

  // Add each missing transaction to the appropriate month
  for (const { tx, month } of localOnlyTransactions) {
    let targetBudget = mergedBudgets.find(b => b.month === month);

    if (!targetBudget) {
      // Create a new budget for this month if it doesn't exist
      targetBudget = {
        id: generateId(),
        month,
        buckets: createDefaultBuckets(),
        transactions: [],
      };
      mergedBudgets.push(targetBudget);
    }

    // Add the transaction if it's not already there (double-check by ID)
    if (!targetBudget.transactions.some(t => t.id === tx.id)) {
      targetBudget.transactions.push(tx);
    }
  }

  return {
    ...remoteState,
    budgets: mergedBudgets,
  };
};

const DEFAULT_STATE: BudgetState = {
  currentMonth: getCurrentMonth(),
  budgets: [],
  currency: 'sats',
  budgetId: undefined,
  version: 1,
  lastEditedBy: undefined,
  lastEditedAt: undefined,
  isShared: false,
  ownerPubkey: undefined,
  partnerPubkeys: [],
};

type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'offline' | 'conflict';

// Conflict information when remote version is newer
interface ConflictInfo {
  localVersion: number;
  remoteVersion: number;
  remoteEditedBy: string;
  remoteEditedAt: number;
  remoteBudget: BudgetState;
}

/**
 * Relay-first budget store
 *
 * When logged in:
 * - Loads budget from Nostr relays on startup
 * - Auto-saves to relays after every change (debounced)
 * - Local storage is just a cache for speed
 *
 * When logged out:
 * - Uses local storage only
 * - No sync, pure local mode
 */
export function useBudgetStore() {
  const { nostr } = useNostr();
  const { user, loginType } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();

  // Local storage for caching and offline/logged-out mode
  const [localState, setLocalState] = useLocalStorage<BudgetState>('sat-sorter-budget', DEFAULT_STATE);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);
  const [partnerUpdateNotification, setPartnerUpdateNotification] = useState<string | null>(null);

  // Track if we have unsaved local changes (for offline conflict detection)
  const [hasUnsavedLocalChanges, setHasUnsavedLocalChanges] = useState(false);
  const [offlineChangesMade, setOfflineChangesMade] = useState(false);

  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedStateRef = useRef<string>('');
  const lastSaveTimestampRef = useRef<number>(0); // Track when we last saved successfully
  const isSavingRef = useRef(false);
  const isAcceptingInviteRef = useRef(false); // Prevent auto-save during invite acceptance
  const wasOfflineRef = useRef(!navigator.onLine);
  const localStateRef = useRef(localState); // Ref to track current state for subscriptions
  const transactionUpdatedRef = useRef(false); // Flag to trigger immediate save on transaction update

  // Keep the ref updated with latest state
  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // When coming back online with offline changes on a shared budget, check for conflicts
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = !isOnline;

    // Just came back online
    if (isOnline && wasOffline && offlineChangesMade && localState.isShared) {
      console.log('[BudgetStore] Back online with offline changes - checking for conflicts...');

      // Don't auto-sync - user needs to explicitly resolve
      // The conflict will be detected when they try to save or when we receive a subscription update
      setSyncStatus('idle');
    }
  }, [isOnline, offlineChangesMade, localState.isShared]);

  // Check for NIP-44 support
  const needsExtension = loginType === 'extension';
  const { isReady: isExtensionReady } = useExtensionReady();

  const nip44 = useMemo(() => {
    if (needsExtension && !isExtensionReady) return null;
    return getSafeNip44(user);
  }, [user, needsExtension, isExtensionReady]);

  const isLoggedIn = !!user?.pubkey && !!nip44;

  // ============================================
  // RELAY OPERATIONS
  // ============================================

  // Fetch budget from relays (checks both personal and shared budgets)
  const fetchFromRelays = useCallback(async (knownBudgetId?: string, knownPartners?: string[]): Promise<BudgetState | null> => {
    if (!user?.pubkey || !nip44) return null;

    try {
      const queries: Promise<import('@nostrify/nostrify').NostrEvent[]>[] = [];

      // Query 1: Personal budget (authored by us with our d-tag)
      queries.push(
        nostr.query([
          {
            kinds: [BUDGET_KIND],
            authors: [user.pubkey],
            '#d': [APP_IDENTIFIER],
            limit: 1,
          },
        ], { signal: AbortSignal.timeout(15000) })
      );

      // Query 2: Shared budgets where we're tagged as a collaborator
      queries.push(
        nostr.query([
          {
            kinds: [BUDGET_KIND],
            '#p': [user.pubkey],
            limit: 10,
          },
        ], { signal: AbortSignal.timeout(15000) })
      );

      // Query 3: If we know the budget ID, also look for our specific copy
      if (knownBudgetId) {
        const mySharedDTag = getSharedBudgetDTag(knownBudgetId, user.pubkey);
        queries.push(
          nostr.query([
            {
              kinds: [BUDGET_KIND],
              '#d': [mySharedDTag],
              limit: 5,
            },
          ], { signal: AbortSignal.timeout(15000) })
        );

        // Also query for copies written by partners
        if (knownPartners && knownPartners.length > 0) {
          for (const partnerPubkey of knownPartners) {
            if (partnerPubkey !== user.pubkey) {
              queries.push(
                nostr.query([
                  {
                    kinds: [BUDGET_KIND],
                    authors: [partnerPubkey],
                    '#p': [user.pubkey],
                    limit: 3,
                  },
                ], { signal: AbortSignal.timeout(15000) })
              );
            }
          }
        }
      }

      const results = await Promise.all(queries);
      const allEvents = results.flat();

      console.log('[BudgetStore] Fetched', allEvents.length, 'total budget events from relays');

      if (allEvents.length === 0) {
        return null;
      }

      // Deduplicate events by ID
      const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());

      // Try to decrypt each event and find the best one
      // Priority: highest version number among successfully decrypted budgets
      let bestBudget: BudgetState | null = null;
      let bestTimestamp = 0;
      let bestVersion = 0;

      for (const event of uniqueEvents) {
        try {
          // For personal budgets, decrypt with our own pubkey
          // For shared budgets, the author encrypted it to us, so decrypt with author's pubkey
          const decryptPubkey = event.pubkey === user.pubkey ? user.pubkey : event.pubkey;
          const decrypted = await nip44.decrypt(decryptPubkey, event.content);
          const budgetData: BudgetState = JSON.parse(decrypted);

          if (!budgetData || !Array.isArray(budgetData.budgets)) {
            continue;
          }

          // Ensure version is set
          if (!budgetData.version) {
            budgetData.version = 1;
          }

          // Ensure budgetId is set
          if (!budgetData.budgetId) {
            budgetData.budgetId = generateId();
          }

          const eventVersion = budgetData.version || 1;

          // Prefer higher version, then newer timestamp
          const isBetter = eventVersion > bestVersion ||
            (eventVersion === bestVersion && event.created_at > bestTimestamp);

          if (!bestBudget || isBetter) {
            bestBudget = budgetData;
            bestTimestamp = event.created_at;
            bestVersion = eventVersion;
          }
        } catch (e) {
          // Failed to decrypt this event - might not be for us, skip it
          console.debug('[BudgetStore] Could not decrypt event', event.id);
          continue;
        }
      }

      if (bestBudget) {
        // CRITICAL FIX: If marked as shared but no partners, reset to personal budget
        if (bestBudget.isShared && (!bestBudget.partnerPubkeys || bestBudget.partnerPubkeys.length === 0)) {
          console.warn('[BudgetStore] Budget marked as shared but has no partners - resetting to personal budget');
          bestBudget.isShared = false;
        }

        console.log('[BudgetStore] Successfully loaded budget from relays', {
          budgetCount: bestBudget.budgets.length,
          currentMonth: bestBudget.currentMonth,
          version: bestBudget.version,
          isShared: bestBudget.isShared,
          partners: bestBudget.partnerPubkeys?.length || 0,
          timestamp: bestTimestamp,
        });
        setLastSyncedAt(bestTimestamp);
      }

      return bestBudget;
    } catch (e) {
      console.error('[BudgetStore] Error fetching from relays:', e);
      return null;
    }
  }, [user?.pubkey, nip44, nostr]);

  // Fetch the latest version of a specific shared budget
  const fetchSharedBudget = useCallback(async (budgetId: string, collaboratorPubkeys: string[]): Promise<BudgetState | null> => {
    if (!user?.pubkey || !nip44) return null;

    try {
      // Query for all collaborator copies of this budget
      const dTags = collaboratorPubkeys.map(pk => getSharedBudgetDTag(budgetId, pk));

      const events = await nostr.query([
        {
          kinds: [BUDGET_KIND],
          '#d': dTags,
          limit: collaboratorPubkeys.length * 2,
        },
      ], { signal: AbortSignal.timeout(15000) });

      if (events.length === 0) return null;

      // Find the newest version we can decrypt
      let bestBudget: BudgetState | null = null;

      for (const event of events.sort((a, b) => b.created_at - a.created_at)) {
        try {
          const decryptPubkey = event.pubkey === user.pubkey ? user.pubkey : event.pubkey;
          const decrypted = await nip44.decrypt(decryptPubkey, event.content);
          const budget: BudgetState = JSON.parse(decrypted);

          if (budget && Array.isArray(budget.budgets)) {
            if (!bestBudget || (budget.version || 0) > (bestBudget.version || 0)) {
              bestBudget = budget;
            }
          }
        } catch {
          continue;
        }
      }

      return bestBudget;
    } catch {
      return null;
    }
  }, [user?.pubkey, nip44, nostr]);

  // Check for conflicts before saving (returns remote state if conflict exists)
  const checkForConflicts = useCallback(async (localState: BudgetState): Promise<BudgetState | null> => {
    if (!user?.pubkey || !nip44) return null;

    // Skip conflict check if we saved very recently (within 3 seconds)
    // This prevents race conditions with fast auto-save where our own
    // event might not have propagated to relays yet
    const timeSinceLastSave = Date.now() - lastSaveTimestampRef.current;
    if (timeSinceLastSave < 3000) {
      console.log('[BudgetStore] Skipping conflict check - saved recently', {
        timeSinceLastSave,
        threshold: 3000,
      });
      return null;
    }

    try {
      let remoteBudget: BudgetState | null = null;

      // For shared budgets, check all collaborator copies
      if (localState.isShared && localState.budgetId && localState.partnerPubkeys?.length) {
        console.log('[BudgetStore] Checking for conflicts on shared budget', {
          budgetId: localState.budgetId,
          localVersion: localState.version,
          partnerCount: localState.partnerPubkeys.length,
          partners: localState.partnerPubkeys.map(pk => pk.slice(0, 8)),
        });
        remoteBudget = await fetchSharedBudget(localState.budgetId, localState.partnerPubkeys);
      } else {
        // Personal budget - no conflict check needed for personal budgets
        // since only one user can edit them
        console.log('[BudgetStore] Skipping conflict check for personal budget');
        return null;
      }

      if (!remoteBudget) {
        console.log('[BudgetStore] No remote budget found for conflict check');
        return null;
      }

      const localVersion = localState.version || 1;
      const remoteVersion = remoteBudget.version || 1;
      const remoteEditedBy = remoteBudget.lastEditedBy || '';

      // Check if the remote version is from ourselves
      // If it is, this is not a conflict - it's just our own most recent save
      const isOwnEdit = remoteEditedBy === user.pubkey;

      console.log('[BudgetStore] Conflict check comparison', {
        localVersion,
        remoteVersion,
        remoteEditedBy: remoteEditedBy.slice(0, 8),
        isOwnEdit,
        wouldConflict: remoteVersion > localVersion,
      });

      // If remote is newer AND it's not our own edit, we have a conflict
      if (remoteVersion > localVersion && !isOwnEdit) {
        console.log('[BudgetStore] Conflict detected - partner made changes', { localVersion, remoteVersion });
        return remoteBudget;
      }

      // If remote is newer but it's our own edit, this means our local state
      // is out of sync with what we published. Update local to match.
      if (remoteVersion > localVersion && isOwnEdit) {
        console.log('[BudgetStore] Local version behind our own remote version - syncing', { localVersion, remoteVersion });
        // Don't treat this as a conflict, but the caller should handle syncing
        return null;
      }

      return null;
    } catch (e) {
      console.error('[BudgetStore] Error checking for conflicts:', e);
      return null;
    }
  }, [user?.pubkey, nip44, fetchSharedBudget]);

  // Save budget to relays (publishes to all collaborators if shared)
  const saveToRelays = useCallback(async (state: BudgetState, skipConflictCheck = false): Promise<boolean> => {
    if (!user?.pubkey || !nip44) {
      console.log('[BudgetStore] Cannot save - missing user or nip44');
      return false;
    }
    if (isSavingRef.current) {
      console.warn('[BudgetStore] Save already in progress, skipping');
      return false; // Prevent concurrent saves
    }

    isSavingRef.current = true;
    setSyncStatus('saving');

    try {
      // Check for conflicts first (unless skipped, e.g., when force-pushing)
      if (!skipConflictCheck && state.isShared) {
        const conflictingBudget = await checkForConflicts(state);
        if (conflictingBudget) {
          setConflictInfo({
            localVersion: state.version || 1,
            remoteVersion: conflictingBudget.version || 1,
            remoteEditedBy: conflictingBudget.lastEditedBy || '',
            remoteEditedAt: conflictingBudget.lastEditedAt || 0,
            remoteBudget: conflictingBudget,
          });
          setSyncStatus('conflict');
          isSavingRef.current = false;
          return false;
        }
      }

      // Increment version and set edit info
      const updatedState: BudgetState = {
        ...state,
        version: (state.version || 0) + 1,
        lastEditedBy: user.pubkey,
        lastEditedAt: Math.floor(Date.now() / 1000),
        budgetId: state.budgetId || generateId(),
        ownerPubkey: state.ownerPubkey || user.pubkey,
      };

      const plaintext = JSON.stringify(updatedState);

      console.log('[BudgetStore] About to publish to relays, isShared:', updatedState.isShared);

      // If shared, publish encrypted copies to ALL collaborators (gift-wrap pattern)
      if (updatedState.isShared && updatedState.partnerPubkeys && updatedState.partnerPubkeys.length > 0) {
        console.log('[BudgetStore] Publishing shared budget to', updatedState.partnerPubkeys.length, 'collaborators');

        // Publish a copy for each collaborator
        for (const collaboratorPubkey of updatedState.partnerPubkeys) {
          try {
            const encryptedForCollaborator = await nip44.encrypt(collaboratorPubkey, plaintext);

            // Build tags - include all collaborators as 'p' tags for discoverability
            const tags: string[][] = [
              ['d', getSharedBudgetDTag(updatedState.budgetId!, collaboratorPubkey)],
              ['alt', 'Sat Sorter shared budget data (encrypted)'],
            ];

            // Add all collaborators as p tags
            for (const pk of updatedState.partnerPubkeys) {
              tags.push(['p', pk]);
            }

            await publish({
              kind: BUDGET_KIND,
              content: encryptedForCollaborator,
              tags,
            });

            console.log('[BudgetStore] Published shared budget copy for', collaboratorPubkey.slice(0, 8) + '...');
          } catch (e) {
            console.error('[BudgetStore] Failed to publish to collaborator', collaboratorPubkey.slice(0, 8), e);
            // Continue with other collaborators even if one fails
          }
        }
      } else {
        // Personal budget - just encrypt to self
        console.log('[BudgetStore] Publishing personal budget...');
        const encrypted = await nip44.encrypt(user.pubkey, plaintext);

        await publish({
          kind: BUDGET_KIND,
          content: encrypted,
          tags: [
            ['d', APP_IDENTIFIER],
            ['alt', 'Sat Sorter budget data (encrypted)'],
          ],
        });
        console.log('[BudgetStore] Personal budget published');
      }

      const now = Math.floor(Date.now() / 1000);
      setLastSyncedAt(now);

      console.log('[BudgetStore] Saved to relays successfully', { version: updatedState.version });

      // Track that we successfully saved this state (data only, no version)
      // The auto-save comparison uses getComparableState which excludes version
      lastSavedStateRef.current = getComparableState(updatedState);

      // Track when we last saved successfully - used to skip conflict checks
      lastSaveTimestampRef.current = Date.now();

      setSyncStatus('synced');

      // Reset to idle after a moment
      setTimeout(() => setSyncStatus('idle'), 2000);

      return true;
    } catch {
      // Save failed - likely relay connectivity issue
      // Status indicator will show error state for user feedback
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [user?.pubkey, nip44, publish]);

  // ============================================
  // INITIAL LOAD
  // ============================================

  // Load from relays on startup when logged in
  useEffect(() => {
    if (!isLoggedIn || isInitialLoadComplete) return;

    const loadInitial = async () => {
      setSyncStatus('loading');
      console.log('[BudgetStore] Loading budget from relays...');

      // Pass known budget ID and partners if available from local cache
      const relayData = await fetchFromRelays(
        localState.budgetId,
        localState.partnerPubkeys
      );

      if (relayData) {
        // Relay has data - use it and update local cache
        console.log('[BudgetStore] Using relay data as source of truth', {
          relayVersion: relayData.version,
          localCacheVersion: localState.version,
          isShared: relayData.isShared,
        });

        // IMPORTANT: Merge any local NWC transactions that aren't in the relay data
        // This prevents losing transactions that were just imported but not yet saved
        const mergedData = mergeNWCTransactions(localState, relayData);

        setLocalState(mergedData);
        lastSavedStateRef.current = getComparableState(mergedData);
      } else {
        // No relay data - check if we have local data to upload
        const localWeight = localState.budgets.reduce((sum, b) =>
          sum + b.transactions.length + b.buckets.reduce((bs, bucket) =>
            bs + bucket.lineItems.filter(li => li.plannedAmount > 0).length, 0), 0);

        if (localWeight > 0) {
          // Upload existing local data to relays
          console.log('[BudgetStore] No relay data found, uploading local data...');
          await saveToRelays(localState);
        } else {
          console.log('[BudgetStore] No data anywhere, starting fresh');
        }
        lastSavedStateRef.current = getComparableState(localState);
      }

      setIsInitialLoadComplete(true);
      setSyncStatus('idle');
    };

    loadInitial();
  }, [isLoggedIn, isInitialLoadComplete, fetchFromRelays, localState, setLocalState, saveToRelays]);

  // Mark initial load complete for logged-out users
  useEffect(() => {
    if (!isLoggedIn && !isInitialLoadComplete) {
      setIsInitialLoadComplete(true);
      lastSavedStateRef.current = getComparableState(localState);
    }
  }, [isLoggedIn, isInitialLoadComplete, localState]);

  // ============================================
  // AUTO-SAVE ON CHANGES (when logged in)
  // ============================================

  // Debounced auto-save when state changes
  // Transaction updates get a shorter debounce (500ms) to ensure they're saved quickly
  useEffect(() => {
    if (!isLoggedIn || !isInitialLoadComplete) return;

    // Don't auto-save during invitation acceptance - wait for explicit action
    if (isAcceptingInviteRef.current) {
      console.log('[BudgetStore] Skipping auto-save during invitation acceptance');
      return;
    }

    // Compare states WITHOUT version/metadata to detect actual data changes
    // This prevents infinite save loops when version is incremented after each save
    const currentDataStr = getComparableState(localState);
    const lastSavedDataStr = lastSavedStateRef.current;

    // Skip if nothing changed (comparing data only, not version)
    if (currentDataStr === lastSavedDataStr) {
      setHasUnsavedLocalChanges(false);
      transactionUpdatedRef.current = false; // Clear the flag
      return;
    }

    // Track that we have unsaved changes
    setHasUnsavedLocalChanges(true);

    // If we're offline and this is a shared budget, track that we made offline changes
    if (!isOnline && localState.isShared) {
      setOfflineChangesMade(true);
      console.log('[BudgetStore] Offline change detected on shared budget - will need sync when online');
      // Don't auto-save when offline with shared budget - wait for user action
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Use shorter debounce for transaction updates, longer for other changes
    const debounceMs = transactionUpdatedRef.current ? 500 : AUTO_SAVE_DEBOUNCE_MS;

    console.log('[BudgetStore] Scheduling auto-save in', debounceMs, 'ms', transactionUpdatedRef.current ? '(transaction update)' : '');

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      // CRITICAL: Use the ref to get the CURRENT state at save time,
      // not the stale state from when the timeout was created.
      // This ensures we always save the latest data.
      const stateToSave = localStateRef.current;
      console.log('[BudgetStore] Auto-saving changes to relays...', {
        version: stateToSave.version,
        budgetCount: stateToSave.budgets.length,
      });
      const success = await saveToRelays(stateToSave);
      if (success) {
        setHasUnsavedLocalChanges(false);
        setOfflineChangesMade(false);
      }
      transactionUpdatedRef.current = false; // Clear the flag after save
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localState, isLoggedIn, isInitialLoadComplete, isOnline, saveToRelays]);

  // ============================================
  // REAL-TIME SUBSCRIPTION FOR SHARED BUDGETS
  // ============================================

  // Subscribe to updates from partners when we have a shared budget
  useEffect(() => {
    if (!isLoggedIn || !isInitialLoadComplete || !nip44) return;
    if (!localState.isShared || !localState.budgetId || !localState.partnerPubkeys?.length) return;

    // Don't subscribe if we're currently saving (to avoid processing our own events)
    if (isSavingRef.current) return;

    // Get partner pubkeys (excluding ourselves)
    const partnerAuthors = localState.partnerPubkeys.filter(pk => pk !== user!.pubkey);

    if (partnerAuthors.length === 0) return;

    console.log('[BudgetStore] Setting up real-time subscription for shared budget updates');

    const abortController = new AbortController();

    // Subscribe to updates from partners
    const subscribe = async () => {
      try {
        // Use req() for subscription - it returns an async iterator
        const sub = nostr.req([
          {
            kinds: [BUDGET_KIND],
            authors: partnerAuthors,
            '#p': [user!.pubkey],
            since: Math.floor(Date.now() / 1000) - 60, // Start from 1 minute ago
          },
        ], { signal: abortController.signal });

        for await (const msg of sub) {
          if (msg[0] === 'EVENT') {
            const event = msg[2];

            // Skip if we're currently saving
            if (isSavingRef.current) continue;

            try {
              // Decrypt the event
              const decrypted = await nip44!.decrypt(event.pubkey, event.content);
              const remoteBudget: BudgetState = JSON.parse(decrypted);

              if (!remoteBudget || !Array.isArray(remoteBudget.budgets)) continue;

              const remoteVersion = remoteBudget.version || 1;
              // Use ref to get the CURRENT local state, not the stale closure value
              const currentLocalState = localStateRef.current;
              const localVersion = currentLocalState.version || 1;

              // Only process if this is actually newer
              if (remoteVersion > localVersion) {
                console.log('[BudgetStore] Received budget update from partner', {
                  from: event.pubkey.slice(0, 8),
                  remoteVersion,
                  localVersion,
                });

                // Check if we have unsaved local changes using the CURRENT state
                // Compare data only (excluding version) to detect actual edits
                const currentDataStr = getComparableState(currentLocalState);
                const hasLocalChanges = currentDataStr !== lastSavedStateRef.current;

                if (hasLocalChanges) {
                  // We have local changes AND remote is newer - conflict!
                  console.log('[BudgetStore] Conflict detected - local changes exist');
                  setConflictInfo({
                    localVersion,
                    remoteVersion,
                    remoteEditedBy: remoteBudget.lastEditedBy || event.pubkey,
                    remoteEditedAt: remoteBudget.lastEditedAt || event.created_at,
                    remoteBudget,
                  });
                  setSyncStatus('conflict');
                } else {
                  // No local changes - safe to update
                  setLocalState(remoteBudget);
                  lastSavedStateRef.current = getComparableState(remoteBudget);
                  setLastSyncedAt(event.created_at);

                  // Show notification about partner update
                  setPartnerUpdateNotification(event.pubkey);
                  setTimeout(() => setPartnerUpdateNotification(null), 5000);

                  // Show brief "synced" status
                  setSyncStatus('synced');
                  setTimeout(() => setSyncStatus('idle'), 2000);

                  console.log('[BudgetStore] Applied budget update from partner');
                }
              }
            } catch (e) {
              // Failed to decrypt - might not be for us
              console.debug('[BudgetStore] Could not process subscription event', e);
            }
          } else if (msg[0] === 'EOSE') {
            console.log('[BudgetStore] Real-time subscription caught up');
          }
        }
      } catch (e) {
        // Subscription closed or error
        if (!abortController.signal.aborted) {
          console.error('[BudgetStore] Subscription error:', e);
        }
      }
    };

    subscribe();

    return () => {
      console.log('[BudgetStore] Cleaning up real-time subscription');
      abortController.abort();
    };
  }, [
    isLoggedIn,
    isInitialLoadComplete,
    nip44,
    nostr,
    user?.pubkey,
    localState.isShared,
    localState.budgetId,
    localState.partnerPubkeys?.join(','), // Use join to create stable dependency
    localState.version,
    setLocalState,
  ]);

  // ============================================
  // STATE MANAGEMENT (same API as useBudget)
  // ============================================

  const state = localState;
  const setState = setLocalState;

  // Get or create budget for current month
  const currentBudget = useMemo((): MonthlyBudget => {
    const existing = state.budgets.find(b => b.month === state.currentMonth);
    if (existing) return existing;

    return {
      id: generateId(),
      month: state.currentMonth,
      buckets: createDefaultBuckets(),
      transactions: [],
    };
  }, [state.budgets, state.currentMonth]);

  // Save current budget
  const saveBudget = useCallback((budget: MonthlyBudget) => {
    setState(prev => {
      const existingIndex = prev.budgets.findIndex(b => b.month === budget.month);
      const newBudgets = [...prev.budgets];

      if (existingIndex >= 0) {
        newBudgets[existingIndex] = budget;
      } else {
        newBudgets.push(budget);
      }

      return { ...prev, budgets: newBudgets };
    });
  }, [setState]);

  // Set current month
  const setCurrentMonth = useCallback((month: string) => {
    setState(prev => ({ ...prev, currentMonth: month }));
  }, [setState]);

  // Toggle currency
  const toggleCurrency = useCallback(() => {
    setState(prev => ({
      ...prev,
      currency: prev.currency === 'sats' ? 'usd' : 'sats',
    }));
  }, [setState]);

  // Add a new bucket
  const addBucket = useCallback((name: string, color: string, icon: string) => {
    const newBucket: Bucket = {
      id: generateId(),
      name,
      color,
      icon,
      isIncome: false,
      order: currentBudget.buckets.filter(b => !b.isIncome).length,
      lineItems: [],
    };

    const updatedBudget = {
      ...currentBudget,
      buckets: [...currentBudget.buckets, newBucket],
    };

    saveBudget(updatedBudget);
    return newBucket;
  }, [currentBudget, saveBudget]);

  // Update a bucket
  const updateBucket = useCallback((bucketId: string, updates: Partial<Bucket>) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId ? { ...b, ...updates } : b
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a bucket (except income)
  const deleteBucket = useCallback((bucketId: string) => {
    const bucket = currentBudget.buckets.find(b => b.id === bucketId);
    if (bucket?.isIncome) return;

    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.filter(b => b.id !== bucketId),
      transactions: currentBudget.transactions.map(t =>
        t.bucketId === bucketId ? { ...t, bucketId: null, lineItemId: null } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Add a line item to a bucket
  const addLineItem = useCallback((bucketId: string, name: string) => {
    const bucket = currentBudget.buckets.find(b => b.id === bucketId);
    if (!bucket) return;

    const newLineItem: LineItem = {
      id: generateId(),
      name,
      plannedAmount: 0,
      order: bucket.lineItems.length,
    };

    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? { ...b, lineItems: [...b.lineItems, newLineItem] }
          : b
      ),
    };

    saveBudget(updatedBudget);
    return newLineItem;
  }, [currentBudget, saveBudget]);

  // Update a line item
  const updateLineItem = useCallback((
    bucketId: string,
    lineItemId: string,
    updates: Partial<LineItem>
  ) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? {
              ...b,
              lineItems: b.lineItems.map(item =>
                item.id === lineItemId ? { ...item, ...updates } : item
              ),
            }
          : b
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a line item
  const deleteLineItem = useCallback((bucketId: string, lineItemId: string) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? { ...b, lineItems: b.lineItems.filter(item => item.id !== lineItemId) }
          : b
      ),
      transactions: currentBudget.transactions.map(t =>
        t.lineItemId === lineItemId ? { ...t, lineItemId: null, bucketId: null } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Add a transaction
  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId(),
    };

    const txDate = new Date(transaction.date);
    const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

    if (txMonth === state.currentMonth) {
      const updatedBudget = {
        ...currentBudget,
        transactions: [...currentBudget.transactions, newTransaction],
      };
      saveBudget(updatedBudget);
    } else {
      setState(prev => {
        const existingBudgetIndex = prev.budgets.findIndex(b => b.month === txMonth);

        if (existingBudgetIndex >= 0) {
          const newBudgets = [...prev.budgets];
          const targetBudget = newBudgets[existingBudgetIndex];
          newBudgets[existingBudgetIndex] = {
            ...targetBudget,
            transactions: [...targetBudget.transactions, newTransaction],
          };
          return { ...prev, budgets: newBudgets };
        } else {
          const newBudget: MonthlyBudget = {
            id: generateId(),
            month: txMonth,
            buckets: createDefaultBuckets(),
            transactions: [newTransaction],
          };
          return { ...prev, budgets: [...prev.budgets, newBudget] };
        }
      });
    }

    return newTransaction;
  }, [currentBudget, state.currentMonth, saveBudget, setState]);

  // Update a transaction (searches across all months)
  // IMPORTANT: This uses immediate state update to ensure changes are persisted
  // before the user can navigate away or close the app
  const updateTransaction = useCallback((
    transactionId: string,
    updates: Partial<Transaction>
  ) => {
    console.log('[BudgetStore] Updating transaction:', transactionId, updates);

    // Mark that a transaction was just updated - this will trigger an immediate save
    transactionUpdatedRef.current = true;

    // Get the latest state to avoid race conditions
    const updateState = (prevState: BudgetState): BudgetState => {
      let found = false;
      let updatedTransaction: Transaction | null = null;

      const newBudgets = prevState.budgets.map(budget => {
        const hasTransaction = budget.transactions.some(t => t.id === transactionId);
        if (hasTransaction) {
          found = true;
          return {
            ...budget,
            transactions: budget.transactions.map(t => {
              if (t.id === transactionId) {
                updatedTransaction = { ...t, ...updates };
                return updatedTransaction;
              }
              return t;
            }),
          };
        }
        return budget;
      });

      if (!found) {
        console.warn('[BudgetStore] Transaction not found for update:', transactionId);
        return prevState;
      }

      console.log('[BudgetStore] Transaction updated successfully:', {
        transactionId,
        newLineItemId: updatedTransaction?.lineItemId,
        newBucketId: updatedTransaction?.bucketId,
        description: updatedTransaction?.description,
      });

      return { ...prevState, budgets: newBudgets };
    };

    // Update state immediately to ensure it persists
    setState(updateState);
  }, [setState]);

  // Delete a transaction (searches across all months)
  // IMPORTANT: This uses immediate state update to ensure changes are persisted
  const deleteTransaction = useCallback((transactionId: string) => {
    console.log('[BudgetStore] Deleting transaction:', transactionId);

    // Mark that a transaction was just updated - this will trigger an immediate save
    transactionUpdatedRef.current = true;

    const updateState = (prevState: BudgetState): BudgetState => {
      let found = false;
      const newBudgets = prevState.budgets.map(budget => {
        const hasTransaction = budget.transactions.some(t => t.id === transactionId);
        if (hasTransaction) {
          found = true;
          return {
            ...budget,
            transactions: budget.transactions.filter(t => t.id !== transactionId),
          };
        }
        return budget;
      });

      if (!found) {
        console.warn('[BudgetStore] Transaction not found for delete:', transactionId);
        return prevState;
      }

      return { ...prevState, budgets: newBudgets };
    };

    // Update state immediately to ensure it persists
    setState(updateState);
  }, [setState]);

  // Assign transaction to a line item
  const assignTransaction = useCallback((
    transactionId: string,
    bucketId: string,
    lineItemId: string
  ) => {
    console.log('[BudgetStore] assignTransaction called:', { transactionId, bucketId, lineItemId });

    // Find the transaction first to see its current state
    const currentTx = state.budgets
      .flatMap(b => b.transactions)
      .find(t => t.id === transactionId);

    console.log('[BudgetStore] Current transaction state before update:', {
      transactionId,
      currentLineItemId: currentTx?.lineItemId,
      currentBucketId: currentTx?.bucketId,
      description: currentTx?.description,
      amount: currentTx?.amount,
    });

    updateTransaction(transactionId, { bucketId, lineItemId });
  }, [updateTransaction, state]);

  // Split a transaction into multiple allocations
  const splitTransaction = useCallback((
    originalTransactionId: string,
    splits: SplitAllocation[]
  ) => {
    const originalTx = currentBudget.transactions.find(t => t.id === originalTransactionId);
    if (!originalTx || splits.length < 2) return;

    // Mark the original transaction as a split parent
    const updatedOriginal: Transaction = {
      ...originalTx,
      isSplitParent: true,
      // Clear assignment since splits handle the categorization
      bucketId: null,
      lineItemId: null,
    };

    // Create child transactions for each split
    const splitTransactions: Transaction[] = splits.map((split, index) => ({
      id: generateId(),
      amount: split.amount,
      usdAmount: split.usdAmount,
      usdPerBtcAtEntry: originalTx.usdPerBtcAtEntry,
      description: split.description
        ? `${originalTx.description} - ${split.description}`
        : `${originalTx.description} (Split ${index + 1}/${splits.length})`,
      date: originalTx.date,
      lineItemId: split.lineItemId,
      bucketId: split.bucketId,
      paymentHash: originalTx.paymentHash,
      preimage: originalTx.preimage,
      isIncome: originalTx.isIncome,
      source: originalTx.source,
      sourceWallet: originalTx.sourceWallet,
      sourceWalletId: originalTx.sourceWalletId,
      merchantName: originalTx.merchantName,
      categoryHint: originalTx.categoryHint,
      parentTransactionId: originalTransactionId,
    }));

    const updatedBudget = {
      ...currentBudget,
      transactions: [
        ...currentBudget.transactions.filter(t => t.id !== originalTransactionId),
        updatedOriginal,
        ...splitTransactions,
      ],
    };

    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Get available months
  const availableMonths = useMemo(() => {
    const months = new Set(state.budgets.map(b => b.month));
    months.add(state.currentMonth);
    return Array.from(months).sort().reverse();
  }, [state.budgets, state.currentMonth]);

  // Duplicate budget from a previous month
  const duplicateFromMonth = useCallback((sourceMonth: string) => {
    const sourceBudget = state.budgets.find(b => b.month === sourceMonth);
    if (!sourceBudget) return false;

    const newBuckets = sourceBudget.buckets.map(bucket => ({
      ...bucket,
      id: generateId(),
      lineItems: bucket.lineItems.map(item => ({
        ...item,
        id: generateId(),
      })),
    }));

    const newBudget: MonthlyBudget = {
      id: generateId(),
      month: state.currentMonth,
      buckets: newBuckets,
      transactions: [],
    };

    saveBudget(newBudget);
    return true;
  }, [state.budgets, state.currentMonth, saveBudget]);

  // Get the previous month string
  const getPreviousMonth = useCallback(() => {
    const [year, month] = state.currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [state.currentMonth]);

  // Check if previous month has a budget
  const hasPreviousMonthBudget = useMemo(() => {
    const prevMonth = getPreviousMonth();
    return state.budgets.some(b => b.month === prevMonth);
  }, [state.budgets, getPreviousMonth]);

  // Get the full budget state
  const getFullBudgetState = useCallback((): BudgetState => {
    const existingIndex = state.budgets.findIndex(b => b.month === state.currentMonth);
    let budgets: MonthlyBudget[];

    if (existingIndex < 0) {
      budgets = [...state.budgets, currentBudget];
    } else {
      budgets = [...state.budgets];
      budgets[existingIndex] = currentBudget;
    }

    return { ...state, budgets };
  }, [state, currentBudget]);

  // Manual refresh from relays
  const refreshFromRelays = useCallback(async () => {
    if (!isLoggedIn) return false;

    setSyncStatus('loading');

    // Pass known budget ID and partners for better shared budget discovery
    const relayData = await fetchFromRelays(
      state.budgetId,
      state.partnerPubkeys
    );

    if (relayData) {
      setLocalState(relayData);
      lastSavedStateRef.current = getComparableState(relayData);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } else {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      return false;
    }
  }, [isLoggedIn, fetchFromRelays, setLocalState, state.budgetId, state.partnerPubkeys]);

  // Force save to relays (manual trigger)
  const forceSaveToRelays = useCallback(async () => {
    if (!isLoggedIn) return false;
    return saveToRelays(getFullBudgetState());
  }, [isLoggedIn, saveToRelays, getFullBudgetState]);

  // Import/replace entire budget state (used by backup restore)
  // Also saves the restored state to relays when logged in
  const importBudgetState = useCallback(async (newState: BudgetState): Promise<void> => {
    setLocalState(newState);
    lastSavedStateRef.current = getComparableState(newState);
    if (isLoggedIn) {
      await saveToRelays(newState, true); // skip conflict check - user is explicitly restoring
    }
  }, [setLocalState, isLoggedIn, saveToRelays]);

  // Conflict resolution: Use remote version (discard local changes)
  const resolveConflictUseRemote = useCallback(() => {
    if (!conflictInfo) return;

    setLocalState(conflictInfo.remoteBudget);
    lastSavedStateRef.current = getComparableState(conflictInfo.remoteBudget);
    setConflictInfo(null);
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 2000);
  }, [conflictInfo, setLocalState]);

  // Conflict resolution: Keep local version (overwrite remote)
  const resolveConflictKeepLocal = useCallback(async () => {
    if (!conflictInfo) return false;

    setConflictInfo(null);
    // Force save with incremented version beyond remote
    const stateToSave = {
      ...getFullBudgetState(),
      version: conflictInfo.remoteVersion + 1,
    };
    return saveToRelays(stateToSave, true); // Skip conflict check
  }, [conflictInfo, getFullBudgetState, saveToRelays]);

  // Conflict resolution: Merge both versions
  const resolveConflictMergeBoth = useCallback(async (mergedState: BudgetState) => {
    if (!conflictInfo) return false;

    setConflictInfo(null);
    setLocalState(mergedState);
    lastSavedStateRef.current = getComparableState(mergedState);

    // Save merged state to relays
    return saveToRelays(mergedState, true); // Skip conflict check since we're resolving
  }, [conflictInfo, setLocalState, saveToRelays]);

  // Dismiss conflict without action (user wants to review manually)
  const dismissConflict = useCallback(() => {
    setConflictInfo(null);
    setSyncStatus('idle');
  }, []);

  // Check if budget is shared
  const isSharedBudget = useMemo(() => {
    return state.isShared && (state.partnerPubkeys?.length || 0) > 0;
  }, [state.isShared, state.partnerPubkeys]);

  // ============================================
  // INVITATION SYSTEM (Phase 2)
  // ============================================

  // Track dismissed invitation IDs in localStorage to prevent them from reappearing
  const getDismissedInvitationIds = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem('sat-sorter-dismissed-invitations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const addDismissedInvitationId = useCallback((invitationId: string) => {
    try {
      const current = getDismissedInvitationIds();
      if (!current.includes(invitationId)) {
        // Keep only the last 50 dismissed IDs to prevent unbounded growth
        const updated = [...current, invitationId].slice(-50);
        localStorage.setItem('sat-sorter-dismissed-invitations', JSON.stringify(updated));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [getDismissedInvitationIds]);

  // Fetch pending invitations for current user
  const fetchPendingInvitations = useCallback(async () => {
    if (!user?.pubkey || !nip44) return;

    try {
      const events = await nostr.query([
        {
          kinds: [INVITE_KIND],
          '#p': [user.pubkey],
          limit: 10,
        },
      ], { signal: AbortSignal.timeout(10000) });

      const dismissedIds = getDismissedInvitationIds();
      const invitations: PendingInvitation[] = [];

      for (const event of events) {
        // Skip already dismissed invitations
        if (dismissedIds.includes(event.id)) {
          continue;
        }

        try {
          const decrypted = await nip44.decrypt(event.pubkey, event.content);
          const invitation: BudgetInvitation = JSON.parse(decrypted);

          if (invitation.type === 'budget-invite') {
            // Skip if we're already a partner in this budget (invitation was accepted)
            if (state.budgetId === invitation.budgetId && state.partnerPubkeys?.includes(user.pubkey)) {
              // Auto-dismiss this invitation since we're already part of the budget
              addDismissedInvitationId(event.id);
              continue;
            }

            invitations.push({
              id: event.id,
              invitation,
              fromPubkey: event.pubkey,
              receivedAt: event.created_at,
            });
          }
        } catch {
          // Skip invalid invitations
        }
      }

      setPendingInvitations(invitations);
      console.log('[BudgetStore] Found', invitations.length, 'pending invitations');
    } catch {
      console.error('[BudgetStore] Failed to fetch invitations');
    }
  }, [user?.pubkey, nip44, nostr, state.budgetId, state.partnerPubkeys, getDismissedInvitationIds, addDismissedInvitationId]);

  // Send invitation to a partner and share the budget with them
  const invitePartner = useCallback(async (npubOrNip05: string): Promise<boolean> => {
    if (!user?.pubkey || !nip44) return false;

    try {
      // Parse the npub or resolve NIP-05
      let partnerPubkey: string;

      if (npubOrNip05.startsWith('npub1')) {
        const decoded = nip19.decode(npubOrNip05);
        if (decoded.type !== 'npub') throw new Error('Invalid npub');
        partnerPubkey = decoded.data;
      } else {
        // TODO: Resolve NIP-05 address
        // For now, just reject non-npub addresses
        throw new Error('Please use an npub address for now');
      }

      // Prevent inviting yourself
      if (partnerPubkey === user.pubkey) {
        throw new Error("You can't invite yourself");
      }

      const budgetId = state.budgetId || generateId();
      const budgetName = `Budget - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

      // Create invitation event
      const invitation: BudgetInvitation = {
        type: 'budget-invite',
        budgetId,
        budgetName,
        ownerPubkey: user.pubkey,
        createdAt: Math.floor(Date.now() / 1000),
      };

      // Encrypt and publish invitation
      const encryptedInvite = await nip44.encrypt(partnerPubkey, JSON.stringify(invitation));

      await publish({
        kind: INVITE_KIND,
        content: encryptedInvite,
        tags: [
          ['p', partnerPubkey],
          ['d', `budget-invite-${budgetId}`],
          ['alt', 'Sat Sorter budget invitation (encrypted)'],
        ],
      });

      console.log('[BudgetStore] Invitation sent to', partnerPubkey.slice(0, 8) + '...');

      // Update local state to mark as shared and add partner
      const newPartnerPubkeys = [...(state.partnerPubkeys || []), user.pubkey, partnerPubkey]
        .filter((v, i, a) => a.indexOf(v) === i);

      const updatedState: BudgetState = {
        ...state,
        budgetId,
        isShared: true,
        ownerPubkey: user.pubkey,
        partnerPubkeys: newPartnerPubkeys,
        version: (state.version || 0) + 1,
        lastEditedBy: user.pubkey,
        lastEditedAt: Math.floor(Date.now() / 1000),
      };

      // CRITICAL: Immediately publish the budget encrypted to the new partner
      // This is the "gift-wrap" pattern - they get their own encrypted copy
      const plaintext = JSON.stringify(updatedState);

      for (const collaboratorPubkey of newPartnerPubkeys) {
        try {
          const encryptedBudget = await nip44.encrypt(collaboratorPubkey, plaintext);

          const tags: string[][] = [
            ['d', getSharedBudgetDTag(budgetId, collaboratorPubkey)],
            ['alt', 'Sat Sorter shared budget data (encrypted)'],
          ];

          // Add all collaborators as p tags for discoverability
          for (const pk of newPartnerPubkeys) {
            tags.push(['p', pk]);
          }

          await publish({
            kind: BUDGET_KIND,
            content: encryptedBudget,
            tags,
          });

          console.log('[BudgetStore] Published shared budget to', collaboratorPubkey.slice(0, 8) + '...');
        } catch (e) {
          console.error('[BudgetStore] Failed to publish budget to', collaboratorPubkey.slice(0, 8), e);
        }
      }

      // Update local state
      setLocalState(updatedState);
      lastSavedStateRef.current = getComparableState(updatedState);

      // Track the sent invitation locally
      setSentInvitations(prev => [...prev, {
        id: `${budgetId}-${partnerPubkey}`, // Local tracking ID
        toPubkey: partnerPubkey,
        budgetId,
        budgetName,
        sentAt: Math.floor(Date.now() / 1000),
      }]);

      console.log('[BudgetStore] Budget shared with partner successfully');
      return true;
    } catch (error) {
      console.error('[BudgetStore] Failed to send invitation:', error);
      return false;
    }
  }, [user?.pubkey, nip44, state, publish, setLocalState]);

  // Fetch sent invitations (invitations we've sent to others)
  const fetchSentInvitations = useCallback(async () => {
    if (!user?.pubkey || !nip44 || !state.budgetId) return;

    try {
      // Query for invitation events we authored
      const events = await nostr.query([
        {
          kinds: [INVITE_KIND],
          authors: [user.pubkey],
          '#d': [`budget-invite-${state.budgetId}`],
          limit: 20,
        },
      ], { signal: AbortSignal.timeout(10000) });

      const invitations: SentInvitation[] = [];

      for (const event of events) {
        try {
          // Get the recipient from p tag
          const pTag = event.tags.find(t => t[0] === 'p');
          if (!pTag) continue;

          const recipientPubkey = pTag[1];
          const decrypted = await nip44.decrypt(recipientPubkey, event.content);
          const invitation: BudgetInvitation = JSON.parse(decrypted);

          if (invitation.type === 'budget-invite') {
            // Check if this person is already a partner (invite was accepted)
            const isAlreadyPartner = state.partnerPubkeys?.includes(recipientPubkey);
            if (!isAlreadyPartner) {
              invitations.push({
                id: event.id,
                toPubkey: recipientPubkey,
                budgetId: invitation.budgetId,
                budgetName: invitation.budgetName,
                sentAt: event.created_at,
              });
            }
          }
        } catch {
          // Skip invalid invitations
        }
      }

      setSentInvitations(invitations);
      console.log('[BudgetStore] Found', invitations.length, 'sent (pending) invitations');
    } catch {
      console.error('[BudgetStore] Failed to fetch sent invitations');
    }
  }, [user?.pubkey, nip44, nostr, state.budgetId, state.partnerPubkeys]);

  // Cancel a sent invitation (publish a deletion event)
  const cancelInvitation = useCallback(async (sentInvitation: SentInvitation): Promise<boolean> => {
    if (!user?.pubkey) return false;

    try {
      // Publish a delete event for the invitation
      // Note: This only works if the relay supports NIP-09 deletion
      await publish({
        kind: 5, // NIP-09 deletion
        content: 'Invitation cancelled',
        tags: [
          ['e', sentInvitation.id],
          ['k', String(INVITE_KIND)],
        ],
      });

      // Remove the partner from our local list (they haven't accepted yet)
      const newPartnerPubkeys = (state.partnerPubkeys || [])
        .filter(pk => pk !== sentInvitation.toPubkey);

      // If only owner remains, it's no longer shared
      const isStillShared = newPartnerPubkeys.length > 1;

      if (newPartnerPubkeys.length !== state.partnerPubkeys?.length) {
        const updatedState: BudgetState = {
          ...state,
          partnerPubkeys: newPartnerPubkeys,
          isShared: isStillShared,
        };
        setLocalState(updatedState);
      }

      // Remove from sent invitations list
      setSentInvitations(prev => prev.filter(inv => inv.id !== sentInvitation.id));

      console.log('[BudgetStore] Cancelled invitation to', sentInvitation.toPubkey.slice(0, 8) + '...');
      return true;
    } catch (error) {
      console.error('[BudgetStore] Failed to cancel invitation:', error);
      return false;
    }
  }, [user?.pubkey, state, publish, setLocalState]);

  // Accept an invitation and fetch the shared budget
  // CRITICAL: This should ONLY pull data, never push the partner's local state
  const acceptInvitation = useCallback(async (invitation: PendingInvitation): Promise<boolean> => {
    if (!user?.pubkey || !nip44) return false;

    // Set flag to prevent auto-save during this process
    isAcceptingInviteRef.current = true;

    try {
      const { budgetId, ownerPubkey } = invitation.invitation;

      console.log('[BudgetStore] Accepting invitation for budget', budgetId, 'from', ownerPubkey.slice(0, 8) + '...');

      // Fetch the shared budget that was encrypted to us
      // The owner should have published a copy with our pubkey in the d-tag
      const sharedBudgetDTag = getSharedBudgetDTag(budgetId, user.pubkey);

      const events = await nostr.query([
        {
          kinds: [BUDGET_KIND],
          authors: [ownerPubkey],
          '#d': [sharedBudgetDTag],
          limit: 1,
        },
      ], { signal: AbortSignal.timeout(15000) });

      console.log('[BudgetStore] Found', events.length, 'shared budget events');

      if (events.length === 0) {
        // Budget not found - maybe owner hasn't published it yet, or relay issues
        // IMPORTANT: Don't save anything - just mark locally and wait for manual refresh
        console.warn('[BudgetStore] Shared budget not found on relays, will sync on next refresh');

        const fallbackState: BudgetState = {
          ...localState,
          budgetId,
          isShared: true,
          ownerPubkey,
          partnerPubkeys: [ownerPubkey, user.pubkey],
        };

        setLocalState(fallbackState);
        // CRITICAL: Set lastSavedStateRef to prevent auto-save from pushing empty budget
        lastSavedStateRef.current = getComparableState(fallbackState);

        // Persist dismissal so it doesn't reappear after refresh
        addDismissedInvitationId(invitation.id);
        setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
        return true;
      }

      // Decrypt the shared budget
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        const decrypted = await nip44.decrypt(ownerPubkey, latestEvent.content);
        const sharedBudget: BudgetState = JSON.parse(decrypted);

        if (!sharedBudget || !Array.isArray(sharedBudget.budgets)) {
          throw new Error('Invalid budget data');
        }

        // Ensure we're added to the partner list
        const partnerPubkeys = [...(sharedBudget.partnerPubkeys || []), user.pubkey]
          .filter((v, i, a) => a.indexOf(v) === i);

        const updatedBudget: BudgetState = {
          ...sharedBudget,
          partnerPubkeys,
        };

        // Update local state with the shared budget (REPLACING any local data)
        setLocalState(updatedBudget);
        // CRITICAL: Set lastSavedStateRef so auto-save doesn't trigger
        lastSavedStateRef.current = getComparableState(updatedBudget);
        setLastSyncedAt(latestEvent.created_at);

        console.log('[BudgetStore] Successfully loaded shared budget (replaced local data)', {
          budgetId,
          version: sharedBudget.version,
          partners: partnerPubkeys.length,
        });

      } catch (e) {
        console.error('[BudgetStore] Failed to decrypt shared budget:', e);
        // Still mark as shared for manual retry, but DON'T push anything
        const fallbackState: BudgetState = {
          ...localState,
          budgetId,
          isShared: true,
          ownerPubkey,
          partnerPubkeys: [ownerPubkey, user.pubkey],
        };
        setLocalState(fallbackState);
        lastSavedStateRef.current = getComparableState(fallbackState);
      }

      // Remove from pending invitations and persist dismissal
      addDismissedInvitationId(invitation.id);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

      console.log('[BudgetStore] Accepted invitation from', invitation.fromPubkey);
      return true;
    } catch (error) {
      console.error('[BudgetStore] Failed to accept invitation:', error);
      return false;
    } finally {
      // Clear the flag after a short delay to ensure state has settled
      setTimeout(() => {
        isAcceptingInviteRef.current = false;
      }, 500);
    }
  }, [user?.pubkey, nip44, nostr, setLocalState, addDismissedInvitationId]);

  // Decline an invitation
  const declineInvitation = useCallback(async (invitation: PendingInvitation): Promise<boolean> => {
    // Persist dismissal so it doesn't reappear after refresh
    addDismissedInvitationId(invitation.id);
    // Remove from local list - we don't need to notify the sender
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
    return true;
  }, [addDismissedInvitationId]);

  // Remove a partner (owner only)
  const removePartner = useCallback(async (partnerPubkey: string): Promise<boolean> => {
    if (!user?.pubkey || user.pubkey !== state.ownerPubkey) return false;
    if (!nip44) return false;

    const newPartnerPubkeys = (state.partnerPubkeys || []).filter(pk => pk !== partnerPubkey);
    const isStillShared = newPartnerPubkeys.length > 1;

    // Update local state first
    const updatedState: BudgetState = {
      ...state,
      partnerPubkeys: newPartnerPubkeys,
      isShared: isStillShared,
      version: (state.version || 0) + 1,
      lastEditedBy: user.pubkey,
      lastEditedAt: Math.floor(Date.now() / 1000),
    };

    setLocalState(updatedState);

    // Re-publish to remaining collaborators (excluding the removed one)
    if (isStillShared && state.budgetId) {
      const plaintext = JSON.stringify(updatedState);

      for (const collaboratorPubkey of newPartnerPubkeys) {
        try {
          const encrypted = await nip44.encrypt(collaboratorPubkey, plaintext);

          const tags: string[][] = [
            ['d', getSharedBudgetDTag(state.budgetId, collaboratorPubkey)],
            ['alt', 'Sat Sorter shared budget data (encrypted)'],
          ];

          for (const pk of newPartnerPubkeys) {
            tags.push(['p', pk]);
          }

          await publish({
            kind: BUDGET_KIND,
            content: encrypted,
            tags,
          });
        } catch (e) {
          console.error('[BudgetStore] Failed to update budget for', collaboratorPubkey.slice(0, 8), e);
        }
      }

      console.log('[BudgetStore] Removed partner and updated shared budget');
    }

    lastSavedStateRef.current = getComparableState(updatedState);
    return true;
  }, [user?.pubkey, state, nip44, publish, setLocalState]);

  // Check for invitations on login
  useEffect(() => {
    if (isLoggedIn && isInitialLoadComplete) {
      fetchPendingInvitations();
      fetchSentInvitations();
    }
  }, [isLoggedIn, isInitialLoadComplete, fetchPendingInvitations, fetchSentInvitations]);

  return {
    // State
    currentBudget,
    currentMonth: state.currentMonth,
    currency: state.currency,
    availableMonths,
    getFullBudgetState,

    // Month actions
    setCurrentMonth,
    toggleCurrency,

    // Bucket actions
    addBucket,
    updateBucket,
    deleteBucket,

    // Line item actions
    addLineItem,
    updateLineItem,
    deleteLineItem,

    // Transaction actions
    addTransaction,
    updateTransaction,
    deleteTransaction,
    assignTransaction,
    splitTransaction,

    // Budget duplication
    duplicateFromMonth,
    getPreviousMonth,
    hasPreviousMonthBudget,

    // Sync status
    syncStatus,
    lastSyncedAt,
    isLoggedIn,
    isInitialLoadComplete,
    isOnline,

    // Conflict resolution
    conflictInfo,
    resolveConflictUseRemote,
    resolveConflictKeepLocal,
    resolveConflictMergeBoth,
    dismissConflict,

    // Full state for conflict diff
    getFullBudgetState,

    // Sharing info
    isSharedBudget,
    budgetVersion: state.version,
    lastEditedBy: state.lastEditedBy,
    lastEditedAt: state.lastEditedAt,
    ownerPubkey: state.ownerPubkey,
    partnerPubkeys: state.partnerPubkeys,

    // Real-time updates from partners
    partnerUpdateNotification,
    clearPartnerUpdateNotification: () => setPartnerUpdateNotification(null),

    // Offline sync tracking
    hasUnsavedLocalChanges,
    offlineChangesMade,
    clearOfflineChangesFlag: () => setOfflineChangesMade(false),

    // Invitation system
    pendingInvitations,
    sentInvitations,
    invitePartner,
    acceptInvitation,
    declineInvitation,
    cancelInvitation,
    removePartner,

    // Manual sync controls (for edge cases)
    refreshFromRelays,
    forceSaveToRelays,

    // Backup/restore
    importBudgetState,
  };
}
