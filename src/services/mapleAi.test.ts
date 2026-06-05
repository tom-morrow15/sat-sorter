import { describe, it, expect, vi } from 'vitest';
import {
  isEnabled,
  buildBudgetContext,
  parseSpendIntent,
  findCategory,
  getMapleErrorMessage,
  testKey,
  type BudgetContext,
} from './mapleAi';
import type { MonthlyBudget, Bucket } from '@/lib/budgetTypes';

const btcPrice = 100_000;

function makeBudget(buckets: Bucket[]): MonthlyBudget {
  return {
    id: 'm1',
    month: '2026-04',
    buckets,
    transactions: [],
  };
}

const incomeBucket: Bucket = {
  id: 'b0',
  name: 'Income',
  color: '#22c55e',
  icon: 'wallet',
  isIncome: true,
  order: 0,
  lineItems: [
    { id: 'li0', name: 'Salary', plannedAmount: 3_712_000_000, plannedAmountUsd: 3712, order: 0 },
  ],
};

const housingBucket: Bucket = {
  id: 'b1',
  name: 'Housing',
  color: '#3b82f6',
  icon: 'home',
  isIncome: false,
  order: 1,
  lineItems: [
    { id: 'li1', name: 'Rent', plannedAmount: 1_500_000_000, plannedAmountUsd: 1500, order: 0 },
  ],
};

const foodBucket: Bucket = {
  id: 'b2',
  name: 'Food',
  color: '#f59e0b',
  icon: 'utensils',
  isIncome: false,
  order: 2,
  lineItems: [
    { id: 'li2', name: 'Groceries', plannedAmount: 400_000_000, plannedAmountUsd: 400, order: 0 },
    { id: 'li3', name: 'Restaurants', plannedAmount: 200_000_000, plannedAmountUsd: 200, order: 1 },
  ],
};

describe('isEnabled', () => {
  it('returns false when no key', () => {
    expect(isEnabled(null, true)).toBe(false);
    expect(isEnabled('', true)).toBe(false);
  });

  it('returns false when toggle is off', () => {
    expect(isEnabled('sk-123', false)).toBe(false);
  });

  it('returns true when key exists and toggle is on', () => {
    expect(isEnabled('sk-123', true)).toBe(true);
  });
});

describe('buildBudgetContext', () => {
  it('returns exact stored USD values', () => {
    const budget = makeBudget([incomeBucket, housingBucket, foodBucket]);
    const ctx = buildBudgetContext('2026-04', budget, btcPrice, '');

    expect(ctx.btc_price_usd).toBe(100_000);
    expect(ctx.income_usd).toBe(3712);
    expect(ctx.planned_budget_usd).toBe(1500 + 400 + 200);

    const housing = ctx.categories.find((c) => c.name === 'Housing');
    expect(housing).toBeDefined();
    expect(housing!.budgeted_usd).toBe(1500);
  });

  it('includes recent transactions', () => {
    const budget = makeBudget([incomeBucket, housingBucket]);
    budget.transactions = [
      {
        id: 't1',
        amount: 5_000_000,
        amountUsd: 50,
        description: 'Pharmacy',
        date: '2026-04-12T10:00:00Z',
        lineItemId: 'li1',
        bucketId: 'b1',
        isIncome: false,
      },
    ];

    const ctx = buildBudgetContext('2026-04', budget, btcPrice, '');
    expect(ctx.recent_transactions).toHaveLength(1);
    expect(ctx.recent_transactions[0].amount_usd).toBe(50);
    expect(ctx.recent_transactions[0].note).toBe('Pharmacy');
    expect(ctx.recent_transactions[0].date).toBe('2026-04-12');
  });

  it('includes evergreen context', () => {
    const budget = makeBudget([incomeBucket]);
    const ctx = buildBudgetContext('2026-04', budget, btcPrice, 'Save for Japan.');
    expect(ctx.user_evergreen_context).toBe('Save for Japan.');
  });

  it('uses empty string when no evergreen context', () => {
    const budget = makeBudget([incomeBucket]);
    const ctx = buildBudgetContext('2026-04', budget, btcPrice, '');
    expect(ctx.user_evergreen_context).toBe('');
  });

  it('never derives budgeted_usd from sats stored amounts', () => {
    // Test that plannedAmount (sats) is not used when plannedAmountUsd is present
    const bucket = { ...housingBucket };
    bucket.lineItems = [
      { id: 'lit', name: 'Test', plannedAmount: 1_000_000_000, plannedAmountUsd: 250, order: 0 },
    ];
    const budget = makeBudget([bucket]);
    const ctx = buildBudgetContext('2026-04', budget, btcPrice, '');
    const cat = ctx.categories[0];
    expect(cat.budgeted_usd).toBe(250); // from USD, not from 10M sats
  });
});

describe('parseSpendIntent', () => {
  it('extracts $80 and Food from "Can I spend $80 on Food?"', () => {
    const result = parseSpendIntent('Can I spend $80 on Food?');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(80);
    expect(result!.category).toBe('food');
  });

  it('extracts from plain "$45 on groceries"', () => {
    const result = parseSpendIntent('$45 on groceries');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(45);
    expect(result!.category).toBe('groceries');
  });

  it('extracts from "spend 120 on Utilities"', () => {
    const result = parseSpendIntent('spend 120 on Utilities');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(120);
    expect(result!.category).toBe('utilities');
  });

  it('extracts from "$45 for Dining"', () => {
    const result = parseSpendIntent('Can I spend $45 for Dining?');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(45);
    expect(result!.category).toMatch(/dining/);
  });

  it('returns null for unrelated text', () => {
    const result = parseSpendIntent('What is the weather today?');
    expect(result).toBeNull();
  });

  it('handles decimal amounts', () => {
    const result = parseSpendIntent('$149.99 on Electronics');
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(149.99);
  });
});

describe('findCategory', () => {
  const buckets: Bucket[] = [housingBucket, foodBucket];

  it('matches exact bucket name', () => {
    const result = findCategory('Housing', buckets);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Housing');
  });

  it('matches line item name', () => {
    const result = findCategory('Groceries', buckets);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Food');
  });

  it('matches partial name', () => {
    const result = findCategory('Grocer', buckets);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Food');
  });

  it('returns null for unknown category', () => {
    const result = findCategory('Vacation', buckets);
    expect(result).toBeNull();
  });
});

describe('getMapleErrorMessage', () => {
  it('returns 401 message', () => {
    const err = new Response('', { status: 401 });
    expect(getMapleErrorMessage(err)).toBe('Invalid Maple API key. Check Settings.');
  });

  it('returns 429 message', () => {
    const err = new Response('', { status: 429 });
    expect(getMapleErrorMessage(err)).toBe('Maple rate limit hit. Please wait a moment.');
  });

  it('returns generic 500 message', () => {
    const err = new Response('', { status: 500 });
    expect(getMapleErrorMessage(err)).toBe('Maple API error (500). Please try again.');
  });

  it('returns network message for network Error', () => {
    const err = new Error('Network error');
    expect(getMapleErrorMessage(err)).toBe('An unexpected error occurred. Please try again.');
  });

  it('returns generic for unknown', () => {
    expect(getMapleErrorMessage('random')).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('testKey', () => {
  const PROXY = 'http://localhost:8080/v1';

  it('returns error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await testKey('sk-bad', PROXY);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Cannot reach Maple Proxy');
  });

  it('returns ok on 200 with streaming body', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, { status: 200 })
    );
    const result = await testKey('sk-good', PROXY);
    expect(result.ok).toBe(true);
  });

  it('returns 401 error for invalid key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const result = await testKey('sk-bad', PROXY);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid Maple API key');
  });

  it('returns helpful error when proxy is down', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await testKey('sk-test', PROXY);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('localhost:8080');
  });
});
