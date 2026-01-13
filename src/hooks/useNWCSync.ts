import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { listTransactions, getWalletInfo, fetchWalletInfo, parseNWCUri, type NWCTransaction, type NWCInfo } from '@/lib/nwcClient';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { getSafeNip44 } from '@/lib/utils';
import { useExtensionReady } from '@/hooks/useExtensionReady';

interface SyncState {
  /** Timestamp of when we last performed a sync (current time at sync) */
  lastSyncedAt: number | null;
  /** Timestamp of the most recent transaction we've seen (for API filtering) */
  lastTransactionTimestamp: number | null;
  syncedPaymentHashes: string[];
}

export interface NWCSyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_STORED_HASHES = 1000; // Limit stored hashes to prevent localStorage bloat
const NWC_CONNECTIONS_KIND = 30079; // NIP-78 Application-specific data for NWC
const NWC_CONNECTIONS_IDENTIFIER = 'sat-sorter/nwc-connections';

// Migration helper: convert old sync state format to new format
// This runs once when the module loads
function migrateOldSyncStateIfNeeded(): void {
  try {
    const stored = localStorage.getItem('nwc-sync-state');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check if it's the old format (has lastSyncTimestamp instead of lastSyncedAt)
      if ('lastSyncTimestamp' in parsed && !('lastSyncedAt' in parsed)) {
        console.log('[NWCSync] Migrating old sync state format');
        // Convert old format to new format
        const migrated: SyncState = {
          lastSyncedAt: parsed.lastSyncTimestamp, // Old timestamp becomes lastSyncedAt
          lastTransactionTimestamp: parsed.lastSyncTimestamp, // Also use it as lastTransactionTimestamp
          syncedPaymentHashes: parsed.syncedPaymentHashes || [],
        };
        localStorage.setItem('nwc-sync-state', JSON.stringify(migrated));
      }
    }
  } catch (e) {
    console.warn('[NWCSync] Failed to migrate sync state:', e);
  }
}

// Run migration on module load
migrateOldSyncStateIfNeeded();

const DEFAULT_SYNC_STATE: SyncState = {
  lastSyncedAt: null,
  lastTransactionTimestamp: null,
  syncedPaymentHashes: [],
};

interface UseNWCSyncOptions {
  /** Whether the sync is enabled (set to true after initial budget load) */
  enabled?: boolean;
}

export function useNWCSync(options: UseNWCSyncOptions = {}) {
  const { enabled = true } = options;

  const { toast } = useToast();
  const { getActiveConnection, connections, addConnection: addConnectionToState } = useNWC();
  const { addTransaction, currentBudget, getFullBudgetState } = useBudget();
  const { user, loginType } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: publish } = useNostrPublish();

  const [isSyncing, setIsSyncing] = useState(false);
  const [walletInfo, setWalletInfo] = useState<NWCInfo | null>(null);
  const [syncState, setSyncState] = useLocalStorage<SyncState>('nwc-sync-state', DEFAULT_SYNC_STATE);
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage<boolean>('nwc-auto-sync', false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncInProgressRef = useRef(false); // Mutex to prevent concurrent syncs

  // Only wait for extension if user logged in via extension
  const needsExtension = loginType === 'extension';
  const { isReady: isExtensionReady } = useExtensionReady();

  // Safely check for NIP-44 support (handles extension not installed case)
  // For extension logins: wait for extension to be ready first
  // For nsec/bunker logins: check immediately (no extension needed)
  const nip44 = useMemo(() => {
    if (needsExtension && !isExtensionReady) return null;
    return getSafeNip44(user);
  }, [user, needsExtension, isExtensionReady]);

  /**
   * Upload NWC connections to Nostr for cloud sync
   */
  const uploadNWCConnections = useCallback(async (): Promise<boolean> => {
    if (!user?.pubkey || !nip44) {
      console.log('[NWCSync] Cloud sync disabled: user not logged in or signer lacks NIP-44');
      return false;
    }

    if (connections.length === 0) {
      console.log('[NWCSync] No connections to sync');
      return false;
    }

    try {
      // Only include the essentials for security (no raw connection strings in plain metadata)
      const connectionsData = {
        version: 1,
        lastUpdated: Math.floor(Date.now() / 1000),
        // Store encrypted connection data in Nostr
        connectionCount: connections.length,
      };

      const plaintext = JSON.stringify({
        version: 1,
        lastUpdated: Math.floor(Date.now() / 1000),
        connections: connections.map(c => ({
          connectionString: c.connectionString,
          alias: c.alias,
        })),
      });

      console.log('[NWCSync] Encrypting NWC connections for cloud sync...');

      // Encrypt the connection data with NIP-44 (to self)
      const encrypted = await nip44.encrypt(user.pubkey, plaintext);

      // Publish as NIP-78 event (application-specific data)
      await publish({
        kind: NWC_CONNECTIONS_KIND,
        content: encrypted,
        tags: [
          ['d', NWC_CONNECTIONS_IDENTIFIER],
          ['alt', 'Sat Sorter NWC connections (encrypted)'],
        ],
      });

      console.log('[NWCSync] NWC connections synced to cloud');
      return true;
    } catch (error) {
      console.error('[NWCSync] Failed to upload NWC connections:', error);
      return false;
    }
  }, [user, nip44, connections, publish]);

  /**
   * Download NWC connections from Nostr for cloud sync
   */
  const downloadNWCConnections = useCallback(async (): Promise<boolean> => {
    if (!user?.pubkey || !nip44) {
      console.log('[NWCSync] Cloud sync disabled: user not logged in or signer lacks NIP-44');
      return false;
    }

    try {
      const combinedSignal = AbortSignal.any([AbortSignal.timeout(10000)]);

      const events = await nostr.query([
        {
          kinds: [NWC_CONNECTIONS_KIND],
          authors: [user.pubkey],
          '#d': [NWC_CONNECTIONS_IDENTIFIER],
          limit: 1,
        },
      ], { signal: combinedSignal });

      console.log('[NWCSync] Query returned', events.length, 'NWC connection events');

      if (events.length === 0) {
        console.log('[NWCSync] No remote NWC connections found');
        return false;
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        console.log('[NWCSync] Decrypting remote NWC connections...');
        const decrypted = await nip44.decrypt(user.pubkey, latestEvent.content);
        const remoteData = JSON.parse(decrypted);

        if (!Array.isArray(remoteData.connections)) {
          console.warn('[NWCSync] Invalid remote connection data');
          return false;
        }

        console.log('[NWCSync] Found', remoteData.connections.length, 'remote connections');

        // Add any remote connections that don't exist locally
        let addedCount = 0;
        for (const remoteConn of remoteData.connections) {
          const exists = connections.some(c => c.connectionString === remoteConn.connectionString);
          if (!exists) {
            console.log('[NWCSync] Adding remote connection:', remoteConn.alias);
            await addConnectionToState(remoteConn.connectionString, remoteConn.alias);
            addedCount++;
          }
        }

        console.log('[NWCSync] Added', addedCount, 'remote connections');
        return addedCount > 0;
      } catch (error) {
        console.error('[NWCSync] Failed to decrypt remote connections:', error);
        return false;
      }
    } catch (error) {
      console.error('[NWCSync] Failed to download NWC connections:', error);
      return false;
    }
  }, [user, nip44, nostr, connections, addConnectionToState]);

  /**
   * Check wallet capabilities on connection
   */
  const checkWalletCapabilities = useCallback(async (connectionString: string): Promise<NWCInfo | null> => {
    try {
      const params = parseNWCUri(connectionString);
      if (!params) return null;

      const info = await fetchWalletInfo(params);
      console.log('[NWCSync] Wallet capabilities:', info);
      setWalletInfo(info);
      return info;
    } catch (error) {
      console.error('[NWCSync] Failed to fetch wallet info:', error);
      return null;
    }
  }, []);

  /**
   * Check if the connected wallet supports transaction listing
   */
  const supportsListTransactions = useCallback((): boolean => {
    return walletInfo?.methods?.includes('list_transactions') ?? false;
  }, [walletInfo]);

  /**
   * Sync transactions from a single NWC wallet
   * Note: listTransactions already handles wallet info fetching internally,
   * so we don't need to call fetchWalletInfo separately here.
   */
  const syncSingleWallet = useCallback(async (
    connection: { connectionString: string; alias?: string },
    fromTimestamp: number | undefined
  ): Promise<{ transactions: NWCTransaction[]; walletAlias: string; error?: string }> => {
    const walletAlias = connection.alias || 'Lightning Wallet';

    try {
      // Validate connection string
      const params = parseNWCUri(connection.connectionString);
      if (!params) {
        return { transactions: [], walletAlias, error: 'Invalid connection string' };
      }

      console.log(`[NWCSync] Fetching transactions from ${walletAlias} (wallet: ${params.walletPubkey.slice(0, 12)}...)...`);

      // listTransactions handles wallet info fetching internally
      // and includes retry logic for timeouts
      const response = await listTransactions(
        connection.connectionString,
        {
          from: fromTimestamp,
          limit: 200,
        }
      );

      console.log(`[NWCSync] ${walletAlias}: received ${response.transactions?.length || 0} transactions`);

      return {
        transactions: response.transactions || [],
        walletAlias
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[NWCSync] Failed to sync wallet ${walletAlias}:`, errorMsg);
      return { transactions: [], walletAlias, error: errorMsg };
    }
  }, []);

  /**
   * Sync transactions from ALL connected NWC wallets
   * @param showToast - Whether to show toast notifications
   * @param forceFullSync - If true, fetches ALL transactions ignoring the lastTransactionTimestamp
   */
  const syncTransactions = useCallback(async (showToast = true, forceFullSync = false): Promise<NWCSyncResult> => {
    const result: NWCSyncResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    // Prevent concurrent syncs using a mutex
    if (syncInProgressRef.current) {
      console.log('[NWCSync] Sync already in progress, skipping...');
      result.errors.push('Sync already in progress');
      return result;
    }

    if (connections.length === 0) {
      if (showToast) {
        toast({
          title: 'No wallet connected',
          description: 'Please connect a Lightning wallet first.',
          variant: 'destructive',
        });
      }
      result.errors.push('No wallet connected');
      return result;
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      // Fetch transactions from the wallet using our direct NWC implementation
      // Use a buffer of 1 hour before the last transaction timestamp to catch any stragglers
      // This helps with transactions that may have been settling while we synced
      // If forceFullSync is true, fetch ALL transactions regardless of previous sync state
      const fromTimestamp = forceFullSync
        ? undefined
        : (syncState.lastTransactionTimestamp
            ? syncState.lastTransactionTimestamp - 3600 // Go back 1 hour from last transaction
            : undefined);

      console.log('[NWCSync] Syncing ALL wallets (' + connections.length + ' connected)');
      console.log('[NWCSync] Fetching from timestamp:', fromTimestamp,
        fromTimestamp ? new Date(fromTimestamp * 1000).toISOString() : 'all time',
        forceFullSync ? '(FULL SYNC)' : '');

      // Sync wallets with staggered execution to avoid overwhelming the relay
      // This helps with reliability, especially for self-hosted nodes
      const walletResults: Array<{ transactions: NWCTransaction[]; walletAlias: string; error?: string }> = [];

      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];

        // Add a small delay between wallet syncs (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const result = await syncSingleWallet(conn, fromTimestamp);
        walletResults.push(result);
      }

      // Collect all transactions from all wallets
      const allTransactions: Array<NWCTransaction & { walletAlias: string; connectionString: string }> = [];

      for (let i = 0; i < walletResults.length; i++) {
        const walletResult = walletResults[i];
        const connection = connections[i];

        if (walletResult.error) {
          result.errors.push(`${walletResult.walletAlias}: ${walletResult.error}`);
        }

        // Add wallet info to each transaction
        for (const tx of walletResult.transactions) {
          allTransactions.push({
            ...tx,
            walletAlias: walletResult.walletAlias,
            connectionString: connection.connectionString,
          });
        }

        console.log(`[NWCSync] ${walletResult.walletAlias}: ${walletResult.transactions.length} transactions`);
      }

      // Use allTransactions as our combined list from all wallets
      const nwcTransactions = allTransactions;

      if (nwcTransactions.length === 0) {
        // Still update lastSyncedAt even when no transactions found
        const currentSyncTime = Math.floor(Date.now() / 1000);
        setSyncState({
          ...syncState,
          lastSyncedAt: currentSyncTime,
        });
        console.log('[NWCSync] No transactions found. Updated lastSyncedAt to:', new Date(currentSyncTime * 1000).toISOString());

        if (showToast) {
          toast({
            title: 'No new transactions',
            description: 'No new transactions found since last sync.',
          });
        }
        result.success = true;
        setIsSyncing(false);
        return result;
      }

      console.log(`[NWCSync] Found ${nwcTransactions.length} transactions`);

      // Track which payment hashes already exist in ANY budget (not just current month)
      // This prevents importing the same transaction twice across different months
      const fullBudgetState = getFullBudgetState();
      const allPaymentHashes = new Set<string>();

      for (const budget of fullBudgetState.budgets) {
        for (const tx of budget.transactions) {
          if (tx.paymentHash) {
            allPaymentHashes.add(tx.paymentHash);
          }
        }
      }

      console.log('[NWCSync] Total transactions with payment hashes across all budgets:', allPaymentHashes.size);

      let imported = 0;
      let skipped = 0;
      let latestTransactionTimestamp = syncState.lastTransactionTimestamp || 0;
      const currentSyncTime = Math.floor(Date.now() / 1000);

      for (const nwcTx of nwcTransactions) {
        try {
          // Skip if this transaction already exists in ANY budget month
          // NOTE: We check all budgets, not just current month, because transactions
          // are routed to their respective months based on transaction date
          if (allPaymentHashes.has(nwcTx.payment_hash)) {
            console.log('[NWCSync] Skipping transaction already in budget:', nwcTx.payment_hash.slice(0, 16) + '...');
            skipped++;
            continue;
          }

          // Skip pending/expired/failed transactions
          if (nwcTx.state && nwcTx.state !== 'settled') {
            console.log('[NWCSync] Skipping non-settled transaction:', nwcTx.state);
            skipped++;
            continue;
          }

          // Convert millisats to sats
          const amountSats = Math.round(nwcTx.amount / 1000);

          // Skip zero-amount transactions
          if (amountSats === 0) {
            console.log('[NWCSync] Skipping zero-amount transaction');
            skipped++;
            continue;
          }

          // Build a useful description from available data
          // Priority: description > metadata.comment > "Lightning payment"
          let description = 'Lightning payment';
          if (nwcTx.description && nwcTx.description.trim()) {
            description = nwcTx.description.trim();
          } else if (nwcTx.metadata?.comment && typeof nwcTx.metadata.comment === 'string') {
            description = nwcTx.metadata.comment;
          }

          // Create transaction with wallet source info from the transaction itself
          const transaction = {
            amount: amountSats,
            description,
            date: new Date((nwcTx.settled_at || nwcTx.created_at) * 1000).toISOString(),
            lineItemId: null,
            bucketId: null,
            isIncome: nwcTx.type === 'incoming',
            source: 'nwc' as const,
            sourceWallet: nwcTx.walletAlias,
            sourceWalletId: nwcTx.connectionString,
            paymentHash: nwcTx.payment_hash,
            preimage: nwcTx.preimage,
          };

          console.log('[NWCSync] Importing transaction:', {
            amount: amountSats,
            description,
            date: transaction.date,
            isIncome: transaction.isIncome,
            paymentHash: nwcTx.payment_hash,
            sourceWallet: nwcTx.walletAlias,
          });

          addTransaction(transaction);
          imported++;

          // Track the latest transaction timestamp (for API filtering on next sync)
          const txTimestamp = nwcTx.settled_at || nwcTx.created_at;
          if (txTimestamp > latestTransactionTimestamp) {
            latestTransactionTimestamp = txTimestamp;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to import transaction: ${errorMsg}`);
          skipped++;
        }
      }

      result.imported = imported;
      result.skipped = skipped;
      result.success = true;

      console.log('[NWCSync] Sync results:', { imported, skipped, total: nwcTransactions.length });

      // Always update lastSyncedAt to current time (this is when we actually synced)
      // Update lastTransactionTimestamp if we found newer transactions
      const newHashes = nwcTransactions.map(t => t.payment_hash);
      const allHashes = [...syncState.syncedPaymentHashes, ...newHashes];

      // Keep only the most recent hashes to prevent localStorage bloat
      const trimmedHashes = allHashes.slice(-MAX_STORED_HASHES);

      setSyncState({
        lastSyncedAt: currentSyncTime, // Always update to NOW
        lastTransactionTimestamp: latestTransactionTimestamp > 0
          ? latestTransactionTimestamp
          : syncState.lastTransactionTimestamp,
        syncedPaymentHashes: trimmedHashes,
      });

      console.log('[NWCSync] Sync complete. Updated lastSyncedAt to:', new Date(currentSyncTime * 1000).toISOString());

      if (showToast && imported > 0) {
        toast({
          title: 'Sync complete',
          description: `Imported ${imported} transaction${imported !== 1 ? 's' : ''}${
            skipped > 0 ? ` (${skipped} skipped)` : ''
          }`,
        });
      } else if (showToast && imported === 0) {
        toast({
          title: 'No new transactions',
          description: `${skipped} transaction${skipped !== 1 ? 's' : ''} already imported.`,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      result.success = false;

      console.error('[NWCSync] Sync failed:', error);

      if (showToast) {
        toast({
          title: 'Sync failed',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }

    return result;
  }, [
    connections,
    syncSingleWallet,
    syncState,
    setSyncState,
    getFullBudgetState,
    addTransaction,
    toast,
  ]);

  /**
   * Start automatic background sync
   */
  const startAutoSync = useCallback(() => {
    // Clear any existing interval (will be recreated by useEffect)
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Set the flag - the useEffect will handle setting up the interval
    setAutoSyncEnabled(true);

    // Immediate sync
    syncTransactions(false);

    toast({
      title: 'Auto-sync enabled',
      description: 'Transactions will sync automatically every 5 minutes.',
    });
  }, [syncTransactions, setAutoSyncEnabled, toast]);

  /**
   * Stop automatic background sync
   */
  const stopAutoSync = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setAutoSyncEnabled(false);

    toast({
      title: 'Auto-sync disabled',
      description: 'Automatic transaction sync has been turned off.',
    });
  }, [setAutoSyncEnabled, toast]);

  /**
   * Clear sync history and trigger a full re-sync
   */
  const clearSyncHistory = useCallback(async () => {
    setSyncState({
      lastSyncedAt: null,
      lastTransactionTimestamp: null,
      syncedPaymentHashes: [],
    });

    toast({
      title: 'Sync history cleared',
      description: 'Starting full transaction sync...',
    });

    // Trigger a full sync after clearing
    // Small delay to let state update
    setTimeout(() => {
      syncTransactions(true, true);
    }, 100);
  }, [setSyncState, toast, syncTransactions]);

  /**
   * Force a full sync that fetches ALL transactions from all time
   * This ignores the lastTransactionTimestamp and re-checks everything
   */
  const forceFullSync = useCallback(async (showToast = true): Promise<NWCSyncResult> => {
    console.log('[NWCSync] Starting FULL sync (ignoring timestamp filter)...');
    return syncTransactions(showToast, true);
  }, [syncTransactions]);

  // Check wallet capabilities when connection changes
  useEffect(() => {
    const activeConnection = getActiveConnection();
    if (activeConnection?.connectionString) {
      console.log('[NWCSync] Checking wallet capabilities for:', activeConnection.alias);
      checkWalletCapabilities(activeConnection.connectionString);
    }
  }, [connections, getActiveConnection, checkWalletCapabilities]);

  // Sync NWC connections to cloud when user logs in or connections change
  useEffect(() => {
    if (user?.pubkey && connections.length > 0) {
      // Small delay to avoid spamming syncs
      const timer = setTimeout(() => {
        uploadNWCConnections();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.pubkey, connections, uploadNWCConnections]);

  // Auto-sync on app load if wallet is connected
  // Only runs after the initial budget load is complete (enabled = true)
  // If we have wallet info and it doesn't support list_transactions, skip auto-sync
  // If we don't have wallet info (couldn't fetch), try anyway
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    console.log('[NWCSync] Auto-sync check:', {
      enabled,
      initialSyncDone: initialSyncDoneRef.current,
      hasWalletInfo: !!walletInfo,
      methods: walletInfo?.methods,
      supportsListTx: walletInfo?.methods?.includes('list_transactions'),
      connectionsCount: connections.length,
    });

    // Skip if wallet info explicitly says list_transactions is not supported
    const explicitlyUnsupported = walletInfo && !walletInfo.methods?.includes('list_transactions');

    if (
      enabled &&
      !initialSyncDoneRef.current &&
      !explicitlyUnsupported &&
      connections.length > 0
    ) {
      initialSyncDoneRef.current = true;
      // Small delay to let the app settle and wallet info to load
      const timer = setTimeout(() => {
        // If we've never synced before (no lastTransactionTimestamp), do a full sync
        const isFirstSync = !syncState.lastTransactionTimestamp;
        if (isFirstSync) {
          console.log('[NWCSync] First sync ever - fetching ALL transactions...');
          syncTransactions(false, true); // Full sync
        } else {
          console.log('[NWCSync] Auto-syncing on app load (after budget loaded)...');
          syncTransactions(false);
        }
      }, 1500); // Increased delay to give wallet info time to load
      return () => clearTimeout(timer);
    }
  }, [enabled, walletInfo, connections.length, syncTransactions, syncState.lastTransactionTimestamp]);

  // Store the sync function in a ref to avoid stale closures in the interval
  const syncTransactionsRef = useRef(syncTransactions);
  useEffect(() => {
    syncTransactionsRef.current = syncTransactions;
  }, [syncTransactions]);

  // Auto-start polling if enabled and wallet is connected
  // Only runs after the initial budget load is complete (enabled = true)
  // Note: The initial sync is handled by the "auto-sync on app load" effect above,
  // so we only set up the polling interval here (no initial sync)
  useEffect(() => {
    if (enabled && autoSyncEnabled && connections.length > 0) {
      console.log('[NWCSync] Auto-sync enabled, starting polling every', POLL_INTERVAL_MS / 1000, 'seconds');

      // Start polling (initial sync is handled by the other effect)
      pollIntervalRef.current = setInterval(() => {
        console.log('[NWCSync] Running scheduled auto-sync...');
        syncTransactionsRef.current(false);
      }, POLL_INTERVAL_MS);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, autoSyncEnabled, connections.length]);

  return {
    isSyncing,
    autoSyncEnabled,
    /** Timestamp of when the last sync actually happened (current time at sync) */
    lastSyncTimestamp: syncState.lastSyncedAt,
    /** Timestamp of the most recent transaction we've seen */
    lastTransactionTimestamp: syncState.lastTransactionTimestamp,
    walletInfo,
    supportsListTransactions: supportsListTransactions(),
    syncTransactions,
    forceFullSync,
    startAutoSync,
    stopAutoSync,
    clearSyncHistory,
    checkWalletCapabilities,
    hasWalletConnected: connections.length > 0,
    // Cloud sync functions
    uploadNWCConnections,
    downloadNWCConnections,
  };
}
