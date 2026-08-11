// Maple AI Budget Buddy – BYOK (Bring Your Own Key)
// All data sent to Maple is anchored in exact USD values stored locally.

import type { Bucket, Transaction, MonthlyBudget } from '@/lib/budgetTypes';
import { getLineItemUsdAmount } from '@/lib/budgetTypes';
import { getTransactionAssignments } from '@/lib/splitUtils';
import {
  deriveBudgetTotals,
  transactionUsd,
  lineItemSpentUsd,
} from '@/lib/budgetSelectors';

export interface BudgetLineItemContext {
  name: string;
  budgeted_usd: number;
  spent_usd: number;
  remaining_usd: number;
}

export interface BudgetCategoryContext {
  name: string;
  budgeted_usd: number;
  spent_usd: number;
  remaining_usd: number;
  percent_used: number;
  line_items: BudgetLineItemContext[];
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
  // Derive ALL figures from the shared selector so Maple's numbers are
  // guaranteed to match the Home dashboard and the Breakdown screen exactly.
  const totals = deriveBudgetTotals(budget, btcPrice);

  // ── Per-category data, INCLUDING per-line-item breakdown ──
  const categories: BudgetCategoryContext[] = totals.expenseBuckets
    .map((bucket) => {
      const line_items: BudgetLineItemContext[] = bucket.lineItems.map((li) => ({
        name: li.name,
        budgeted_usd: li.budgetedUsd,
        spent_usd: li.spentUsd,
        remaining_usd: li.remainingUsd,
      }));

      return {
        name: bucket.name,
        budgeted_usd: bucket.budgetedUsd,
        spent_usd: bucket.spentUsd,
        remaining_usd: bucket.remainingUsd,
        // Clamp to 100 for the "percent used" label, never NaN.
        percent_used: Math.min(100, bucket.percentUsed),
        line_items,
      };
    })
    .filter((c) => c.budgeted_usd > 0 || c.spent_usd > 0)
    .sort((a, b) => b.budgeted_usd - a.budgeted_usd);

  // ── All transactions this month (split-aware) ──
  const recent_transactions: BudgetTransactionContext[] = budget.transactions
    .filter((t) => !t.isIncome)
    .map((t) => {
      const assignments = getTransactionAssignments(t);
      let category: string;

      if (assignments.length === 0) {
        category = 'Unassigned';
      } else if (assignments.length === 1) {
        const bucket = budget.buckets.find((b) => b.id === assignments[0].bucketId);
        const li = bucket?.lineItems.find((l) => l.id === assignments[0].lineItemId);
        category = li
          ? `${bucket?.name ?? 'Unknown'} › ${li.name}`
          : bucket?.name ?? 'Unassigned';
      } else {
        // Split transaction — clearly show it was split and how
        const parts = assignments
          .map((a) => {
            const bucket = budget.buckets.find((b) => b.id === a.bucketId);
            const li = bucket?.lineItems.find((l) => l.id === a.lineItemId);
            return li ? li.name : bucket?.name ?? 'Unknown';
          })
          .join(' + ');
        category = `${parts} (split)`;
      }

      return {
        category,
        amount_usd: transactionUsd(t, btcPrice),
        note: t.description || 'No description',
        date: t.date ? t.date.split('T')[0] : '',
      };
    })
    // Sort newest first so the most recent activity is at the top of the context
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  // Month label
  const [yearStr, monthStr] = month.split('-');
  const monthLabel = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1
  ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return {
    month: monthLabel,
    btc_price_usd: Math.round(btcPrice * 100) / 100,
    income_usd: totals.incomeUsd,
    planned_budget_usd: totals.plannedUsd,
    total_spent_usd: totals.spentUsd,
    total_remaining_usd: totals.remainingToSpendUsd,
    categories,
    recent_transactions,
    user_evergreen_context: evergreenContext.trim(),
  };
}

const FORMATTING_RULES = `FORMATTING RULES (critical): You are rendered in a narrow mobile chat bubble that does NOT support markdown. Write in plain, conversational sentences. Do NOT use markdown tables, pipes (|), dashes for table rows, asterisks for bold (**), or headers (#). If you need a list, use short lines with a simple dash and a space. Keep numbers inline (e.g., "Food: $120 spent of $200, $80 left").`;

const INSIGHTS_SYSTEM_PROMPT = `You are Maple, a privacy-first Bitcoin budgeting assistant inside Sat Sorter. The user budgets in USD but thinks in sats. You are given a full breakdown of every category AND its line items (each with budgeted_usd, spent_usd, remaining_usd), plus recent transactions. Use the line-item detail — don't just look at category totals. Provide 2–3 concise, actionable observations: spending pace, any line items or categories at risk of overspending, and one Bitcoin-themed tip (e.g., "If you finish under budget in Food, you could stack an extra X sats"). If relevant, mention that they can tap the receipt icon on any line item to see all transactions for it, or use the Transactions tab to filter/search. Keep it under 120 words. ${FORMATTING_RULES}`;

const CHAT_SYSTEM_PROMPT = `You are Maple, the Budget Buddy inside Sat Sorter. You have access to the user's current monthly budget summary, every category broken down into its individual line items (budgeted/spent/remaining), ALL transactions this month, and their evergreen context. 

Important: Transactions may be split across multiple line items. When a transaction has "(split)" in its category, it means the amount was divided across the listed line items. Use this information when reasoning about spending.

Sat Sorter features you can discuss:
- **Transactions Tab**: Users can tap "More" in the bottom nav → Transactions to see all transactions, search, filter by category, or tap the receipt icon next to any line item to jump straight to all transactions for that specific line item.
- **Wealth Tracker**: Users can tap "More" → Wealth Tracker to add Bitcoin addresses and monitor their on-chain BTC holdings over time.
- **Local Spend / BTC Map**: Users can tap "More" → Local Spend to find Bitcoin-accepting merchants near them, organized by category.
- **Payment Methods**: Users can track how they paid (credit card, Lightning, cash, etc.) for spending pattern analysis.
- **Lightning Wallet**: Users can connect a Lightning wallet via Nostr Wallet Connect (NWC) to automatically import and categorize Bitcoin payments.
- **Budget Partners**: Users can share their budget with a partner (spouse, etc.) via a QR code — changes sync automatically.
- **Budget Buddy**: This is you — users can ask you anything about their budget, spending, or the app itself.

Always reason using the line-item level detail, not just category totals — for example, if asked about "coffee", look for a matching line item. Tailor all advice through the evergreen context when relevant. Answer helpfully, concisely, and in a friendly tone. Default to USD but feel free to mention sats using the provided btc_price_usd. If a purchase would overspend a category or line item, warn them and suggest moving funds from another one with surplus. Only use data provided in context. ${FORMATTING_RULES}`;

/**
 * Maple Proxy provides OpenAI-compatible API access to Maple's encrypted models.
 * Requires the Maple Proxy to be running (desktop app or Docker).
 *
 * Direct browser access to https://enclave.trymaple.ai does NOT work because
 * the Enclave backend requires a cryptographic TEE handshake/attestation that
 * only the Maple Proxy can perform.
 *
 * The proxy URL is configurable in Settings:
 * - Default: http://localhost:8080/v1 (Maple desktop app on same machine)
 * - Network: http://<mac-ip>:8080/v1 (proxy on Mac, accessed from phone on home WiFi)
 * - Hosted: https://your-proxy.com/v1 (public proxy deployment)
 */

// Available models from Maple, surfaced to the user as a picker in Budget Buddy.
export interface MapleModelOption {
  id: string;
  label: string;
  description: string;
}

export const MAPLE_MODELS_FALLBACK: MapleModelOption[] = [
  {
    id: 'llama3-3-70b',
    label: 'Llama 3.3 70B',
    description: 'Recommended. Clean, well-formatted answers.',
  },
  {
    id: 'gpt-oss-120b',
    label: 'GPT-OSS 120B',
    description: 'Largest open-source model. Deeper analysis, a bit slower.',
  },
  {
    id: 'kimi-k2-6',
    label: 'Kimi K2',
    description: 'Strong reasoning and coding. Great for complex budget analysis.',
  },
  {
    id: 'gemma-3-27b',
    label: 'Gemma 3 27B',
    description: 'Google open model. Fast and efficient.',
  },
  {
    id: 'qwen-2.5-72b',
    label: 'Qwen 2.5 72B',
    description: 'Alibaba open model. Excellent multilingual support.',
  },
  {
    id: 'auto:quick',
    label: 'Auto (Quick)',
    description: 'Fastest, but formatting can be rougher.',
  },
];

// Default to a model that formats reliably so a user's first impression of the
// AI feature is the clean, correct version (the previous "Auto (Quick)" default
// frequently produced garbled numbers and dropped words).
export const DEFAULT_MAPLE_MODEL = MAPLE_MODELS_FALLBACK[0].id;

/** The default model list used before dynamic models are fetched. */
export const MAPLE_MODELS_DEFAULT = MAPLE_MODELS_FALLBACK;

// Back-compat alias: components previously imported MAPLE_MODELS.
export { MAPLE_MODELS_FALLBACK as MAPLE_MODELS };

/** Build the /models URL from a base proxy URL */
function getModelsUrl(proxyUrl: string): string {
  const base = proxyUrl.replace(/\/+$/, '');
  return `${base}/models`;
}

/**
 * Fetch available models from the provider's /v1/models endpoint.
 * Returns an empty array on failure so the app falls back to the hardcoded list.
 * Tries a CORS proxy fallback if the direct request fails (cross-origin).
 */
export async function fetchMapleModels(
  apiKey: string,
  proxyUrl: string
): Promise<MapleModelOption[]> {
  const url = getModelsUrl(proxyUrl);
  // CORS proxy fallback — used if the direct request fails due to CORS
  const corsProxyUrl = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(url)}`;

  const tryFetch = async (fetchUrl: string): Promise<Response> => {
    return fetch(fetchUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
  };

  try {
    let response = await tryFetch(url);

    // If CORS blocks the direct request, try via the CORS proxy
    if (!response.ok && response.status === 0) {
      response = await tryFetch(corsProxyUrl);
    }

    if (!response.ok) {
      // Try CORS proxy as a second attempt for any failure
      response = await tryFetch(corsProxyUrl);
    }

    if (!response.ok) {
      console.warn('[fetchMapleModels] Non-200 response:', response.status);
      return [];
    }

    const json = await response.json();
    // OpenAI-compatible format: { object: "list", data: [{ id, owned_by, ... }] }
    // Also handle Maple/PPQ format with privacyLevel field
    const rawModels: { id: string; owned_by?: string; privacyLevel?: string }[] = json.data ?? [];
    if (!Array.isArray(rawModels) || rawModels.length === 0) {
      return [];
    }

    const models: MapleModelOption[] = rawModels
      .filter((m) => m.id && typeof m.id === 'string')
      .map((m) => {
        // Build a privacy badge if available (PPQ models include this)
        let description = m.owned_by
          ? `Powered by ${m.owned_by}`
          : '';
        if (m.privacyLevel) {
          const privacyBadge = m.privacyLevel === 'zdr'
            ? 'Zero Data Retention'
            : m.privacyLevel === 'e2e'
            ? 'End-to-End Encrypted'
            : m.privacyLevel === 'anon'
            ? 'Anonymous'
            : '';
          if (privacyBadge) {
            description = description ? `${description} · ${privacyBadge}` : privacyBadge;
          }
        }
        return {
          id: m.id,
          label: m.id
            .replace(/^auto:/, 'Auto: ')
            .replace(/^private\//, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim(),
          description,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return models;
  } catch (err) {
    console.warn('[fetchMapleModels] Error fetching models:', err);
    return [];
  }
}

/** Build the full chat completions URL from a base proxy URL */
function getChatCompletionsUrl(proxyUrl: string): string {
  // Normalize: strip trailing slashes
  const base = proxyUrl.replace(/\/+$/, '');
  // If they already included /chat/completions, use as-is
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

async function callMaple(
  apiKey: string,
  proxyUrl: string,
  systemPrompt: string,
  context: BudgetContext,
  history: ChatMessage[],
  maxTokens = 512,
  model: string = DEFAULT_MAPLE_MODEL,
  zdr: boolean = false
): Promise<string> {
  // Combine system prompt and context into a single system message
  const systemMessage = `${systemPrompt}\n\nContext:\n${JSON.stringify(context)}`;
  
  const messages = [
    {
      role: 'system',
      content: systemMessage,
    },
    ...history,
  ];

  const requestBody: Record<string, unknown> = {
    model: model || DEFAULT_MAPLE_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: maxTokens,
    stream: true, // CRITICAL: Maple REQUIRES streaming
  };

  // PPQ zero-data-retention routing (opt-in per request)
  if (zdr) {
    requestBody.provider = { zdr: true };
  }

  const url = getChatCompletionsUrl(proxyUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Maple API key. Check your key in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited by Maple. Please try again in a moment.');
    }
    
    throw new Error(`Maple API error ${response.status}: ${errorText}`);
  }

  // Handle streaming response with cross-chunk buffering.
  // SSE lines can span across read() boundaries, so we accumulate a buffer
  // and only process complete lines.
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to read Maple response stream');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
            }
          } catch (e) {
            // Ignore parse errors for SSE chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

export async function analyzeMonth(
  apiKey: string,
  proxyUrl: string,
  context: BudgetContext,
  model: string = DEFAULT_MAPLE_MODEL,
  zdr: boolean = false
): Promise<string> {
  return callMaple(apiKey, proxyUrl, INSIGHTS_SYSTEM_PROMPT, context, [], 400, model, zdr);
}

export async function chatWithMaple(
  apiKey: string,
  proxyUrl: string,
  context: BudgetContext,
  history: ChatMessage[],
  model: string = DEFAULT_MAPLE_MODEL,
  zdr: boolean = false
): Promise<string> {
  // Reduce output tokens when history is long to leave room for the prompt.
  const maxTokens = history.length > 20 ? 400 : 600;
  return callMaple(apiKey, proxyUrl, CHAT_SYSTEM_PROMPT, context, history, maxTokens, model, zdr);
}

export async function testKey(
  apiKey: string,
  proxyUrl: string,
  model?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = getChatCompletionsUrl(proxyUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MAPLE_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 10,
        stream: true, // CRITICAL: Maple requires streaming
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'Invalid Maple API key. Check your credentials.' };
      }
      if (response.status === 429) {
        return { ok: false, error: 'Rate limited. Please try again in a moment.' };
      }
      if (response.status >= 500) {
        return { ok: false, error: 'Maple Proxy backend is temporarily unavailable.' };
      }
      const text = await response.text();
      return { ok: false, error: `Maple error ${response.status}: ${text}` };
    }

    // For test, just consume the stream to verify it works
    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, error: 'Failed to read response stream' };
    }

    try {
      // Consume the stream — we don't need the content, just want to
      // verify the connection works end-to-end.
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    return { ok: true };
  } catch (error) {
    let message = 'Unknown error';
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed')) {
        message = `Cannot reach Maple Proxy at ${proxyUrl}. Make sure the Maple app's Local Proxy is running.`;
      } else {
        message = error.message;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }
    console.error('[testKey] Error:', message);
    return { ok: false, error: message };
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
    // line-item spending includes transactions assigned to this line item,
    // accounting for both legacy and split transactions
    return sum + lineItemSpentUsd(li.id, transactions, btcPrice);
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
