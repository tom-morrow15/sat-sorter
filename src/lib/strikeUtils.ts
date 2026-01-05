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
 * Validate Strike API key by making a test request
 */
export async function validateStrikeApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.strike.me/v1/me', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Strike API validation failed:', error);
    return false;
  }
}

/**
 * Fetch transactions from Strike API
 * Returns only completed transactions newer than lastSyncDate
 */
export async function fetchStrikeTransactions(
  apiKey: string,
  lastSyncDate?: string
): Promise<StrikeTransaction[]> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (lastSyncDate) {
      params.append('createdAfter', lastSyncDate);
    }
    params.append('status', 'completed');

    const response = await fetch(
      `https://api.strike.me/v1/transactions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Strike API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Ensure we have an array
    if (!Array.isArray(data.items)) {
      console.warn('Strike API returned unexpected format:', data);
      return [];
    }

    return data.items;
  } catch (error) {
    console.error('Failed to fetch Strike transactions:', error);
    throw error;
  }
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
