import { useState, useCallback } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useToast } from '@/hooks/useToast';
import {
  fetchStrikeTransactions,
  strikeTransactionToAppTransaction,
  getStrikeConfig,
  validateStrikeApiKey,
  saveStrikeConfig,
  type StrikeConfig,
} from '@/lib/strikeUtils';

export interface SyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export function useStrikeSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { addTransaction, currentBudget } = useBudget();
  const { toast } = useToast();

  /**
   * Check if Strike is configured
   */
  const isConfigured = useCallback((): boolean => {
    const config = getStrikeConfig();
    return !!config?.apiKey;
  }, []);

  /**
   * Sync Strike transactions
   */
  const syncTransactions = useCallback(
    async (apiKey?: string): Promise<SyncResult> => {
      setIsSyncing(true);
      const result: SyncResult = {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [],
      };

      try {
        // Get API key from parameter or stored config
        const keyToUse = apiKey || getStrikeConfig()?.apiKey;

        if (!keyToUse) {
          result.errors.push('No Strike API key found');
          toast({
            title: 'Strike not configured',
            description: 'Please connect your Strike account first.',
            variant: 'destructive',
          });
          setIsSyncing(false);
          return result;
        }

        // Validate API key
        const validation = await validateStrikeApiKey(keyToUse);
        if (!validation.valid) {
          result.errors.push(validation.error || 'Invalid Strike API key');
          toast({
            title: 'Authentication failed',
            description: validation.error || 'Your Strike API key is invalid or expired. Check console for details.',
            variant: 'destructive',
          });
          setIsSyncing(false);
          return result;
        }

        // Get last sync date from config
        const config = getStrikeConfig();
        const lastSyncDate = config?.lastSyncDate;

        // Fetch transactions from Strike
        const strikeTransactions = await fetchStrikeTransactions(
          keyToUse,
          lastSyncDate
        );

        if (!strikeTransactions || strikeTransactions.length === 0) {
          toast({
            title: 'No new transactions',
            description: 'No new transactions found since last sync.',
          });
          result.success = true;
          setIsSyncing(false);
          return result;
        }

        // Check for duplicates (by date, amount, description)
        const existingTransactions = currentBudget.transactions;
        let imported = 0;
        let skipped = 0;

        for (const strikeTransaction of strikeTransactions) {
          try {
            // Skip failed transactions
            if (strikeTransaction.status !== 'completed') {
              skipped++;
              continue;
            }

            // Convert to app format
            const appTransaction = strikeTransactionToAppTransaction(strikeTransaction);

            // Check for duplicate (same date, amount, and similar description)
            const isDuplicate = existingTransactions.some(
              (t) =>
                t.date === appTransaction.date &&
                t.amount === appTransaction.amount &&
                t.source === 'strike' &&
                t.merchantName === appTransaction.merchantName
            );

            if (isDuplicate) {
              skipped++;
              continue;
            }

            // Add transaction to budget
            addTransaction({
              ...appTransaction,
              bucketId: null,
              lineItemId: null,
              paymentHash: strikeTransaction.id,
            });

            imported++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to import transaction: ${errorMsg}`);
            skipped++;
          }
        }

        result.imported = imported;
        result.skipped = skipped;
        result.success = true;

        // Update last sync date in config
        if (imported > 0 && config) {
          const updatedConfig: StrikeConfig = {
            ...config,
            lastSyncDate: new Date().toISOString(),
          };
          saveStrikeConfig(updatedConfig);
        }

        // Show result toast
        if (imported > 0) {
          toast({
            title: 'Sync successful!',
            description: `Imported ${imported} transaction${imported !== 1 ? 's' : ''}${
              skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : ''
            }`,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(errorMsg);
        result.success = false;

        toast({
          title: 'Sync failed',
          description: errorMsg,
          variant: 'destructive',
        });
      } finally {
        setIsSyncing(false);
      }

      return result;
    },
    [addTransaction, currentBudget, toast]
  );

  return {
    isConfigured,
    isSyncing,
    syncTransactions,
  };
}
