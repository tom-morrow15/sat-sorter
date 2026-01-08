/**
 * Merchant Categorization Utilities
 * Auto-categorizes merchants into budget categories based on name patterns
 *
 * IMPORTANT: Rules are processed in order. More specific rules should come first.
 * This prevents overly broad matches like "gas" matching restaurants with "gastro" cuisine.
 */

export interface MerchantCategory {
  pattern: RegExp;
  bucket: string;
  lineItem?: string;
}

// Merchant categorization rules
// Order matters: specific rules first, then broader rules
const MERCHANT_RULES: MerchantCategory[] = [
  // ========================================
  // FOOD & DINING (Most Specific First)
  // ========================================
  { pattern: /starbucks|coffee|cafe|dunkin|peet's|blue bottle/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /grocery|whole foods|trader joe|kroger|safeway|albertsons|costco|publix|sprouts|winco/i, bucket: 'Food', lineItem: 'Groceries' },
  { pattern: /restaurant|burger|pizza|taco|sushi|diner|grill|chipotle|mcdonald|wendy|taco bell|subway|panera|panda|wingstop|chick|popeyes|kfc|arby|sonic|in-n-out|five guys|whataburger|shake shack|smashburger|fatburger|carl's jr|hardee's|jack in|dairy queen|bk|burger king/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /doordash|uber eats|grubhub|foodpanda|seamless|postmates|instacart|amazon fresh|walmart grocery/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /bakery|donuts|donut|pastries|bread|bagels|croissant|sandwich|deli/i, bucket: 'Food', lineItem: 'Restaurants' },
  { pattern: /ice cream|gelato|frozen yogurt|dessert|candy|chocolate|sweetgreen|chipotle|qdoba|panda express/i, bucket: 'Food', lineItem: 'Restaurants' },

  // ========================================
  // TRANSPORTATION (Specific patterns)
  // ========================================
  // Fuel MUST come before any broad "gas" patterns and should NOT match cuisine-related terms
  { pattern: /^gas station|chevron|shell|exxon|bp|mobil(?!\s)|speedway|wawa|circle k|pilot|love's|sheetz|sunoco|citgo|valero|murphyusa|racetrac|murphy(?!\s)|sunoco|quicktrip|qt fuel/i, bucket: 'Transportation', lineItem: 'Gas' },
  { pattern: /fuel station|petrol|fuel pump|fuel up|pump gas|gas pump|filling station/i, bucket: 'Transportation', lineItem: 'Gas' },

  { pattern: /uber|lyft|taxi|cab|rideshare|via|juno|curb/i, bucket: 'Transportation', lineItem: undefined },
  { pattern: /tesla charger|ev charge|electric vehicle|tesla|charging station/i, bucket: 'Transportation', lineItem: 'Car Maintenance' },
  { pattern: /tesla|ford|chevy|toyota|honda|auto|car payment|vehicle payment|financing|loan|leasing/i, bucket: 'Transportation', lineItem: 'Car Payment' },
  { pattern: /airline|united|delta|american|southwest|flight|jetblue|spirit|frontier|allegiant|air canada|lufthansa|british airways/i, bucket: 'Transportation', lineItem: undefined },
  { pattern: /parking|garage|meter|parkwhiz|spothero|parkable|parking.com/i, bucket: 'Transportation', lineItem: 'Car Maintenance' },
  { pattern: /auto repair|mechanic|tire|oil change|maintenance|detailing|carwash|car wash|goodyear|bridgestone|michelin/i, bucket: 'Transportation', lineItem: 'Car Maintenance' },
  { pattern: /transit|metro|subway|rail|train|bus|amtrak|bart|mta|nj transit|cta|septa/i, bucket: 'Transportation', lineItem: undefined },

  // ========================================
  // UTILITIES & HOUSING
  // ========================================
  // Utilities - be specific to avoid matching "gas station" merchants incorrectly
  { pattern: /verizon|at&t|comcast|xfinity|spectrum|t-mobile|sprint|boost|cricket|tmobile|cox|dish|directv|century link|qwest|frontier|fios/i, bucket: 'Housing', lineItem: 'Utilities' },
  { pattern: /electric|water|sewer|trash|utility company|power company|city utilities|municipal|pwc|pge|duke energy|exelon|ameren|dominion|entergy|first energy|scana|nrg|comed|aps|scl/i, bucket: 'Housing', lineItem: 'Utilities' },

  { pattern: /landlord|apartment|rent|mortgage|property|hoa|condo|lease|rental|airbnb|vrbo|booking/i, bucket: 'Housing', lineItem: 'Rent/Mortgage' },
  { pattern: /insurance|geico|progressive|state farm|allstate|farmers|aaa|esurance|nationwide|liberty mutual|traveler|nfib|uiowa|safeco|kemper/i, bucket: 'Housing', lineItem: 'Insurance' },

  // ========================================
  // HEALTHCARE
  // ========================================
  { pattern: /pharmacy|cvs|walgreens|rite aid|kroger pharmacy|walmart pharmacy|target pharmacy|safeway pharmacy/i, bucket: 'Healthcare', lineItem: 'Pharmacy' },
  { pattern: /doctor|hospital|clinic|medical|health|dental|vision|optometrist|orthodont|therapy|physical therapy|teledoc|mdlive|virtuwell|urgent care|emergency room|er|er care/i, bucket: 'Healthcare', lineItem: 'Medical' },

  // ========================================
  // SUBSCRIPTIONS & ENTERTAINMENT
  // ========================================
  { pattern: /netflix|hulu|disney plus|spotify|apple music|amazon prime|youtube premium|hbo max|paramount|peacock|apple tv|disney\+|max hbo/i, bucket: 'Lifestyle', lineItem: 'Subscriptions' },
  { pattern: /movie|cinema|theater|theatre|concert|ticket|amc|regal|cinemark|alamo|fandango|eventbrite/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },
  { pattern: /gym|fitness|yoga|peloton|trainer|planet fitness|equinox|la fitness|gold's|crunch|orangetheory|f45|crossfit|rowing|blink|lifetime|anytime| 24 hour/i, bucket: 'Lifestyle', lineItem: 'Entertainment' },

  // ========================================
  // SHOPPING
  // ========================================
  { pattern: /amazon|ebay|etsy|alibaba|wish|wayfair|overstock/i, bucket: 'Shopping', lineItem: undefined },
  { pattern: /clothing|apparel|fashion|nike|adidas|gap|old navy|h&m|zara|uniqlo|levis|dkny|tommy|calvin klein|ralph lauren|columbia|north face|patagonia|eddie bauer|ll bean|j.crew|banana republic|target|walmart|marshalls|tj maxx|ross|burlington|dsw|payless|shoe|boots|sneaker/i, bucket: 'Shopping', lineItem: 'Clothing' },

  // ========================================
  // BITCOIN & SAVINGS
  // ========================================
  { pattern: /bitcoin|btc|crypto|coinbase|kraken|exchange|invest|swan|river|fold|strike|cash app|strike|block|square/i, bucket: 'Savings', lineItem: 'Bitcoin Stack' },

  // ========================================
  // INCOME PATTERNS
  // ========================================
  { pattern: /payroll|salary|direct deposit|income|paycheck|employer|work|wage/i, bucket: 'Income', lineItem: 'Paycheck' },
  { pattern: /refund|cashback|rebate|credit|deposit|payment received/i, bucket: 'Income', lineItem: undefined },
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
