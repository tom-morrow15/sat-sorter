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
  income?: boolean;
  payment_method?: string;
  logged_by?: 'budget partner';
  splits?: { line_item: string; amount_usd: number }[];
}

export interface BudgetMonthContext {
  month: string;
  income_usd: number;
  planned_budget_usd: number;
  total_spent_usd: number;
  total_remaining_usd: number;
  left_to_assign_usd: number;
  income_items: { name: string; budgeted_usd: number }[];
  categories: BudgetCategoryContext[];
  transactions: BudgetTransactionContext[];
}

export interface BudgetContext {
  month: string;
  btc_price_usd: number;
  income_usd: number;
  planned_budget_usd: number;
  total_spent_usd: number;
  total_remaining_usd: number;
  left_to_assign_usd: number;
  income_items: { name: string; budgeted_usd: number }[];
  categories: BudgetCategoryContext[];
  recent_transactions: BudgetTransactionContext[];
  /** Every other saved month, past and future, with its plan and transactions. */
  other_months: BudgetMonthContext[];
  payment_methods: string[];
  user_evergreen_context: string;
  // Wealth Tracker data (if available)
  bitcoin_holdings?: BitcoinHoldingContext[];
  total_btc?: number;
  // Local Spend / BTC Map data (if available)
  nearby_merchants?: MerchantContext[];
}

export interface BitcoinHoldingContext {
  address: string;
  balance_btc: number;
  balance_usd: number;
  label?: string;
}

export interface MerchantContext {
  name: string;
  category: string;
  address?: string;
  distance_meters?: number;
  accepts_bitcoin: boolean;
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

function monthLabel(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  return new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1
  ).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function assignmentUsd(amountUsd: number, amountSats: number, btcPrice: number): number {
  if (amountUsd > 0) return Math.round(amountUsd * 100) / 100;
  if (btcPrice > 0) return Math.round((amountSats / 100_000_000) * btcPrice * 100) / 100;
  return 0;
}

function lineLabel(budget: MonthlyBudget, bucketId: string, lineItemId: string): string {
  const bucket = budget.buckets.find((b) => b.id === bucketId);
  const li = bucket?.lineItems.find((l) => l.id === lineItemId);
  if (li && bucket) return `${bucket.name} › ${li.name}`;
  return li?.name || bucket?.name || 'Unassigned';
}

function transactionsFor(budget: MonthlyBudget, btcPrice: number): BudgetTransactionContext[] {
  return budget.transactions
    .map((t) => {
      const assignments = getTransactionAssignments(t);
      let category: string;
      let splits: BudgetTransactionContext['splits'];

      if (assignments.length === 0) {
        category = 'Unassigned';
      } else if (assignments.length === 1) {
        category = lineLabel(budget, assignments[0].bucketId, assignments[0].lineItemId);
      } else {
        splits = assignments.map((a) => ({
          line_item: lineLabel(budget, a.bucketId, a.lineItemId),
          amount_usd: assignmentUsd(a.amountUsd, a.amountSats, btcPrice),
        }));
        category = `${splits.map((s) => s.line_item).join(' + ')} (split)`;
      }

      const row: BudgetTransactionContext = {
        category,
        amount_usd: transactionUsd(t, btcPrice),
        note: t.description || 'No description',
        date: t.date ? t.date.split('T')[0] : '',
      };
      if (t.isIncome) row.income = true;
      if (t.paymentMethod) row.payment_method = t.paymentMethod;
      if (t.partnerPubkey) row.logged_by = 'budget partner';
      if (splits) row.splits = splits;
      return row;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function monthContext(budget: MonthlyBudget, btcPrice: number): BudgetMonthContext {
  const totals = deriveBudgetTotals(budget, btcPrice);
  const categories: BudgetCategoryContext[] = totals.expenseBuckets
    .map((bucket) => ({
      name: bucket.name,
      budgeted_usd: bucket.budgetedUsd,
      spent_usd: bucket.spentUsd,
      remaining_usd: bucket.remainingUsd,
      percent_used: Math.min(100, bucket.percentUsed),
      line_items: bucket.lineItems.map((li) => ({
        name: li.name,
        budgeted_usd: li.budgetedUsd,
        spent_usd: li.spentUsd,
        remaining_usd: li.remainingUsd,
      })),
    }))
    .sort((a, b) => b.budgeted_usd - a.budgeted_usd);

  return {
    month: monthLabel(budget.month),
    income_usd: totals.incomeUsd,
    planned_budget_usd: totals.plannedUsd,
    total_spent_usd: totals.spentUsd,
    total_remaining_usd: totals.remainingToSpendUsd,
    left_to_assign_usd: totals.remainingToBudgetUsd,
    income_items: totals.incomeBuckets.flatMap((bucket) =>
      bucket.lineItems.map((li) => ({ name: li.name, budgeted_usd: li.budgetedUsd }))
    ),
    categories,
    transactions: transactionsFor(budget, btcPrice),
  };
}

/**
 * Build a BudgetContext from the current monthly budget.
 * All financial figures are USD-anchored — they come directly from stored
 * usd fields or from helper functions that derive them from USD values.
 * `allBudgets` is every saved month, including ones the user has planned ahead.
 */
export function buildBudgetContext(
  month: string,
  budget: MonthlyBudget,
  btcPrice: number,
  evergreenContext: string,
  bitcoinHoldings?: BitcoinHoldingContext[],
  nearbyMerchants?: MerchantContext[],
  options?: {
    allBudgets?: MonthlyBudget[];
    paymentMethods?: string[];
  }
): BudgetContext {
  const current = monthContext(budget, btcPrice);
  const other_months = (options?.allBudgets || [])
    .filter((entry) => entry.month !== month && entry.month !== budget.month)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((entry) => monthContext(entry, btcPrice));

  const total_btc = bitcoinHoldings
    ? bitcoinHoldings.reduce((sum, h) => sum + h.balance_btc, 0)
    : undefined;

  return {
    month: current.month,
    btc_price_usd: Math.round(btcPrice * 100) / 100,
    income_usd: current.income_usd,
    planned_budget_usd: current.planned_budget_usd,
    total_spent_usd: current.total_spent_usd,
    total_remaining_usd: current.total_remaining_usd,
    left_to_assign_usd: current.left_to_assign_usd,
    income_items: current.income_items,
    categories: current.categories,
    recent_transactions: current.transactions,
    other_months,
    payment_methods: options?.paymentMethods || [],
    user_evergreen_context: evergreenContext.trim(),
    bitcoin_holdings: bitcoinHoldings,
    total_btc,
    nearby_merchants: nearbyMerchants,
  };
}

const FORMATTING_RULES = `FORMATTING RULES (critical): You are rendered in a narrow mobile chat bubble that does NOT support markdown. Write in plain, conversational sentences. Do NOT use markdown tables, pipes (|), dashes for table rows, asterisks for bold (**), or headers (#). If you need a list, use short lines with a simple dash and a space. Keep numbers inline (e.g., "Food: $120 spent of $200, $80 left").`;

const INSIGHTS_SYSTEM_PROMPT = `You are Budget Buddy, the budgeting assistant inside Sat Sorter. Your name is Budget Buddy. Never call yourself Maple, and never name the model or AI service running you. The user budgets in USD but thinks in sats. The context is their whole saved budget: the month they are looking at, every other saved month (past and planned ahead), income, every category and line item, and every transaction in those months. Focus this answer on the month they are looking at. Provide 2–3 concise, actionable observations: spending pace, any line items or categories at risk of overspending, and one Bitcoin-themed tip (e.g., "If you finish under budget in Food, you could stack an extra X sats"). Keep it under 120 words. ${FORMATTING_RULES}`;

const CHAT_SYSTEM_PROMPT = `You are Budget Buddy inside Sat Sorter. Your name is Budget Buddy. Never introduce yourself as Maple, and never say the name of the model or AI service that is answering. If someone asks who you are, say you are Budget Buddy.

The context is the user's whole saved budget, not just a summary of the open month.
- "month" is the month they are looking at right now. Its income, categories, line items, and transactions are at the top level.
- "other_months" is every other month they have saved, including months they have planned ahead. Each one has the same income, categories, line items, and transactions.
- Transactions include income and spending, the line item they were assigned to, a split breakdown when one exists, the payment method when they recorded one, and "logged_by": "budget partner" when the other person entered it.
- "payment_methods" is the list of ways they pay.
- "left_to_assign_usd" is income that has not been given a job yet.
- Bitcoin holdings and nearby Bitcoin merchants are included when the user has them.

Use a specific transaction, line item, or month when the user asks about one. Do not claim a month, transaction, or amount that is not in the context. Default to USD, and you may mention sats using btc_price_usd. If a purchase would overspend a line item, warn them and name another line item with money left. Answer helpfully, concisely, and in a friendly tone. ${FORMATTING_RULES}`;

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

function authHeaders(apiKey: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  return headers;
}
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
  // SECURITY: We do NOT forward the Authorization header through the proxy.
  // The proxy is a third-party service and should never see API keys.
  const corsProxyUrl = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(url)}`;

  const tryFetch = async (fetchUrl: string, includeAuth: boolean): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (includeAuth && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }
    return fetch(fetchUrl, { headers });
  };

  try {
    let response = await tryFetch(url, true);

    // If CORS blocks the direct request, try via the CORS proxy
    // WITHOUT the Authorization header — the proxy cannot be trusted with keys
    if (!response.ok && response.status === 0) {
      response = await tryFetch(corsProxyUrl, false);
    }

    if (!response.ok) {
      // Try CORS proxy as a second attempt for any failure — still no auth
      response = await tryFetch(corsProxyUrl, false);
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

function readSseLine(line: string): string {
  if (!line.startsWith('data: ')) return '';
  const data = line.slice(6).trim();
  if (!data || data === '[DONE]') return '';
  return readJsonContent(data);
}

function readJsonContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed.choices?.[0]?.delta?.content
      || parsed.choices?.[0]?.message?.content
      || '';
  } catch {
    return '';
  }
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
    headers: authHeaders(apiKey, true),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new Error('The server rejected the API key.');
    }
    if (response.status === 429) {
      throw new Error('The server is rate limiting requests. Try again in a moment.');
    }
    
    throw new Error(`AI server error ${response.status}: ${errorText}`);
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
        fullContent += readSseLine(line);
      }
    }
    if (buffer.trim()) fullContent += readSseLine(buffer) || readJsonContent(buffer);
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
      headers: authHeaders(apiKey, true),
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
        return { ok: false, error: 'The server rejected the API key.' };
      }
      if (response.status === 429) {
        return { ok: false, error: 'Rate limited. Please try again in a moment.' };
      }
      if (response.status >= 500) {
        return { ok: false, error: 'The AI server is temporarily unavailable.' };
      }
      const text = await response.text();
      return { ok: false, error: `AI server error ${response.status}: ${text}` };
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
        message = `Cannot reach the AI server at ${proxyUrl}.`;
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
      return 'The server rejected the API key. Check Settings.';
    }
    if (error.status === 429) {
      return 'The AI server is rate limiting requests. Please wait a moment.';
    }
    return `AI server error (${error.status}). Please try again.`;
  }
  if (error instanceof Error) {
    if (
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network')
    ) {
      return "Can't reach the AI server. Check the address and your connection.";
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
