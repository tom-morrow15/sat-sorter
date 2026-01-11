import { useState, useCallback, useEffect, useRef } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { listTransactions, getWalletInfo, fetchWalletInfo, parseNWCUri, type NWCTransaction, type NWCInfo } from '@/lib/nwcClient';

interface SyncState {
  lastSyncTimestamp: number | null;
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

export function useNWCSync() {
  const { toast } = useToast();
  const { getActiveConnection, connections } = useNWC();
  const { addTransaction, currentBudget } = useBudget();

  const [isSyncing, setIsSyncing] = useState(false);
  const [walletInfo, setWalletInfo] = useState<NWCInfo | null>(null);
  const [syncState, setSyncState] = useLocalStorage<SyncState>('nwc-sync-state', {
    lastSyncTimestamp: null,
    syncedPaymentHashes: [],
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage<boolean>('nwc-auto-sync', false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
   * Sync transactions from NWC wallet
   */
  const syncTransactions = useCallback(async (showToast = true): Promise<NWCSyncResult> => {
    const result: NWCSyncResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const activeConnection = getActiveConnection();
    if (!activeConnection) {
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

    setIsSyncing(true);

    try {
      // First, check wallet capabilities if we haven't already
      let info = walletInfo;
      if (!info) {
        info = await checkWalletCapabilities(activeConnection.connectionString);
      }

      // Check if list_transactions is supported
      if (!info?.methods?.includes('list_transactions')) {
        const supportedMethods = info?.methods?.join(', ') || 'unknown';
        const errorMsg = `This wallet doesn't support transaction listing (list_transactions).\n\nSupported methods: ${supportedMethods}\n\nCompatible wallets: Alby Hub, Mutiny (with full NWC). Other wallets may only support pay_invoice.`;
        
        if (showToast) {
          toast({
            title: 'Transaction sync not supported',
            description: 'This wallet doesn\'t support listing transactions. Try using Alby Hub or importing via CSV.',
            variant: 'destructive',
          });
        }
        result.errors.push(errorMsg);
        setIsSyncing(false);
        return result;
      }

      console.log('[NWCSync] Fetching transactions...');

      // Fetch transactions from the wallet using our direct NWC implementation
      const response = await listTransactions(
        activeConnection.connectionString,
        {
          from: syncState.lastSyncTimestamp || undefined,
          limit: 100,
        }
      );

      const nwcTransactions = response.transactions;

      if (!nwcTransactions || nwcTransactions.length === 0) {
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

      // Track which payment hashes we've already synced
      const existingHashes = new Set([
        ...syncState.syncedPaymentHashes,
        ...currentBudget.transactions
          .filter(t => t.paymentHash)
          .map(t => t.paymentHash!),
      ]);

      let imported = 0;
      let skipped = 0;
      let latestTimestamp = syncState.lastSyncTimestamp || 0;

      for (const nwcTx of nwcTransactions) {
        try {
          // Skip if we've already synced this transaction
          if (existingHashes.has(nwcTx.payment_hash)) {
            skipped++;
            continue;
          }

          // Skip pending/expired/failed transactions
          if (nwcTx.state && nwcTx.state !== 'settled') {
            skipped++;
            continue;
          }

          // Convert millisats to sats
          const amountSats = Math.round(nwcTx.amount / 1000);

          // Skip zero-amount transactions
          if (amountSats === 0) {
            skipped++;
            continue;
          }

          // Create transaction
          const transaction = {
            amount: amountSats,
            description: nwcTx.description || nwcTx.invoice?.slice(0, 50) || 'Lightning payment',
            date: new Date((nwcTx.settled_at || nwcTx.created_at) * 1000).toISOString(),
            lineItemId: null,
            bucketId: null,
            isIncome: nwcTx.type === 'incoming',
            source: 'nwc' as const,
            paymentHash: nwcTx.payment_hash,
            preimage: nwcTx.preimage,
          };

          addTransaction(transaction);
          imported++;

          // Track the latest timestamp
          const txTimestamp = nwcTx.settled_at || nwcTx.created_at;
          if (txTimestamp > latestTimestamp) {
            latestTimestamp = txTimestamp;
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

      // Update sync state
      if (imported > 0 || latestTimestamp > (syncState.lastSyncTimestamp || 0)) {
        const newHashes = nwcTransactions.map(t => t.payment_hash);
        const allHashes = [...syncState.syncedPaymentHashes, ...newHashes];

        // Keep only the most recent hashes to prevent localStorage bloat
        const trimmedHashes = allHashes.slice(-MAX_STORED_HASHES);

        setSyncState({
          lastSyncTimestamp: latestTimestamp,
          syncedPaymentHashes: trimmedHashes,
        });
      }

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
      setIsSyncing(false);
    }

    return result;
  }, [
    getActiveConnection,
    walletInfo,
    checkWalletCapabilities,
    syncState,
    setSyncState,
    currentBudget.transactions,
    addTransaction,
    toast,
  ]);

  /**
   * Start automatic background sync
   */
  const startAutoSync = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setAutoSyncEnabled(true);

    // Initial sync
    syncTransactions(false);

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      syncTransactions(false);
    }, POLL_INTERVAL_MS);

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
   * Clear sync history (useful for re-importing all transactions)
   */
  const clearSyncHistory = useCallback(() => {
    setSyncState({
      lastSyncTimestamp: null,
      syncedPaymentHashes: [],
    });

    toast({
      title: 'Sync history cleared',
      description: 'Next sync will import all available transactions.',
    });
  }, [setSyncState, toast]);

  // Check wallet capabilities when connection changes
  useEffect(() => {
    const activeConnection = getActiveConnection();
    if (activeConnection?.connectionString) {
      checkWalletCapabilities(activeConnection.connectionString);
    }
  }, [getActiveConnection, checkWalletCapabilities]);

  // Auto-start polling if enabled and wallet is connected
  useEffect(() => {
    if (autoSyncEnabled && connections.length > 0) {
      // Start polling
      pollIntervalRef.current = setInterval(() => {
        syncTransactions(false);
      }, POLL_INTERVAL_MS);

      // Initial sync on mount
      syncTransactions(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [autoSyncEnabled, connections.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSyncing,
    autoSyncEnabled,
    lastSyncTimestamp: syncState.lastSyncTimestamp,
    walletInfo,
    supportsListTransactions: supportsListTransactions(),
    syncTransactions,
    startAutoSync,
    stopAutoSync,
    clearSyncHistory,
    checkWalletCapabilities,
    hasWalletConnected: connections.length > 0,
  };
}
