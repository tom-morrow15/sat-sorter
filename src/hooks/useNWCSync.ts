import { useState, useCallback, useEffect, useRef } from 'react';
import { LN } from '@getalby/sdk';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface NWCTransaction {
  type: 'incoming' | 'outgoing';
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash: string;
  amount: number; // in millisats
  fees_paid?: number;
  created_at: number; // unix timestamp
  expires_at?: number;
  settled_at?: number;
  metadata?: Record<string, unknown>;
}

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
  const [syncState, setSyncState] = useLocalStorage<SyncState>('nwc-sync-state', {
    lastSyncTimestamp: null,
    syncedPaymentHashes: [],
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useLocalStorage<boolean>('nwc-auto-sync', false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncInProgressRef = useRef(false);
  // Always point to the latest sync function so intervals never call stale closures
  const syncTransactionsRef = useRef<((showToast?: boolean) => Promise<NWCSyncResult>) | null>(null);

  /**
   * Fetch transactions from NWC wallet
   */
  const fetchNWCTransactions = useCallback(async (
    connectionString: string,
    fromTimestamp?: number
  ): Promise<NWCTransaction[]> => {
    const client = new LN(connectionString);

    try {
      // The Alby SDK uses getTransactions or listTransactions
      // Different wallets may have different method names
      const response = await (client as unknown as {
        getTransactions: (params: { from?: number; limit?: number }) => Promise<{ transactions: NWCTransaction[] }>
      }).getTransactions({
        from: fromTimestamp,
        limit: 100,
      });

      return response.transactions || [];
    } catch (error) {
      // Try alternative method name
      try {
        const response = await (client as unknown as {
          listTransactions: (params: { from?: number; limit?: number }) => Promise<{ transactions: NWCTransaction[] }>
        }).listTransactions({
          from: fromTimestamp,
          limit: 100,
        });

        return response.transactions || [];
      } catch {
        // This is expected for wallets that don't support list_transactions
        // Don't log as error since it's normal behavior
        throw new Error('This wallet does not support transaction listing. Try connecting a different wallet or use manual entry.');
      }
    }
  }, []);

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

    // Prevent concurrent syncs from racing (both from auto-sync interval + manual trigger)
    if (syncInProgressRef.current) {
      result.success = false;
      result.errors.push('Sync already in progress');
      return result;
    }

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

    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      // Fetch transactions from the wallet
      const nwcTransactions = await fetchNWCTransactions(
        activeConnection.connectionString,
        syncState.lastSyncTimestamp || undefined
      );

      if (!nwcTransactions || nwcTransactions.length === 0) {
        if (showToast) {
          toast({
            title: 'No new transactions',
            description: 'No new transactions found since last sync.',
          });
        }
        result.success = true;
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return result;
      }

      // Track which payment hashes we've already synced
      // Build the initial set from both localStorage state and current budget transactions
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

          // Add the hash to the set immediately so subsequent iterations
          // within this same sync can detect it (prevents double-import
          // if the same sync loop encounters duplicate payment_hashes)
          existingHashes.add(nwcTx.payment_hash);

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
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      result.success = false;

      if (showToast) {
        toast({
          title: 'Sync failed',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }

    return result;
  }, [
    getActiveConnection,
    fetchNWCTransactions,
    syncState,
    setSyncState,
    currentBudget.transactions,
    addTransaction,
    toast,
  ]);

  // Keep the ref pointing to the latest syncTransactions so the interval
  // never calls a stale closure (e.g., with outdated budget state)
  useEffect(() => {
    syncTransactionsRef.current = syncTransactions;
    return () => { syncTransactionsRef.current = null; };
  }, [syncTransactions]);

  /**
   * Start automatic background sync
   * Sets the flag; the useEffect below handles the interval + initial sync.
   * This prevents the old pattern where startAutoSync AND the effect both
   * created intervals and ran initial syncs, causing double-imports.
   */
  const startAutoSync = useCallback(() => {
    setAutoSyncEnabled(true);

    toast({
      title: 'Auto-sync enabled',
      description: 'Transactions will sync automatically every 5 minutes.',
    });
  }, [setAutoSyncEnabled, toast]);

  /**
   * Stop automatic background sync
   */
  const stopAutoSync = useCallback(() => {
    setAutoSyncEnabled(false);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

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

  // Auto-start polling when enabled and wallet is connected.
  // The effect cleans up the interval when auto-sync is disabled,
  // the wallet disconnects, or the component unmounts.
  useEffect(() => {
    if (!autoSyncEnabled || connections.length === 0) return;

    // Start polling using the ref, which always points to the latest sync function
    pollIntervalRef.current = setInterval(() => {
      syncTransactionsRef.current?.(false);
    }, POLL_INTERVAL_MS);

    // Initial sync on mount
    syncTransactionsRef.current?.(false);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [autoSyncEnabled, connections.length]);

  return {
    isSyncing,
    autoSyncEnabled,
    lastSyncTimestamp: syncState.lastSyncTimestamp,
    syncTransactions,
    startAutoSync,
    stopAutoSync,
    clearSyncHistory,
    hasWalletConnected: connections.length > 0,
  };
}
