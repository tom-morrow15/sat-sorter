import { describe, expect, it } from 'vitest';
import { normalizeBudgetState, type BudgetState, type MonthlyBudget } from '@/lib/budgetTypes';
import {
  guestBudgetHasContent,
  mergeGuestBudgetStates,
  reconcileGuestBudget,
} from '@/lib/guestBudgetSync';

function month(id: string, name: string, updatedAt?: number): MonthlyBudget {
  return {
    id,
    month: '2026-11',
    updatedAt,
    buckets: [{
      id,
      name,
      color: '#D9662E',
      icon: 'wallet',
      order: 0,
      isIncome: false,
      lineItems: [],
    }],
    transactions: [],
  };
}

function state(budgets: MonthlyBudget[], currency: BudgetState['currency'] = 'sats'): BudgetState {
  return normalizeBudgetState({
    currentMonth: '2026-11',
    currency,
    budgets,
    accessibleBudgets: [],
  });
}

describe('reconcileGuestBudget', () => {
  it('keeps both sides empty without writing', () => {
    const local = state([]);
    const result = reconcileGuestBudget(local, { empty: true, revision: 0 });
    expect(result.write).toBe(false);
    expect(guestBudgetHasContent(result.state)).toBe(false);
  });

  it('seeds an empty Umbrel store from a browser guest budget', () => {
    const local = state([month('rent', 'Rent', 10)]);
    const result = reconcileGuestBudget(local, { empty: true, revision: 0 });
    expect(result.write).toBe(true);
    expect(result.state.budgets[0].buckets[0].name).toBe('Rent');
  });

  it('loads the Umbrel budget into a browser that has none', () => {
    const remote = state([month('food', 'Food', 10)]);
    const result = reconcileGuestBudget(state([]), { empty: false, revision: 3, state: remote });
    expect(result.write).toBe(false);
    expect(result.state.budgets[0].buckets[0].name).toBe('Food');
  });

  it('merges when the browser and the Umbrel both have budgets', () => {
    const local = state([month('rent', 'Rent', 20), {
      ...month('food', 'Groceries', 5),
      id: '2026-10',
      month: '2026-10',
    }]);
    const remote = state([month('rent', 'Rent renamed', 10), {
      ...month('fun', 'Fun', 30),
      id: '2026-12',
      month: '2026-12',
    }]);
    const result = reconcileGuestBudget(local, { empty: false, revision: 2, state: remote });
    const names = result.state.budgets.flatMap((entry) => entry.buckets.map((bucket) => bucket.name));
    expect(result.write).toBe(true);
    expect(names).toEqual(expect.arrayContaining(['Rent', 'Groceries', 'Fun']));
  });

  it('does not let an empty browser erase a stored guest budget', () => {
    const remote = state([month('rent', 'Rent', 10)]);
    const result = reconcileGuestBudget(state([]), { empty: false, revision: 1, state: remote });
    expect(guestBudgetHasContent(result.state)).toBe(true);
    expect(result.write).toBe(false);
  });
});

describe('mergeGuestBudgetStates', () => {
  it('keeps a transaction that exists on only one device', () => {
    const local = state([{
      ...month('rent', 'Rent', 50),
      transactions: [{
        id: 'tx-local',
        date: '2026-11-02',
        description: 'Local only',
        amount: 1000,
        isIncome: false,
        bucketId: 'rent',
        lineItemId: null,
      }],
    }]);
    const remote = state([{
      ...month('rent', 'Rent', 40),
      transactions: [{
        id: 'tx-remote',
        date: '2026-11-03',
        description: 'Other device',
        amount: 2000,
        isIncome: false,
        bucketId: 'rent',
        lineItemId: null,
      }],
    }]);
    const merged = mergeGuestBudgetStates(local, remote);
    const ids = merged.budgets[0].transactions.map((transaction) => transaction.id);
    expect(ids).toEqual(expect.arrayContaining(['tx-local', 'tx-remote']));
  });
});
