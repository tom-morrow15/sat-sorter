import type { MonthlyBudget } from './budgetTypes';

/**
 * Tombstone-aware merge for a single monthly budget.
 *
 * This is the single source of truth for how two snapshots of the same month
 * are combined — used by BOTH the shared partner sync and the personal cloud
 * backup. All merge sites must use this helper so deletions behave
 * consistently everywhere.
 *
 * Semantics:
 * - Buckets, line items, and transactions are unioned by id.
 * - Tombstone lists (deletedTxIds, deletedBucketIds, deletedLineItemIds) are
 *   unioned monotonically: a deletion can never be undone by a merge. The
 *   only way to bring an item back is to create a new one (fresh id).
 * - For items that exist on both sides, remote fields win: the remote
 *   snapshot is the partner's (or the cloud's) latest published state.
 *   Local-only edits are re-published by the sync layer moments later.
 */
export function mergeMonthlyBudgets(local: MonthlyBudget, remote: MonthlyBudget): MonthlyBudget {
  // Tombstones are monotonic — union both sides
  const deletedTxIds = new Set([...(local.deletedTxIds || []), ...(remote.deletedTxIds || [])]);
  const deletedBucketIds = new Set([
    ...(local.deletedBucketIds || []),
    ...(remote.deletedBucketIds || []),
  ]);
  const deletedLineItemIds = new Set([
    ...(local.deletedLineItemIds || []),
    ...(remote.deletedLineItemIds || []),
  ]);

  // ── Buckets: union by id, excluding tombstoned buckets ──
  const bucketIds = new Set<string>();
  for (const b of local.buckets || []) bucketIds.add(b.id);
  for (const b of remote.buckets || []) bucketIds.add(b.id);

  const buckets = Array.from(bucketIds)
    .filter((id) => !deletedBucketIds.has(id))
    .map((id) => {
      const lb = (local.buckets || []).find((b) => b.id === id);
      const rb = (remote.buckets || []).find((b) => b.id === id);
      if (!lb) return rb!;
      if (!rb) return lb;

      // Remote (partner's latest published state) wins for shared fields
      const mergedBucket = { ...lb, ...rb };

      // Union line items by id, excluding tombstoned line items
      const itemIds = new Set<string>();
      for (const li of lb.lineItems || []) itemIds.add(li.id);
      for (const li of rb.lineItems || []) itemIds.add(li.id);
      const lineItems = Array.from(itemIds)
        .filter((iid) => !deletedLineItemIds.has(iid))
        .map((iid) => {
          const lli = (lb.lineItems || []).find((li) => li.id === iid);
          const rli = (rb.lineItems || []).find((li) => li.id === iid);
          if (lli && rli) return { ...lli, ...rli };
          return lli || rli!;
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      return { ...mergedBucket, lineItems };
    });

  // ── Transactions: union by id, excluding tombstoned transactions ──
  const txIds = new Set<string>();
  for (const t of local.transactions || []) txIds.add(t.id);
  for (const t of remote.transactions || []) txIds.add(t.id);

  const transactions = Array.from(txIds)
    .filter((id) => !deletedTxIds.has(id))
    .map((id) => {
      const lt = (local.transactions || []).find((t) => t.id === id);
      const rt = (remote.transactions || []).find((t) => t.id === id);
      if (lt && rt) return { ...lt, ...rt };
      return lt || rt!;
    });

  return {
    ...local,
    buckets,
    transactions,
    deletedTxIds: Array.from(deletedTxIds),
    deletedBucketIds: Array.from(deletedBucketIds),
    deletedLineItemIds: Array.from(deletedLineItemIds),
  };
}
