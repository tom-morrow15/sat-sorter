/**
 * budgetSelectors — the single source of truth for every derived budget figure.
 *
 * WHY THIS EXISTS
 * ---------------
 * Sat Sorter stores amounts natively in sats, but most users author and read
 * their budgets in USD. Previously, different screens each did their own
 * sats↔USD conversion math, which produced inconsistent numbers (the Home
 * screen, the Breakdown screen, and the Maple AI assistant could each report a
 * slightly different "spent" total for the same month).
 *
 * To fix that, ALL spending/budget derivations now flow through this module.
 * Every figure is computed from the USD source-of-truth when available
 * (`amountUsd` / `plannedAmountUsd`) and only falls back to converting stored
 * sats when a USD value was never recorded.
 *
 * ROUNDING POLICY
 * ---------------
 * USD figures are rounded to whole cents (2 decimal places) using
 * `roundUsd()`. We round only at the leaf level (per transaction, per line
 * item) and then sum the rounded values, so a category total always equals the
 * sum of the rounded line items the user sees — no penny drift between views.
 */

import type { Bucket, LineItem, MonthlyBudget, Transaction } from './budgetTypes';
import { getLineItemUsdAmount } from './budgetTypes';
import { getTransactionAssignments } from './splitUtils';

const SATS_PER_BTC = 100_000_000;

/** Round a USD value to whole cents. */
export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Convert sats to USD (unrounded). */
function satsToUsdRaw(sats: number, btcPrice: number): number {
  return (sats / SATS_PER_BTC) * btcPrice;
}

/**
 * The exact USD amount of a single transaction. Prefers the stored USD value
 * (source of truth — never drifts as the BTC price moves) and only converts
 * from sats for legacy/wallet transactions that were never authored in USD.
 */
export function transactionUsd(t: Transaction, btcPrice: number): number {
  if (t.amountUsd && t.amountUsd > 0) return roundUsd(t.amountUsd);
  if (btcPrice > 0) return roundUsd(satsToUsdRaw(t.amount, btcPrice));
  return 0;
}

/**
 * The planned USD amount for a line item (source-of-truth aware).
 */
export function lineItemBudgetedUsd(li: LineItem, btcPrice: number): number {
  return roundUsd(getLineItemUsdAmount(li, btcPrice));
}

/**
 * USD spent against a specific line item — split-aware. A split transaction
 * contributes only the portion(s) assigned to this line item.
 */
export function lineItemSpentUsd(
  lineItemId: string,
  transactions: Transaction[],
  btcPrice: number
): number {
  let total = 0;
  for (const t of transactions) {
    if (t.isIncome) continue;
    for (const a of getTransactionAssignments(t)) {
      if (a.lineItemId !== lineItemId) continue;
      if (a.amountUsd && a.amountUsd > 0) {
        total += a.amountUsd;
      } else if (btcPrice > 0) {
        total += satsToUsdRaw(a.amountSats, btcPrice);
      }
    }
  }
  return roundUsd(total);
}

export interface LineItemDerived {
  id: string;
  name: string;
  budgetedUsd: number;
  spentUsd: number;
  remainingUsd: number; // can be negative (over budget)
  percentUsed: number; // 0 when nothing is budgeted (never NaN)
  isOverBudget: boolean;
}

export interface BucketDerived {
  id: string;
  name: string;
  color: string;
  icon: string;
  isIncome: boolean;
  budgetedUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
  isOverBudget: boolean;
  lineItems: LineItemDerived[];
}

/**
 * Safely compute a "percent used" value. Returns 0 (never NaN/Infinity) when
 * nothing has been budgeted, so the UI never shows "NaN%".
 */
export function percentUsed(spent: number, budgeted: number): number {
  if (!budgeted || budgeted <= 0) return 0;
  return Math.round((spent / budgeted) * 100);
}

/** Derive all figures for a single line item. */
export function deriveLineItem(
  li: LineItem,
  transactions: Transaction[],
  btcPrice: number
): LineItemDerived {
  const budgetedUsd = lineItemBudgetedUsd(li, btcPrice);
  const spentUsd = lineItemSpentUsd(li.id, transactions, btcPrice);
  const remainingUsd = roundUsd(budgetedUsd - spentUsd);
  return {
    id: li.id,
    name: li.name,
    budgetedUsd,
    spentUsd,
    remainingUsd,
    percentUsed: percentUsed(spentUsd, budgetedUsd),
    isOverBudget: remainingUsd < 0,
  };
}

/** Derive all figures for a single bucket (and its line items). */
export function deriveBucket(
  bucket: Bucket,
  transactions: Transaction[],
  btcPrice: number
): BucketDerived {
  const lineItems = bucket.lineItems.map((li) =>
    deriveLineItem(li, transactions, btcPrice)
  );
  // Sum the already-rounded leaf values so totals match what the user sees.
  const budgetedUsd = roundUsd(
    lineItems.reduce((s, li) => s + li.budgetedUsd, 0)
  );
  const spentUsd = roundUsd(lineItems.reduce((s, li) => s + li.spentUsd, 0));
  const remainingUsd = roundUsd(budgetedUsd - spentUsd);
  return {
    id: bucket.id,
    name: bucket.name,
    color: bucket.color,
    icon: bucket.icon,
    isIncome: bucket.isIncome,
    budgetedUsd,
    spentUsd,
    remainingUsd,
    percentUsed: percentUsed(spentUsd, budgetedUsd),
    isOverBudget: remainingUsd < 0,
    lineItems,
  };
}

export interface BudgetTotals {
  incomeUsd: number;
  plannedUsd: number;
  spentUsd: number;
  remainingToBudgetUsd: number; // income - planned (zero-based budgeting target)
  remainingToSpendUsd: number; // planned - spent
  buckets: BucketDerived[];
  expenseBuckets: BucketDerived[];
  incomeBuckets: BucketDerived[];
}

/**
 * Derive ALL budget totals for a month. This is the canonical computation that
 * the Home dashboard, the Breakdown page, and the Maple AI context all consume,
 * guaranteeing they always agree.
 */
export function deriveBudgetTotals(
  budget: MonthlyBudget,
  btcPrice: number
): BudgetTotals {
  const buckets = budget.buckets.map((b) =>
    deriveBucket(b, budget.transactions, btcPrice)
  );
  const incomeBuckets = buckets.filter((b) => b.isIncome);
  const expenseBuckets = buckets.filter((b) => !b.isIncome);

  const incomeUsd = roundUsd(
    incomeBuckets.reduce((s, b) => s + b.budgetedUsd, 0)
  );
  const plannedUsd = roundUsd(
    expenseBuckets.reduce((s, b) => s + b.budgetedUsd, 0)
  );
  const spentUsd = roundUsd(
    expenseBuckets.reduce((s, b) => s + b.spentUsd, 0)
  );

  return {
    incomeUsd,
    plannedUsd,
    spentUsd,
    remainingToBudgetUsd: roundUsd(incomeUsd - plannedUsd),
    remainingToSpendUsd: roundUsd(plannedUsd - spentUsd),
    buckets,
    expenseBuckets,
    incomeBuckets,
  };
}
