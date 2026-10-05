import { describe, expect, it } from 'vitest';
import type { MonthlyBudget } from './budgetTypes';
import {
  acceptInvite,
  applyNotes,
  diffAgainstBase,
  extrasAgainstBase,
  leaveBudget,
  noteIsActive,
  reduceBudget,
  revokeInvite,
  type BudgetNote,
  type Membership,
} from './budgetThread';

const OWNER = 'owner';
const WIFE = 'wife';

function note(partial: Partial<BudgetNote> & Pick<BudgetNote, 'id' | 'at' | 'op' | 'entity' | 'entityId'>): BudgetNote {
  return {
    budgetId: 'home',
    month: '2026-10',
    authorPubkey: OWNER,
    ...partial,
  };
}

function membership(): Membership {
  return {
    ownerPubkey: OWNER,
    active: [{ pubkey: WIFE, at: 100 }],
    pending: [{ pubkey: 'pending', at: 50 }],
    revoked: [],
    former: [],
  };
}

describe('budget thread', () => {
  it('keeps the later line amount and does not rewind it from an older backup', () => {
    const older = note({
      id: 'a',
      at: 1,
      op: 'upsert',
      entity: 'line',
      entityId: 'dtv',
      bucketId: 'bills',
      lineItem: { id: 'dtv', name: 'DIRECTV', plannedAmount: 127000, plannedAmountUsd: 127, order: 0 },
    });
    const newer = note({
      id: 'b',
      at: 2,
      op: 'upsert',
      entity: 'line',
      entityId: 'dtv',
      bucketId: 'bills',
      authorPubkey: WIFE,
      lineItem: { id: 'dtv', name: 'DIRECTV', plannedAmount: 93000, plannedAmountUsd: 93, order: 0 },
    });
    const budgets = reduceBudget(
      [{ authorPubkey: OWNER, budgets: applyNotes([], [older]), appliedNoteIds: ['a'] }],
      [older, newer],
    );
    const line = budgets[0].buckets[0].lineItems[0];
    expect(line.plannedAmountUsd).toBe(93);
  });

  it('applies the same note only once', () => {
    const add = note({
      id: 'tx1',
      at: 5,
      op: 'upsert',
      entity: 'transaction',
      entityId: 'groceries',
      authorPubkey: WIFE,
      transaction: {
        id: 'groceries',
        amount: 4000,
        amountUsd: 40,
        description: 'Groceries',
        date: '2026-10-04',
        lineItemId: 'food',
        bucketId: 'spend',
        isIncome: false,
        partnerPubkey: WIFE,
      },
    });
    const once = applyNotes([], [add, add]);
    expect(once[0].transactions).toHaveLength(1);
    expect(once[0].transactions[0].partnerPubkey).toBe(WIFE);
  });

  it('uses the fuller backup, then plays notes it does not include', () => {
    const first = note({
      id: 'a',
      at: 1,
      op: 'upsert',
      entity: 'line',
      entityId: 'rent',
      bucketId: 'bills',
      lineItem: { id: 'rent', name: 'Rent', plannedAmount: 100, plannedAmountUsd: 100, order: 0 },
    });
    const second = note({
      id: 'b',
      at: 2,
      op: 'upsert',
      entity: 'line',
      entityId: 'rent',
      bucketId: 'bills',
      lineItem: { id: 'rent', name: 'Rent', plannedAmount: 110, plannedAmountUsd: 110, order: 0 },
    });
    const budgets = reduceBudget(
      [
        { authorPubkey: WIFE, budgets: [], appliedNoteIds: [] },
        { authorPubkey: OWNER, budgets: applyNotes([], [first]), appliedNoteIds: ['a'] },
      ],
      [first, second],
    );
    expect(budgets[0].buckets[0].lineItems[0].plannedAmountUsd).toBe(110);
  });

  it('ignores notes from a partner after they leave, and keeps earlier ones', () => {
    const members = leaveBudget(membership(), WIFE, 200);
    const before = note({ id: 'before', at: 150, op: 'delete', entity: 'line', entityId: 'hulu', authorPubkey: WIFE });
    const after = note({ id: 'after', at: 250, op: 'delete', entity: 'line', entityId: 'netflix', authorPubkey: WIFE });
    expect(noteIsActive(members, before)).toBe(true);
    expect(noteIsActive(members, after)).toBe(false);
  });

  it('does not let a revoked invite become a partner', () => {
    const revoked = revokeInvite(membership(), 'pending', 80);
    const accepted = acceptInvite(revoked, 'pending', 90);
    expect(accepted.active.some((member) => member.pubkey === 'pending')).toBe(false);
    expect(accepted.pending).toHaveLength(0);
  });

  it('keeps a transaction that exists only on one phone during migration', () => {
    const base: MonthlyBudget[] = [{ id: '2027-01', month: '2027-01', buckets: [], transactions: [] }];
    const local: MonthlyBudget[] = [{
      id: '2027-01',
      month: '2027-01',
      buckets: [],
      transactions: [{
        id: 'only-hers',
        amount: 2500,
        amountUsd: 25,
        description: 'Coffee',
        date: '2027-01-02',
        lineItemId: null,
        bucketId: null,
        isIncome: false,
        partnerPubkey: WIFE,
      }],
    }];
    const notes = diffAgainstBase(base, local, WIFE, 'home', 10);
    const budgets = reduceBudget([{ authorPubkey: OWNER, budgets: base, appliedNoteIds: [] }], notes);
    expect(budgets.find((month) => month.month === '2027-01')?.transactions.map((tx) => tx.id)).toContain('only-hers');
  });

  it('does not delete his line items when her phone is missing them', () => {
    const base: MonthlyBudget[] = [{
      id: '2026-10',
      month: '2026-10',
      buckets: [{
        id: 'bills',
        name: 'Bills',
        color: '#888',
        icon: 'home',
        isIncome: false,
        order: 0,
        lineItems: [{ id: 'dtv', name: 'DIRECTV', plannedAmount: 127, plannedAmountUsd: 127, order: 0 }],
      }],
      transactions: [],
      updatedAt: 50,
    }];
    const local: MonthlyBudget[] = [{
      id: '2026-10',
      month: '2026-10',
      buckets: [],
      transactions: [],
      updatedAt: 10,
    }];
    const notes = extrasAgainstBase(base, local, WIFE, 'home', 60);
    expect(notes.some((note) => note.op === 'delete')).toBe(false);
    const budgets = applyNotes(base, notes);
    expect(budgets[0].buckets[0].lineItems[0].name).toBe('DIRECTV');
  });
});
