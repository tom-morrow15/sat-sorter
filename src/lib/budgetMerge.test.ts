import { describe, it, expect } from 'vitest';
import { mergeMonthlyBudgets } from './budgetMerge';
import type { MonthlyBudget, Bucket, LineItem, Transaction } from './budgetTypes';

// ─── Helpers ────────────────────────────────────────────────────

function lineItem(id: string, name: string, plannedAmount = 0): LineItem {
  return { id, name, plannedAmount, order: 0 };
}

function bucket(id: string, name: string, lineItems: LineItem[]): Bucket {
  return { id, name, color: '#888', isIncome: false, icon: 'home', lineItems, order: 0 };
}

function transaction(id: string, lineItemId: string | null, bucketId: string | null): Transaction {
  return {
    id,
    description: 'test',
    amount: 1000,
    isIncome: false,
    date: '2026-09-18',
    bucketId,
    lineItemId,
  };
}

function month(overrides: Partial<MonthlyBudget>): MonthlyBudget {
  return {
    id: 'm1',
    month: '2026-09',
    buckets: [],
    transactions: [],
    ...overrides,
  };
}

// ─── The resurrection bug (regression test) ─────────────────────

describe('mergeMonthlyBudgets', () => {
  it('partner deletion of a line item STAYS deleted after merge', () => {
    // Partner (remote) deleted "Flex Pay" and published a snapshot without it,
    // carrying a tombstone. Local still has the item.
    const local = month({
      buckets: [bucket('b1', 'Subscriptions', [lineItem('flex-pay', 'Flex Pay'), lineItem('other', 'Other')])],
    });
    const remote = month({
      buckets: [bucket('b1', 'Subscriptions', [lineItem('other', 'Other')])],
      deletedLineItemIds: ['flex-pay'],
    });

    const merged = mergeMonthlyBudgets(local, remote);

    const sub = merged.buckets.find(b => b.id === 'b1')!;
    expect(sub.lineItems.map(li => li.id)).not.toContain('flex-pay');
    expect(sub.lineItems.map(li => li.id)).toContain('other');
    // Tombstone is preserved so the deletion propagates back
    expect(merged.deletedLineItemIds).toContain('flex-pay');
  });

  it('local deletion of a line item propagates to the incoming snapshot', () => {
    // Local deleted the item (tombstone recorded); remote snapshot still
    // contains it (partner hasn't received the deletion yet).
    const local = month({
      buckets: [bucket('b1', 'Subscriptions', [])],
      deletedLineItemIds: ['flex-pay'],
    });
    const remote = month({
      buckets: [bucket('b1', 'Subscriptions', [lineItem('flex-pay', 'Flex Pay')])],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.buckets[0].lineItems.map(li => li.id)).not.toContain('flex-pay');
    expect(merged.deletedLineItemIds!).toContain('flex-pay');
  });

  it('partner deletion of a whole bucket STAYS deleted (including its items)', () => {
    const local = month({
      buckets: [bucket('b-old', 'Old Bucket', [lineItem('x', 'X')])],
    });
    const remote = month({
      buckets: [],
      deletedBucketIds: ['b-old'],
      deletedLineItemIds: ['x'],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.buckets.map(b => b.id)).not.toContain('b-old');
    expect(merged.deletedBucketIds).toContain('b-old');
  });

  it('tombstones union monotonically — neither side can resurrect the dead', () => {
    const local = month({ deletedLineItemIds: ['a'] });
    const remote = month({ deletedLineItemIds: ['b'] });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.deletedLineItemIds!.sort()).toEqual(['a', 'b']);
  });

  it('partner edits to shared line items (amounts) are applied', () => {
    const local = month({
      buckets: [bucket('b1', 'Food', [lineItem('groceries', 'Groceries', 50_000)])],
    });
    const remote = month({
      buckets: [bucket('b1', 'Food', [lineItem('groceries', 'Groceries', 75_000)])],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.buckets[0].lineItems[0].plannedAmount).toBe(75_000);
  });

  it('partner additions appear in the merged result', () => {
    const local = month({
      buckets: [bucket('b1', 'Food', [lineItem('groceries', 'Groceries')])],
    });
    const remote = month({
      buckets: [
        bucket('b1', 'Food', [lineItem('groceries', 'Groceries'), lineItem('dining', 'Dining Out')]),
        bucket('b2', 'Travel', [lineItem('flights', 'Flights')]),
      ],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    const food = merged.buckets.find(b => b.id === 'b1')!;
    expect(food.lineItems.map(li => li.id)).toContain('dining');
    expect(merged.buckets.map(b => b.id)).toContain('b2');
  });

  it('deleting a transaction still works (existing tombstone behavior)', () => {
    const local = month({
      transactions: [transaction('t1', 'li1', 'b1'), transaction('t2', 'li1', 'b1')],
      deletedTxIds: ['t1'],
    });
    const remote = month({
      transactions: [transaction('t1', 'li1', 'b1')],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.transactions.map(t => t.id)).toEqual(['t2']);
    expect(merged.deletedTxIds).toContain('t1');
  });

  it('partner transaction attribution is preserved', () => {
    // Wife logged a transaction; it should arrive with her attribution intact
    const local = month({ transactions: [] });
    const remote = month({
      transactions: [{ ...transaction('t-wife', 'li1', 'b1'), partnerPubkey: 'wife-pubkey' }],
    });

    const merged = mergeMonthlyBudgets(local, remote);
    expect(merged.transactions.find(t => t.id === 't-wife')?.partnerPubkey).toBe('wife-pubkey');
  });
});
