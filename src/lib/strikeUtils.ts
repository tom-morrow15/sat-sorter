/**
 * Strike Integration Utilities
 * Handles Strike API communication, merchant categorization, and transaction mapping
 */

export interface StrikeConfig {
  apiKey: string;
  username?: string;
  lastSyncDate?: string;
}

export interface StrikeTransaction {
  id: string;
  createdAt: string;
  amount: {
    currency: string;
    amount: number;
  };
  btcAmount?: {
    amount: number; // in BTC
  };
  description?: string;
  counterparty?: {
    name: string;
    handle?: string;
  };
  type: 'send' | 'receive' | 'payment';
  status: 'completed' | 'pending' | 'failed';
}

export interface MerchantCategory {
  pattern: RegExp;
  bucket: string;
  lineItem?: string;
}

// Merchant categorization rules
const MERCHANT_RULES: MerchantCategory[] = [
  // Food & Dining
  { pattern: /starbucks|coffee|cafe/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /grocery|whole foods|trader joe|kroger|safeway|albertsons/i, bucket: 'Food', lineItem: 'Groceries' },
  { pattern: /restaurant|burger|pizza|taco|sushi|diner|grill/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /doordash|uber eats|grubhub|foodpanda/i, bucket: 'Food', lineItem: 'Restaurants' },

  // Transportation
  { pattern: /uber|lyft|taxi|cab/i, bucket: 'Transportation', lineItem: undefined },
  { pattern: /chevron|shell|exxon|bp|mobil|gas station/i, bucket: 'Transportation', lineItem: 'Gas' },
  { pattern: /tesla|ford|chevy|toyota|honda/i, bucket: 'Transportation', lineItem: 'Car Payment' },
  { pattern: /airline|united|delta|american|southwest|flight/i, bucket: 'Transportation', lineItem: undefined },

  // Utilities & Housing
  { pattern: /electric|water|gas|utility|verizon|at&t|comcast|xfinity/i, bucket: 'Housing', lineItem: 'Utilities' },
  { pattern: /landlord|apartment|rent|mortgage|property/i, bucket: 'Housing', lineItem: 'Rent/Mortgage' },

  // Healthcare
  { pattern: /pharmacy|cvs|walgreens|doctor|hospital|clinic|medical|health/i, bucket: 'Healthcare', lineItem: undefined },

  // Subscriptions & Entertainment
  { pattern: /netflix|hulu|disney|spotify|apple music|amazon prime|youtube/i, bucket: 'Lifestyle', lineItem: 'Subscriptions' },
  { pattern: /movie|cinema|theater|concert|ticket/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },
  { pattern: /gym|fitness|yoga|peloton|trainer/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },

  // Savings & Investments
  { pattern: /bitcoin|crypto|coinbase|kraken|exchange|invest/i, bucket: 'Savings', lineItem: 'Bitcoin Stack' },

  // Bill Pay specific
  { pattern: /bill|payment|payment_plan/i, bucket: 'Housing', lineItem: undefined },
];

/**
 * Auto-categorize a merchant name based on learned rules
 * Returns the bucket name if found
 */
export function categorizeMerchant(merchantName: string): string | null {
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(merchantName)) {
      return rule.bucket;
    }
  }
  return null;
}

/**
 * Convert Strike transaction to app Transaction format
 */
export function strikeTransactionToAppTransaction(
  strikeTransaction: StrikeTransaction,
  categoryHint?: string
): {
  amount: number;
  description: string;
  date: string;
  isIncome: boolean;
  source: 'strike';
  merchantName?: string;
  categoryHint?: string;
} {
  // Determine if incoming or outgoing
  const isIncome = strikeTransaction.type === 'receive';

  // Convert to sats (multiply BTC by 100,000,000)
  const amount = strikeTransaction.btcAmount
    ? Math.round(strikeTransaction.btcAmount.amount * 100_000_000)
    : 0;

  const merchantName = strikeTransaction.counterparty?.name ||
    strikeTransaction.counterparty?.handle ||
    strikeTransaction.description ||
    'Strike Transfer';

  // Auto-categorize if not provided
  const detectedCategory = categoryHint || categorizeMerchant(merchantName);

  return {
    amount,
    description: merchantName,
    date: strikeTransaction.createdAt,
    isIncome,
    source: 'strike' as const,
    merchantName,
    categoryHint: detectedCategory || undefined,
  };
}

/**
 * Get CORS proxy URL if needed
 */
function getCorsProxyUrl(url: string): string {
  // Check if we need to use CORS proxy (based on environment or config)
  // For now, return the URL as-is. If CORS issues occur, the error handler will try proxy
  return url;
}

/**
 * Validate Strike API key by making a test request
 * Supports multiple authentication methods and endpoints
 */
export async function validateStrikeApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  // Try multiple authentication methods and endpoints
  const baseAttempts = [
    // Method 1: Bearer token at /v1/me
    {
      url: 'https://api.strike.me/v1/me',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /v1/me',
    },
    // Method 2: X-API-Key header
    {
      url: 'https://api.strike.me/v1/me',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      name: 'X-API-Key header at /v1/me',
    },
    // Method 3: Try /v1/account endpoint
    {
      url: 'https://api.strike.me/v1/account',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /v1/account',
    },
    // Method 4: Try /v1/users/me endpoint
    {
      url: 'https://api.strike.me/v1/users/me',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /v1/users/me',
    },
    // Method 5: Try /v1/profile endpoint
    {
      url: 'https://api.strike.me/v1/profile',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /v1/profile',
    },
    // Method 6: Try /v1/info endpoint
    {
      url: 'https://api.strike.me/v1/info',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /v1/info',
    },
    // Method 7: Try /me endpoint (no /v1/)
    {
      url: 'https://api.strike.me/me',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      name: 'Bearer token at /me (no version)',
    },
    // Method 8: Try Basic auth
    {
      url: 'https://api.strike.me/v1/me',
      headers: {
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
        'Content-Type': 'application/json',
      },
      name: 'Basic auth (api:key) at /v1/me',
    },
  ];

  const attempts = baseAttempts;

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      console.log(`[Strike] Trying: ${attempt.name}`);
      console.log(`[Strike] URL: ${attempt.url}`);

      const response = await fetch(attempt.url, {
        method: 'GET',
        headers: attempt.headers,
      });

      console.log(`[Strike] Response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        console.log(`[Strike] ✓ SUCCESS with ${attempt.name}`);
        return { valid: true };
      }

      // Try to get error details
      let errorDetails = '';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          errorDetails = JSON.stringify(data);
        } else {
          errorDetails = await response.text();
        }
      } catch (e) {
        // Couldn't parse response body
      }

      // If 401/403, authentication failed - try next method
      if (response.status === 401 || response.status === 403) {
        console.log(`[Strike] Auth failed (${response.status}): ${errorDetails || 'No details'}`);
        lastError = new Error(`${response.status} Unauthorized - check your API key`);
        continue;
      }

      // If 404, the endpoint doesn't exist, try next
      if (response.status === 404) {
        console.log(`[Strike] Endpoint not found (404), trying next...`);
        lastError = new Error('Endpoint not found');
        continue;
      }

      // If we got a successful status code
      if (response.status >= 200 && response.status < 300) {
        console.log(`[Strike] ✓ SUCCESS (${response.status})`);
        return { valid: true };
      }

      console.log(`[Strike] Got ${response.status}, trying next... Details: ${errorDetails || 'None'}`);
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[Strike] Network/fetch error with ${attempt.name}: ${errorMsg}`);

      // Check for CORS errors
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('CORS')) {
        console.log('[Strike] CORS error detected - this might be a network/browser issue');
      }

      lastError = error instanceof Error ? error : new Error(errorMsg);
      continue;
    }
  }

  // If all methods failed, provide helpful error
  const errorMsg = lastError?.message || 'All authentication methods failed';
  console.error(`[Strike] ✗ ALL ATTEMPTS FAILED: ${errorMsg}`);
  console.error('[Strike] Check the following:');
  console.error('1. API key is correct (copy the entire key from Strike Settings)');
  console.error('2. API key has not expired');
  console.error('3. You have internet connection');
  console.error('4. Strike API is accessible');

  return {
    valid: false,
    error: `Strike API error: ${errorMsg}. Please check your API key and Strike Settings. Open browser console (F12) for details.`,
  };
}

/**
 * Fetch transactions from Strike API
 * Returns only completed transactions newer than lastSyncDate
 */
export async function fetchStrikeTransactions(
  apiKey: string,
  lastSyncDate?: string
): Promise<StrikeTransaction[]> {
  // Try multiple endpoints for transactions
  const transactionUrls = [
    // Try /v1/transactions first
    { url: 'https://api.strike.me/v1/transactions', name: '/v1/transactions' },
    // Try /v1/history
    { url: 'https://api.strike.me/v1/history', name: '/v1/history' },
    // Try /transactions (no version)
    { url: 'https://api.strike.me/transactions', name: '/transactions' },
    // Try /v1/ledger
    { url: 'https://api.strike.me/v1/ledger', name: '/v1/ledger' },
    // Try /v1/invoices
    { url: 'https://api.strike.me/v1/invoices', name: '/v1/invoices' },
  ];

  let lastError: Error | null = null;

  for (const endpoint of transactionUrls) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (lastSyncDate) {
        params.append('createdAfter', lastSyncDate);
      }
      params.append('status', 'completed');

      const url = `${endpoint.url}?${params.toString()}`;
      console.log('[Strike] Trying transactions endpoint:', endpoint.name);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[Strike] Response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[Strike] Got data from', endpoint.name, ':', data);

        // Handle various response formats
        if (Array.isArray(data.items)) {
          console.log(`[Strike] Got ${data.items.length} transactions from items array`);
          return data.items;
        }
        if (Array.isArray(data)) {
          console.log(`[Strike] Got ${data.length} transactions from direct array`);
          return data;
        }
        if (data.data && Array.isArray(data.data)) {
          console.log(`[Strike] Got ${data.data.length} transactions from data field`);
          return data.data;
        }

        console.warn('[Strike] Unexpected response format:', data);
        return [];
      }

      if (response.status === 404) {
        console.log('[Strike] Endpoint not found, trying next...');
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        let errorDetails = '';
        try {
          const data = await response.json();
          errorDetails = JSON.stringify(data);
        } catch (e) {
          // Couldn't parse
        }
        throw new Error(`Authorization failed (${response.status}). ${errorDetails}`);
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('[Strike] Error with', endpoint.name, ':', errorMsg);
      lastError = error instanceof Error ? error : new Error(errorMsg);
      continue;
    }
  }

  // If we tried all endpoints, throw the last error
  const errorMsg = lastError?.message || 'No working transaction endpoints found';
  console.error('[Strike] Failed to fetch transactions from any endpoint:', errorMsg);
  throw new Error(`Could not fetch transactions: ${errorMsg}`);
}

/**
 * Store Strike config securely in localStorage
 */
export function saveStrikeConfig(config: StrikeConfig): void {
  try {
    localStorage.setItem('sat-sorter-strike-config', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save Strike config:', error);
  }
}

/**
 * Retrieve stored Strike config
 */
export function getStrikeConfig(): StrikeConfig | null {
  try {
    const stored = localStorage.getItem('sat-sorter-strike-config');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to retrieve Strike config:', error);
    return null;
  }
}

/**
 * Clear stored Strike config
 */
export function clearStrikeConfig(): void {
  try {
    localStorage.removeItem('sat-sorter-strike-config');
  } catch (error) {
    console.error('Failed to clear Strike config:', error);
  }
}
