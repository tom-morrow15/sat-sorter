import type { Transaction, TransactionSplit } from './budgetTypes';

/**
 * Get all assignments (bucket + line item combos) for a transaction,
 * handling both legacy single-assignment and new split formats.
 */
export function getTransactionAssignments(
  tx: Transaction
): Array<{
  bucketId: string;
  lineItemId: string;
  amountUsd: number;
  amountSats: number;
}> {
  if (tx.splits && tx.splits.length > 0) {
    return tx.splits.map((s) => ({
      bucketId: s.bucketId,
      lineItemId: s.lineItemId,
      amountUsd: s.amountUsd ?? 0,
      amountSats: s.amount,
    }));
  }
  // Legacy format
  if (tx.lineItemId && tx.bucketId) {
    return [
      {
        bucketId: tx.bucketId,
        lineItemId: tx.lineItemId,
        amountUsd: tx.amountUsd ?? 0,
        amountSats: tx.amount,
      },
    ];
  }
  // Unassigned
  return [];
}

/**
 * Validate that all splits sum to the transaction total.
 * Returns { isValid: boolean; message?: string }
 */
export function validateSplits(
  totalUsd: number,
  splits: TransactionSplit[] | undefined
): { isValid: boolean; message?: string } {
  if (!splits || splits.length === 0) {
    return { isValid: false, message: 'At least one split is required.' };
  }
  const sumUsd = splits.reduce((sum, s) => sum + (s.amountUsd ?? 0), 0);
  const diff = Math.abs(sumUsd - totalUsd);
  // Allow 0.01 USD rounding difference
  if (diff > 0.01) {
    return {
      isValid: false,
      message: `Split amounts ($${sumUsd.toFixed(2)}) don't match total ($${totalUsd.toFixed(2)}).`,
    };
  }
  return { isValid: true };
}

/**
 * Create a new split from an existing transaction.
 * Returns a TransactionSplit object with generated ID.
 */
export function createSplit(
  bucketId: string,
  lineItemId: string,
  amountUsd: number,
  amountSats: number,
  description?: string
): TransactionSplit {
  return {
    id: crypto.randomUUID(),
    bucketId,
    lineItemId,
    amountUsd,
    amount: amountSats,
    description,
  };
}

/**
 * Check if a transaction has splits.
 */
export function hasSplits(tx: Transaction): boolean {
  return tx.splits !== undefined && tx.splits.length > 0;
}

/**
 * Get the number of splits for a transaction.
 */
export function getSplitCount(tx: Transaction): number {
  return tx.splits?.length ?? 0;
}

/**
 * Convert a legacy single-assignment transaction to a split transaction.
 */
export function convertToSplit(tx: Transaction): Transaction {
  if (hasSplits(tx)) {
    return tx; // Already a split
  }
  if (!tx.lineItemId || !tx.bucketId) {
    return tx; // Can't convert unassigned
  }
  // Create a single split from the legacy assignment
  const split = createSplit(
    tx.bucketId,
    tx.lineItemId,
    tx.amountUsd ?? 0,
    tx.amount,
    tx.description
  );
  return {
    ...tx,
    splits: [split],
    isSplit: true,
    lineItemId: null, // Clear legacy fields
    bucketId: null,
  };
}

/**
 * Convert a split transaction back to legacy single-assignment.
 * Uses the first split as the target.
 */
export function convertFromSplit(tx: Transaction): Transaction {
  if (!hasSplits(tx) || tx.splits!.length === 0) {
    return tx;
  }
  const firstSplit = tx.splits![0];
  return {
    ...tx,
    lineItemId: firstSplit.lineItemId,
    bucketId: firstSplit.bucketId,
    splits: undefined,
    isSplit: false,
  };
}

/**
 * Get the total amount of a transaction from its splits.
 * Useful for validation.
 */
export function getTotalFromSplits(splits: TransactionSplit[] | undefined): number {
  if (!splits || splits.length === 0) return 0;
  return splits.reduce((sum, s) => sum + (s.amountUsd ?? 0), 0);
}
