// Maple AI Budget Buddy – BYOK (Bring Your Own Key)
// All data sent to Maple is anchored in exact USD values stored locally.

import type { Bucket, Transaction, MonthlyBudget } from '@/lib/budgetTypes';
import {
  calculateBucketTotalUsd,
  calculateTotalIncomeUsd,
  calculateTotalExpensesUsd,
  getTransactionUsdAmount,
  getLineItemUsdAmount,
  calculateSpentForLineItem,
} from '@/lib/budgetTypes';

export interface BudgetCategoryContext {
  name: string;
  budgeted_usd: number;
  spent_usd: number;
  remaining_usd: number;
  percent_used: number;
}

export interface BudgetTransactionContext {
  category: string;
  amount_usd: number;
  note: string;
  date: string;
}

export interface BudgetContext {
  month: string;
  btc_price_usd: number;
  income_usd: number;
  planned_budget_usd: number;
  total_spent_usd: number;
  total_remaining_usd: number;
  categories: BudgetCategoryContext[];
  recent_transactions: BudgetTransactionContext[];
  user_evergreen_context: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SpendIntent {
  amount: number;
  category: string;
}

export function isEnabled(
  apiKey: string | null,
  enabledToggle: boolean
): boolean {
  return !!apiKey && apiKey.length > 0 && enabledToggle;
}

/**
 * Build a BudgetContext from the current monthly budget.
 * All financial figures are USD-anchored — they come directly from stored
 * usd fields or from helper functions that derive them from USD values.
 */
export function buildBudgetContext(
  month: string,
  budget: MonthlyBudget,
  btcPrice: number,
  evergreenContext: string
): BudgetContext {
  // ── Income ──
  const incomeBuckets = budget.buckets.filter((b) => b.isIncome);
  const income_usd = incomeBuckets.reduce((sum, b) => {
    return sum + calculateBucketTotalUsd(b, btcPrice);
  }, 0);

  // ── Expense aggregates ──
  const expenseBuckets = budget.buckets.filter((b) => !b.isIncome);
  const planned_budget_usd = expenseBuckets.reduce((sum, b) => {
    return sum + calculateBucketTotalUsd(b, btcPrice);
  }, 0);

  const total_spent_usd = budget.transactions
    .filter((t) => !t.isIncome)
    .reduce((sum, t) => {
      return sum + getTransactionUsdAmount(t, btcPrice);
    }, 0);

  const total_remaining_usd = planned_budget_usd - total_spent_usd;

  // ── Per-category data ──
  const categories: BudgetCategoryContext[] = expenseBuckets
    .map((bucket) => {
      const budgeted_usd = bucket.lineItems
        .filter((li) => {
          return !li.name.toLowerCase().includes('income');
        })
        .reduce((sum, li) => {
          return sum + getLineItemUsdAmount(li, btcPrice);
        }, 0);

      const spent_usd = bucket.lineItems.reduce((sum, li) => {
        // Only count transactions assigned to this line item
        const spent = budget.transactions
          .filter((t) => t.lineItemId === li.id && !t.isIncome)
          .reduce((txSum, t) => {
            return txSum + getTransactionUsdAmount(t, btcPrice);
          }, 0);
        return sum + spent;
      }, 0);

      const remaining_usd = budgeted_usd - spent_usd;
      const percent_used =
        budgeted_usd > 0
          ? Math.min(100, Math.round((spent_usd / budgeted_usd) * 100))
          : 0;

      return {
        name: bucket.name,
        budgeted_usd: Math.round(budgeted_usd * 100) / 100,
        spent_usd: Math.round(spent_usd * 100) / 100,
        remaining_usd: Math.round(remaining_usd * 100) / 100,
        percent_used,
      };
    })
    .filter((c) => c.budgeted_usd > 0 || c.spent_usd > 0)
    .sort((a, b) => b.budgeted_usd - a.budgeted_usd);

  // ── Recent transactions (last 15 non-income) ──
  const recent_transactions: BudgetTransactionContext[] = budget.transactions
    .filter((t) => !t.isIncome)
    .slice(-15)
    .reverse()
    .map((t) => {
      const bucket = budget.buckets.find((b) => b.id === t.bucketId);
      return {
        category: bucket?.name || 'Unassigned',
        amount_usd: Math.round(getTransactionUsdAmount(t, btcPrice) * 100) / 100,
        note: t.description || 'No description',
        date: t.date ? t.date.split('T')[0] : '',
      };
    });

  // Month label
  const [yearStr, monthStr] = month.split('-');
  const monthLabel = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1
  ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return {
    month: monthLabel,
    btc_price_usd: Math.round(btcPrice * 100) / 100,
    income_usd: Math.round(income_usd * 100) / 100,
    planned_budget_usd: Math.round(planned_budget_usd * 100) / 100,
    total_spent_usd: Math.round(total_spent_usd * 100) / 100,
    total_remaining_usd: Math.round(total_remaining_usd * 100) / 100,
    categories,
    recent_transactions,
    user_evergreen_context: evergreenContext.trim(),
  };
}

const INSIGHTS_SYSTEM_PROMPT = `You are Maple, a privacy-first Bitcoin budgeting assistant inside Sat Sorter. The user budgets in USD but thinks in sats. Analyze their monthly category summary and recent transactions. Provide 2–3 concise, actionable observations: spending pace, any categories at risk of overspending, and one Bitcoin-themed tip (e.g., 'If you finish under budget in Food, you could stack an extra X sats'). Keep under 120 words.`;

const CHAT_SYSTEM_PROMPT = `You are Maple, the Budget Buddy inside Sat Sorter. You have access to the user's current monthly budget summary, recent transactions, and their evergreen context. Tailor all advice through the evergreen context when relevant. Answer helpfully, concisely, and in a friendly tone. Default to USD but feel free to mention sats using the provided btc_price_usd. If a purchase would overspend a category, warn them and suggest moving funds from another category with surplus. Only use data provided in context.`;

const MAPLE_API_URL = 'https://api.tryimaple.ai/v1/chat/completions';

async function callMaple(
  apiKey: string,
  systemPrompt: string,
  context: BudgetContext,
  history: ChatMessage[],
  maxTokens = 512
): Promise<string> {
  const response = await fetch(MAPLE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`,
        },
        ...history,
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw response;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function analyzeMonth(
  apiKey: string,
  context: BudgetContext
): Promise<string> {
  return callMaple(apiKey, INSIGHTS_SYSTEM_PROMPT, context, [], 300);
}

export async function chatWithMaple(
  apiKey: string,
  context: BudgetContext,
  history: ChatMessage[]
): Promise<string> {
  return callMaple(apiKey, CHAT_SYSTEM_PROMPT, context, history, 512);
}

export async function testKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(MAPLE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 5,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Parse a spend intent from free-form user text.
 * Looks for patterns like:
 *   - "Can I spend $80 on Food?"
 *   - "spend 120 on Groceries"
 *   - "$45 for Dining"
 *   - "buy 30 Entertainment"
 */
export function parseSpendIntent(text: string): SpendIntent | null {
  const cleaned = text.toLowerCase().trim();

  // Regex 1: "$X on Y" or "$X for Y" or "$X in Y"
  const dollarAmount = /\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd)?\s*(?:on|for|in|to|at)\s+([a-zA-Z\s]+)/i;
  const match1 = cleaned.match(dollarAmount);
  if (match1) {
    return {
      amount: parseFloat(match1[1]),
      category: match1[2].trim(),
    };
  }

  // Regex 2: "spend X on Y" or "buy X Y"
  const spendVerb = /(?:spend|buy|purchase|get)\s+\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd)?\s*(?:on|for|of)?\s+([a-zA-Z\s]+)/i;
  const match2 = cleaned.match(spendVerb);
  if (match2) {
    return {
      amount: parseFloat(match2[1]),
      category: match2[2].trim(),
    };
  }

  // Regex 3: "X on Y" (looser, only if the text is short)
  const loose = /\$?\s*(\d+(?:\.\d{1,2})?)\s*[a-zA-Z]*\s+([a-zA-Z\s]{2,})/i;
  if (cleaned.length < 60) {
    const match3 = cleaned.match(loose);
    if (match3) {
      return {
        amount: parseFloat(match3[1]),
        category: match3[2].trim(),
      };
    }
  }

  return null;
}

/**
 * Match a category string against actual bucket names.
 * Returns the matched bucket name or null.
 */
export function findCategory(
  categoryGuess: string,
  buckets: Bucket[]
): Bucket | null {
  const normalized = categoryGuess.toLowerCase().trim();
  const expenseBuckets = buckets.filter((b) => !b.isIncome);

  // Exact match first
  for (const bucket of expenseBuckets) {
    if (bucket.name.toLowerCase() === normalized) {
      return bucket;
    }
  }

  // Substring match
  for (const bucket of expenseBuckets) {
    const nameLower = bucket.name.toLowerCase();
    if (
      nameLower.includes(normalized) ||
      normalized.includes(nameLower)
    ) {
      return bucket;
    }
  }

  // Line-item name match
  for (const bucket of expenseBuckets) {
    for (const li of bucket.lineItems) {
      const liLower = li.name.toLowerCase();
      if (
        liLower === normalized ||
        liLower.includes(normalized) ||
        normalized.includes(liLower)
      ) {
        return bucket;
      }
    }
  }

  return null;
}

/**
 * Get the remaining budget for a bucket in USD.
 */
export function getBucketRemainingUsd(
  bucket: Bucket,
  transactions: Transaction[],
  btcPrice: number
): number {
  const budgeted = bucket.lineItems.reduce((sum, li) => {
    return sum + getLineItemUsdAmount(li, btcPrice);
  }, 0);

  const spent = bucket.lineItems.reduce((sum, li) => {
    // line-item spending includes transactions assigned to this line item
    const lineSpent = transactions
      .filter((t) => t.lineItemId === li.id && !t.isIncome)
      .reduce((txSum, t) => {
        return txSum + getTransactionUsdAmount(t, btcPrice);
      }, 0);
    return sum + lineSpent;
  }, 0);

  return budgeted - spent;
}

/**
 * Format a Maple API error into a user-facing message.
 */
export function getMapleErrorMessage(error: unknown): string {
  if (error instanceof Response) {
    if (error.status === 401) {
      return 'Invalid Maple API key. Check Settings.';
    }
    if (error.status === 429) {
      return 'Maple rate limit hit. Please wait a moment.';
    }
    return `Maple API error (${error.status}). Please try again.`;
  }
  if (error instanceof Error) {
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network')
    ) {
      return "Can't reach Maple. Check your connection.";
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
