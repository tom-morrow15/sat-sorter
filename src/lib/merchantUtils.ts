/**
 * Merchant Categorization Utilities
 * Auto-categorizes merchants into budget categories based on name patterns
 */

export interface MerchantCategory {
  pattern: RegExp;
  bucket: string;
  lineItem?: string;
}

// Merchant categorization rules
const MERCHANT_RULES: MerchantCategory[] = [
  // Food & Dining
  { pattern: /starbucks|coffee|cafe|dunkin/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /grocery|whole foods|trader joe|kroger|safeway|albertsons|costco|walmart|target/i, bucket: 'Food', lineItem: 'Groceries' },
  { pattern: /restaurant|burger|pizza|taco|sushi|diner|grill|chipotle|mcdonald|wendy/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /doordash|uber eats|grubhub|foodpanda|seamless|postmates/i, bucket: 'Food', lineItem: 'Restaurants' },

  // Transportation
  { pattern: /uber|lyft|taxi|cab/i, bucket: 'Transportation', lineItem: undefined },
  { pattern: /chevron|shell|exxon|bp|mobil|gas station|speedway|wawa/i, bucket: 'Transportation', lineItem: 'Gas' },
  { pattern: /tesla|ford|chevy|toyota|honda|auto|car payment/i, bucket: 'Transportation', lineItem: 'Car Payment' },
  { pattern: /airline|united|delta|american|southwest|flight|jetblue/i, bucket: 'Transportation', lineItem: undefined },
  { pattern: /parking|garage|meter/i, bucket: 'Transportation', lineItem: undefined },

  // Utilities & Housing
  { pattern: /electric|water|gas|utility|verizon|at&t|comcast|xfinity|spectrum|t-mobile/i, bucket: 'Housing', lineItem: 'Utilities' },
  { pattern: /landlord|apartment|rent|mortgage|property|hoa/i, bucket: 'Housing', lineItem: 'Rent/Mortgage' },
  { pattern: /insurance|geico|progressive|state farm|allstate/i, bucket: 'Housing', lineItem: 'Insurance' },

  // Healthcare
  { pattern: /pharmacy|cvs|walgreens|doctor|hospital|clinic|medical|health|dental|vision/i, bucket: 'Healthcare', lineItem: undefined },

  // Subscriptions & Entertainment
  { pattern: /netflix|hulu|disney|spotify|apple music|amazon prime|youtube|hbo|paramount/i, bucket: 'Lifestyle', lineItem: 'Subscriptions' },
  { pattern: /movie|cinema|theater|concert|ticket|amc|regal/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },
  { pattern: /gym|fitness|yoga|peloton|trainer|planet fitness|equinox/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },

  // Shopping
  { pattern: /amazon|ebay|etsy|shop|store|mall/i, bucket: 'Shopping', lineItem: undefined },
  { pattern: /clothing|apparel|fashion|nike|adidas|gap|old navy|h&m|zara/i, bucket: 'Shopping', lineItem: 'Clothing' },

  // Bitcoin & Savings
  { pattern: /bitcoin|btc|crypto|coinbase|kraken|exchange|invest|swan|river|fold|strike/i, bucket: 'Savings', lineItem: 'Bitcoin Stack' },

  // Income patterns
  { pattern: /payroll|salary|direct deposit|income|paycheck/i, bucket: 'Income', lineItem: 'Paycheck' },
  { pattern: /refund|cashback|rebate/i, bucket: 'Income', lineItem: undefined },
];

/**
 * Auto-categorize a merchant name based on learned rules
 * Returns the bucket name if found
 */
export function categorizeMerchant(merchantName: string): string | null {
  if (!merchantName) return null;
  
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(merchantName)) {
      return rule.bucket;
    }
  }
  return null;
}

/**
 * Get the suggested line item for a merchant
 * Returns undefined if no specific line item is suggested
 */
export function getLineItemSuggestion(merchantName: string): string | undefined {
  if (!merchantName) return undefined;
  
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(merchantName) && rule.lineItem) {
      return rule.lineItem;
    }
  }
  return undefined;
}
