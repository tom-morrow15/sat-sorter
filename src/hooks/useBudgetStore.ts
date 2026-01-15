import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQueryClient } from '@tanstack/react-query';
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
  createDefaultBuckets,
  getCurrentMonth,
  generateId,
} from '@/lib/budgetTypes';
import { nip19 } from 'nostr-tools';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078; // NIP-78 Application-specific data
const INVITE_KIND = 10078; // Budget invitation events
const AUTO_SAVE_DEBOUNCE_MS = 2000; // 2 seconds after last change

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
  const queryClient = useQueryClient();

  // Local storage for caching and offline/logged-out mode
  const [localState, setLocalState] = useLocalStorage<BudgetState>('sat-sorter-budget', DEFAULT_STATE);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

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

  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedStateRef = useRef<string>('');
  const isSavingRef = useRef(false);

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

  // Fetch budget from relays
  const fetchFromRelays = useCallback(async (): Promise<BudgetState | null> => {
    if (!user?.pubkey || !nip44) return null;

    try {
      const events = await nostr.query([
        {
          kinds: [BUDGET_KIND],
          authors: [user.pubkey],
          '#d': [APP_IDENTIFIER],
          limit: 1,
        },
      ], { signal: AbortSignal.timeout(15000) });

      console.log('[BudgetStore] Fetched', events.length, 'events from relays');

      if (events.length === 0) {
        return null;
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      const decrypted = await nip44.decrypt(user.pubkey, latestEvent.content);
      const budgetData: BudgetState = JSON.parse(decrypted);

      if (!budgetData || !Array.isArray(budgetData.budgets)) {
        console.warn('[BudgetStore] Invalid budget data from relays');
        return null;
      }

      // Ensure version is set (for backwards compatibility with existing budgets)
      if (!budgetData.version) {
        budgetData.version = 1;
      }

      // Ensure budgetId is set
      if (!budgetData.budgetId) {
        budgetData.budgetId = generateId();
      }

      console.log('[BudgetStore] Successfully loaded budget from relays', {
        budgetCount: budgetData.budgets.length,
        currentMonth: budgetData.currentMonth,
        version: budgetData.version,
        timestamp: latestEvent.created_at,
      });

      setLastSyncedAt(latestEvent.created_at);
      return budgetData;
    } catch {
      // Silently fail - expected when relays are unavailable
      // Will fall back to local storage
      return null;
    }
  }, [user?.pubkey, nip44, nostr]);

  // Check for conflicts before saving (returns remote state if conflict exists)
  const checkForConflicts = useCallback(async (localState: BudgetState): Promise<BudgetState | null> => {
    if (!user?.pubkey || !nip44) return null;

    try {
      const remoteBudget = await fetchFromRelays();
      if (!remoteBudget) return null;

      const localVersion = localState.version || 1;
      const remoteVersion = remoteBudget.version || 1;

      // If remote is newer, we have a conflict
      if (remoteVersion > localVersion) {
        console.log('[BudgetStore] Conflict detected', { localVersion, remoteVersion });
        return remoteBudget;
      }

      return null;
    } catch {
      return null;
    }
  }, [user?.pubkey, nip44, fetchFromRelays]);

  // Save budget to relays
  const saveToRelays = useCallback(async (state: BudgetState, skipConflictCheck = false): Promise<boolean> => {
    if (!user?.pubkey || !nip44) return false;
    if (isSavingRef.current) return false; // Prevent concurrent saves

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
      const encrypted = await nip44.encrypt(user.pubkey, plaintext);

      await publish({
        kind: BUDGET_KIND,
        content: encrypted,
        tags: [
          ['d', APP_IDENTIFIER],
          ['alt', 'Sat Sorter budget data (encrypted)'],
        ],
      });

      const now = Math.floor(Date.now() / 1000);
      setLastSyncedAt(now);
      lastSavedStateRef.current = plaintext;

      // Update local state with new version info
      setLocalState(updatedState);

      setSyncStatus('synced');

      console.log('[BudgetStore] Saved to relays successfully', { version: updatedState.version });

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

      const relayData = await fetchFromRelays();

      if (relayData) {
        // Relay has data - use it and update local cache
        setLocalState(relayData);
        lastSavedStateRef.current = JSON.stringify(relayData);
        console.log('[BudgetStore] Using relay data as source of truth');
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
        lastSavedStateRef.current = JSON.stringify(localState);
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
      lastSavedStateRef.current = JSON.stringify(localState);
    }
  }, [isLoggedIn, isInitialLoadComplete, localState]);

  // ============================================
  // AUTO-SAVE ON CHANGES (when logged in)
  // ============================================

  // Debounced auto-save when state changes
  useEffect(() => {
    if (!isLoggedIn || !isInitialLoadComplete) return;

    const currentStateStr = JSON.stringify(localState);

    // Skip if nothing changed
    if (currentStateStr === lastSavedStateRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('[BudgetStore] Auto-saving changes to relays...');
      await saveToRelays(localState);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localState, isLoggedIn, isInitialLoadComplete, saveToRelays]);

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

  // Update a transaction
  const updateTransaction = useCallback((
    transactionId: string,
    updates: Partial<Transaction>
  ) => {
    const updatedBudget = {
      ...currentBudget,
      transactions: currentBudget.transactions.map(t =>
        t.id === transactionId ? { ...t, ...updates } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a transaction
  const deleteTransaction = useCallback((transactionId: string) => {
    const updatedBudget = {
      ...currentBudget,
      transactions: currentBudget.transactions.filter(t => t.id !== transactionId),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Assign transaction to a line item
  const assignTransaction = useCallback((
    transactionId: string,
    bucketId: string,
    lineItemId: string
  ) => {
    updateTransaction(transactionId, { bucketId, lineItemId });
  }, [updateTransaction]);

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
    const relayData = await fetchFromRelays();

    if (relayData) {
      setLocalState(relayData);
      lastSavedStateRef.current = JSON.stringify(relayData);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } else {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      return false;
    }
  }, [isLoggedIn, fetchFromRelays, setLocalState]);

  // Force save to relays (manual trigger)
  const forceSaveToRelays = useCallback(async () => {
    if (!isLoggedIn) return false;
    return saveToRelays(getFullBudgetState());
  }, [isLoggedIn, saveToRelays, getFullBudgetState]);

  // Conflict resolution: Use remote version (discard local changes)
  const resolveConflictUseRemote = useCallback(() => {
    if (!conflictInfo) return;

    setLocalState(conflictInfo.remoteBudget);
    lastSavedStateRef.current = JSON.stringify(conflictInfo.remoteBudget);
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

      const invitations: PendingInvitation[] = [];

      for (const event of events) {
        try {
          const decrypted = await nip44.decrypt(event.pubkey, event.content);
          const invitation: BudgetInvitation = JSON.parse(decrypted);

          if (invitation.type === 'budget-invite') {
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
  }, [user?.pubkey, nip44, nostr]);

  // Send invitation to a partner
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

      // Create invitation
      const budgetName = `Budget - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      const invitation: BudgetInvitation = {
        type: 'budget-invite',
        budgetId: state.budgetId || generateId(),
        budgetName,
        ownerPubkey: user.pubkey,
        createdAt: Math.floor(Date.now() / 1000),
      };

      // Encrypt and publish invitation
      const encrypted = await nip44.encrypt(partnerPubkey, JSON.stringify(invitation));

      await publish({
        kind: INVITE_KIND,
        content: encrypted,
        tags: [
          ['p', partnerPubkey],
          ['d', `budget-invite-${invitation.budgetId}`],
          ['alt', 'Sat Sorter budget invitation (encrypted)'],
        ],
      });

      // Update local state to mark as shared and add partner
      setLocalState(prev => ({
        ...prev,
        budgetId: invitation.budgetId,
        isShared: true,
        ownerPubkey: user.pubkey,
        partnerPubkeys: [...(prev.partnerPubkeys || []), user.pubkey, partnerPubkey].filter((v, i, a) => a.indexOf(v) === i),
      }));

      console.log('[BudgetStore] Invitation sent to', partnerPubkey);
      return true;
    } catch (error) {
      console.error('[BudgetStore] Failed to send invitation:', error);
      return false;
    }
  }, [user?.pubkey, nip44, state.budgetId, publish, setLocalState]);

  // Accept an invitation
  const acceptInvitation = useCallback(async (invitation: PendingInvitation): Promise<boolean> => {
    if (!user?.pubkey || !nip44) return false;

    try {
      // For now, just mark the budget as shared and add self as partner
      // In Phase 3, we'll fetch the actual shared budget
      setLocalState(prev => ({
        ...prev,
        budgetId: invitation.invitation.budgetId,
        isShared: true,
        ownerPubkey: invitation.invitation.ownerPubkey,
        partnerPubkeys: [invitation.invitation.ownerPubkey, user.pubkey],
      }));

      // Remove from pending invitations
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

      console.log('[BudgetStore] Accepted invitation from', invitation.fromPubkey);
      return true;
    } catch (error) {
      console.error('[BudgetStore] Failed to accept invitation:', error);
      return false;
    }
  }, [user?.pubkey, nip44, setLocalState]);

  // Decline an invitation
  const declineInvitation = useCallback(async (invitation: PendingInvitation): Promise<boolean> => {
    // Just remove from local list - we don't need to notify the sender
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
    return true;
  }, []);

  // Remove a partner (owner only)
  const removePartner = useCallback(async (partnerPubkey: string): Promise<boolean> => {
    if (!user?.pubkey || user.pubkey !== state.ownerPubkey) return false;

    setLocalState(prev => ({
      ...prev,
      partnerPubkeys: (prev.partnerPubkeys || []).filter(pk => pk !== partnerPubkey),
      isShared: (prev.partnerPubkeys || []).filter(pk => pk !== partnerPubkey).length > 1,
    }));

    return true;
  }, [user?.pubkey, state.ownerPubkey, setLocalState]);

  // Check for invitations on login
  useEffect(() => {
    if (isLoggedIn && isInitialLoadComplete) {
      fetchPendingInvitations();
    }
  }, [isLoggedIn, isInitialLoadComplete, fetchPendingInvitations]);

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
    dismissConflict,

    // Sharing info
    isSharedBudget,
    budgetVersion: state.version,
    lastEditedBy: state.lastEditedBy,
    lastEditedAt: state.lastEditedAt,
    ownerPubkey: state.ownerPubkey,
    partnerPubkeys: state.partnerPubkeys,

    // Invitation system
    pendingInvitations,
    invitePartner,
    acceptInvitation,
    declineInvitation,
    removePartner,

    // Manual sync controls (for edge cases)
    refreshFromRelays,
    forceSaveToRelays,
  };
}
