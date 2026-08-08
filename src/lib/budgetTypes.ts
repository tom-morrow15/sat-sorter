// Budget Types for Sat Sorter

/**
 * A single portion of a split transaction. A transaction can be divided across
 * multiple budget categories/line items, each with its own USD + sats amount.
 */
export interface TransactionSplit {
  id: string;
  bucketId: string;
  lineItemId: string;
  amount: number; // in sats
  amountUsd?: number; // USD amount - source of truth when authored in USD
  description?: string;
}

export interface Transaction {
  id: string;
  amount: number; // in sats - calculated from amountUsd
  amountUsd?: number; // USD amount - source of truth when user inputs USD
  btcPriceAtEntry?: number; // USD price of BTC when transaction was created
  description: string;
  date: string; // ISO date string
  lineItemId: string | null; // null means unassigned
  bucketId: string | null;
  splits?: TransactionSplit[]; // if present and non-empty, this is a split transaction
  isSplit?: boolean; // convenience flag mirroring splits presence
  paymentHash?: string; // from NWC
  preimage?: string;
  isIncome: boolean;
  source?: 'manual' | 'strike' | 'nwc' | 'zap'; // Track transaction source
  merchantName?: string; // Merchant name from Strike or payment processor
  categoryHint?: string; // Auto-detected category hint from merchant data
  paymentMethod?: string; // User-defined payment method (e.g., "Citi Credit Card", "Bitcoin")
  partnerPubkey?: string; // Pubkey of the partner who logged this transaction (for shared budgets)
}

export interface LineItem {
  id: string;
  name: string;
  plannedAmount: number; // in sats (kept for backward compatibility, but derivable from USD)
  plannedAmountUsd?: number; // USD amount - source of truth for USD-anchored math
  btcPriceAtBudget?: number; // USD price of BTC when budget was created/last updated
  order: number;
}

export interface Bucket {
  id: string;
  name: string;
  color: string;
  icon: string;
  lineItems: LineItem[];
  isIncome: boolean;
  order: number;
}

export interface MonthlyBudget {
  id: string;
  month: string; // YYYY-MM format
  buckets: Bucket[];
  transactions: Transaction[];
}

export interface BudgetPartner {
  pubkey: string;
  name?: string; // Display name
  permission: 'view' | 'edit'; // view-only or can edit
  addedAt: number; // Unix timestamp when partner was added
  lastActive?: number; // Unix timestamp of last activity
  status?: 'pending' | 'accepted' | 'declined'; // Partner acceptance status
  acceptedAt?: number; // When partner accepted the invite
  /** NIP-44 encrypted budget nsec, scoped to this partner. Only set by the
   *  budget owner so the partner can decrypt and hold the shared keypair. */
  encryptedBudgetKey?: string;
}

export interface BudgetPartnerInvite {
  id: string; // Unique invite ID
  month: string; // YYYY-MM of the budget at invite time
  from: string; // Sender's hex pubkey
  permission: 'viewer' | 'editor';
  /** NIP-44 encrypted budget nsec, decryptable only by the recipient. */
  encryptedBudgetKey: string;
  /** The budget's npub (unencrypted, so the recipient can verify). */
  budgetNpub: string;
  /** Full budget state snapshot (JSON-stringified BudgetState). Included in
   *  the invite so the partner gets all data immediately on accept. */
  snapshot?: string;
  createdAt: number; // Unix timestamp
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: number;
}

export interface BudgetTemplate {
  id: string;
  name: string; // e.g., "Standard Household Budget"
  description?: string;
  buckets: Bucket[]; // Template categories with line items
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  isDefault?: boolean; // Mark one template as default
}

export interface BudgetState {
  currentMonth: string;
  budgets: MonthlyBudget[];
  currency: 'sats' | 'usd';
  lastSynced?: number; // Unix timestamp of last Nostr sync
  partners?: BudgetPartner[]; // List of budget partners
  userRole?: 'owner' | 'editor' | 'viewer'; // Current user's role in this budget (defaults to 'owner' for creator)
  templates?: BudgetTemplate[]; // Saved budget templates
  defaultTemplateId?: string; // ID of template to use for new months
  receivedInvites?: BudgetPartnerInvite[]; // Invites received from other budget owners
  paymentMethods?: string[]; // User-defined payment methods (e.g. "Citi Credit Card", "ACH", "Cash")

  /** Shared-budget keypair. Created when the first partner is added.
   *  Both partners hold this so all budget data is signed + encrypted by the
   *  budget npub rather than by individual user identities. */
  budgetKeypair?: {
    budgetNsec: string;
    budgetNpub: string;
  };

  /** All shared budgets this user can access (including their own). */
  accessibleBudgets: {
    budgetNpub: string;
    budgetNsec: string;
    role: 'owner' | 'editor' | 'viewer';
  }[];
}

/** Current storage schema version. Bump when adding required fields. */
export const BUDGET_STORAGE_VERSION = 2;

/** A complete, safe default BudgetState that is guaranteed to have all required fields. */
export const SAFE_DEFAULT_BUDGET_STATE: BudgetState = {
  currentMonth: getCurrentMonth(),
  budgets: [],
  currency: 'sats',
  accessibleBudgets: [
    { budgetNpub: '', budgetNsec: '', role: 'owner' },
  ],
};

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalizes any (possibly partial or legacy) persisted BudgetState into a
 * complete, valid BudgetState. This is the single source of truth for repairing
 * corrupt / old localStorage data (especially common in Safari after clearing
 * history/cache).
 *
 * Always returns a state that has:
 *  - currentMonth (falls back to today)
 *  - budgets: array
 *  - currency
 *  - accessibleBudgets: array (never undefined)
 *  - all optional arrays defaulted to []
 *  - budgetKeypair preserved if present
 */
export function normalizeBudgetState(input: any): BudgetState {
  const nowMonth = getCurrentMonth();

  const base: BudgetState = {
    currentMonth: nowMonth,
    budgets: [],
    currency: 'sats',
    accessibleBudgets: [],
  };

  if (!input || typeof input !== 'object') {
    return base;
  }

  // Merge known fields safely
  const merged: BudgetState = {
    ...base,
    currentMonth: typeof input.currentMonth === 'string' && input.currentMonth
      ? input.currentMonth
      : nowMonth,
    currency: input.currency === 'usd' || input.currency === 'sats' ? input.currency : 'sats',
    budgets: Array.isArray(input.budgets) ? input.budgets : [],
    partners: Array.isArray(input.partners) ? input.partners : undefined,
    templates: Array.isArray(input.templates) ? input.templates : undefined,
    paymentMethods: Array.isArray(input.paymentMethods) ? input.paymentMethods : undefined,
    receivedInvites: Array.isArray(input.receivedInvites) ? input.receivedInvites : undefined,
    defaultTemplateId: typeof input.defaultTemplateId === 'string' ? input.defaultTemplateId : undefined,
    userRole: input.userRole === 'owner' || input.userRole === 'editor' || input.userRole === 'viewer'
      ? input.userRole
      : undefined,
    lastSynced: typeof input.lastSynced === 'number' ? input.lastSynced : undefined,
    budgetKeypair: input.budgetKeypair && typeof input.budgetKeypair === 'object'
      ? {
          budgetNsec: String(input.budgetKeypair.budgetNsec || ''),
          budgetNpub: String(input.budgetKeypair.budgetNpub || ''),
        }
      : undefined,
  };

  // CRITICAL: always ensure accessibleBudgets is a real array
  const rawAccessible = Array.isArray(input.accessibleBudgets) ? input.accessibleBudgets : [];
  merged.accessibleBudgets = rawAccessible.map((b: any) => ({
    budgetNpub: String(b?.budgetNpub || ''),
    budgetNsec: String(b?.budgetNsec || ''),
    role: (b?.role === 'editor' || b?.role === 'viewer') ? b.role : 'owner',
  }));

  // If we have a budgetKeypair but no entry in accessibleBudgets, add a synthetic owner entry
  // so UI selectors and migration logic never see an empty list when a keypair exists.
  if (merged.budgetKeypair?.budgetNpub && !merged.accessibleBudgets.some(b => b.budgetNpub === merged.budgetKeypair!.budgetNpub)) {
    merged.accessibleBudgets = [
      ...merged.accessibleBudgets,
      {
        budgetNpub: merged.budgetKeypair.budgetNpub,
        budgetNsec: merged.budgetKeypair.budgetNsec,
        role: 'owner',
      },
    ];
  }

  // If still no accessibleBudgets at all, add the implicit personal one (for legacy personal-only users)
  if (merged.accessibleBudgets.length === 0 && !merged.budgetKeypair) {
    merged.accessibleBudgets = [
      {
        budgetNpub: '',
        budgetNsec: '',
        role: 'owner',
      },
    ];
  }

  return merged;
}

// Default buckets for a new month
export function createDefaultBuckets(): Bucket[] {
  return [
    {
      id: generateId(),
      name: 'Income',
      color: '#22c55e',
      icon: 'wallet',
      isIncome: true,
      order: 0,
      lineItems: [
        { id: generateId(), name: 'Salary', plannedAmount: 0, order: 0 },
      ],
    },
    {
      id: generateId(),
      name: 'Housing',
      color: '#3b82f6',
      icon: 'home',
      isIncome: false,
      order: 1,
      lineItems: [
        { id: generateId(), name: 'Rent/Mortgage', plannedAmount: 0, order: 0 },
        { id: generateId(), name: 'Utilities', plannedAmount: 0, order: 1 },
        { id: generateId(), name: 'Insurance', plannedAmount: 0, order: 2 },
      ],
    },
    {
      id: generateId(),
      name: 'Transportation',
      color: '#8b5cf6',
      icon: 'car',
      isIncome: false,
      order: 2,
      lineItems: [
        { id: generateId(), name: 'Gas', plannedAmount: 0, order: 0 },
        { id: generateId(), name: 'Car Payment', plannedAmount: 0, order: 1 },
        { id: generateId(), name: 'Car Insurance', plannedAmount: 0, order: 2 },
      ],
    },
    {
      id: generateId(),
      name: 'Food',
      color: '#f59e0b',
      icon: 'utensils',
      isIncome: false,
      order: 3,
      lineItems: [
        { id: generateId(), name: 'Groceries', plannedAmount: 0, order: 0 },
        { id: generateId(), name: 'Restaurants', plannedAmount: 0, order: 1 },
      ],
    },
    {
      id: generateId(),
      name: 'Lifestyle',
      color: '#ec4899',
      icon: 'heart',
      isIncome: false,
      order: 4,
      lineItems: [
        { id: generateId(), name: 'Entertainment', plannedAmount: 0, order: 0 },
        { id: generateId(), name: 'Subscriptions', plannedAmount: 0, order: 1 },
      ],
    },
    {
      id: generateId(),
      name: 'Savings',
      color: '#06b6d4',
      icon: 'piggy-bank',
      isIncome: false,
      order: 5,
      lineItems: [
        { id: generateId(), name: 'Emergency Fund', plannedAmount: 0, order: 0 },
        { id: generateId(), name: 'Bitcoin Stack', plannedAmount: 0, order: 1 },
      ],
    },
  ];
}

// Get current month in YYYY-MM format
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Format month for display
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Calculate totals
export function calculateBucketTotal(bucket: Bucket): number {
  return bucket.lineItems.reduce((sum, item) => sum + item.plannedAmount, 0);
}

/**
 * Calculate bucket total in sats, using USD amounts if available (source of truth)
 */
export function calculateBucketTotalSats(bucket: Bucket, currentBtcPrice?: number): number {
  if (!currentBtcPrice) {
    // Fallback: just sum the sats
    return calculateBucketTotal(bucket);
  }

  return bucket.lineItems.reduce((sum, item) => {
    return sum + getLineItemSatAmount(item, currentBtcPrice);
  }, 0);
}

export function calculateTotalIncome(buckets: Bucket[]): number {
  return buckets
    .filter(b => b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotal(bucket), 0);
}

export function calculateTotalExpenses(buckets: Bucket[]): number {
  return buckets
    .filter(b => !b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotal(bucket), 0);
}

export function calculateRemainingToBudget(buckets: Bucket[]): number {
  return calculateTotalIncome(buckets) - calculateTotalExpenses(buckets);
}

/**
 * Calculate total income in sats using USD amounts if available
 */
export function calculateTotalIncomeSats(buckets: Bucket[], currentBtcPrice?: number): number {
  return buckets
    .filter(b => b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalSats(bucket, currentBtcPrice), 0);
}

/**
 * Calculate total expenses in sats using USD amounts if available
 */
export function calculateTotalExpensesSats(buckets: Bucket[], currentBtcPrice?: number): number {
  return buckets
    .filter(b => !b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalSats(bucket, currentBtcPrice), 0);
}

/**
 * Calculate remaining to budget in sats using USD amounts if available
 */
export function calculateRemainingToBudgetSats(buckets: Bucket[], currentBtcPrice?: number): number {
  return calculateTotalIncomeSats(buckets, currentBtcPrice) - calculateTotalExpensesSats(buckets, currentBtcPrice);
}

/**
 * Get the actual amount in sats for a transaction
 * If USD amount is set, convert from it (to ensure consistency)
 * Otherwise use the stored sats amount
 */
export function getTransactionSatAmount(transaction: Transaction, currentBtcPrice?: number): number {
  // If USD amount is set, that's the source of truth
  if (transaction.amountUsd && transaction.amountUsd > 0) {
    if (!currentBtcPrice) {
      console.warn('getTransactionSatAmount: USD amount present but no BTC price provided');
      return transaction.amount; // Fallback to stored sats
    }
    return Math.round(transaction.amountUsd / currentBtcPrice * 100_000_000);
  }
  // Otherwise use stored sats
  return transaction.amount;
}

/**
 * Get the actual amount in USD for a transaction
 * If USD amount is set, use it (source of truth)
 * Otherwise convert from sats using provided price
 */
export function getTransactionUsdAmount(transaction: Transaction, currentBtcPrice?: number): number {
  // If USD amount is set, that's the source of truth
  if (transaction.amountUsd && transaction.amountUsd > 0) {
    return transaction.amountUsd;
  }
  // Otherwise convert from sats
  if (!currentBtcPrice) {
    console.warn('getTransactionUsdAmount: No USD amount and no BTC price provided');
    return 0;
  }
  return transaction.amount / 100_000_000 * currentBtcPrice;
}

// Calculate spent amount for a line item
export function calculateSpentForLineItem(lineItemId: string, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.lineItemId === lineItemId && !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);
}

// Calculate spent amount for a bucket
export function calculateSpentForBucket(bucket: Bucket, transactions: Transaction[]): number {
  return bucket.lineItems.reduce(
    (sum, item) => sum + calculateSpentForLineItem(item.id, transactions),
    0
  );
}

// Get unassigned transactions
export function getUnassignedTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.lineItemId === null);
}

// USD-Anchored Math Helpers
// These functions work with USD as the source of truth

/**
 * Get the planned amount in USD for a line item
 * Falls back to converting from sats if USD amount not available
 */
export function getLineItemUsdAmount(lineItem: LineItem, currentBtcPrice: number): number {
  // If USD amount is set, use it (source of truth)
  if (lineItem.plannedAmountUsd && lineItem.plannedAmountUsd > 0) {
    return lineItem.plannedAmountUsd;
  }
  
  // Fallback: convert from sats using current price
  // This handles legacy line items that only have sats
  return lineItem.plannedAmount / 100_000_000 * currentBtcPrice;
}

/**
 * Get the planned amount in sats for a line item
 * Converts from USD amount if available, otherwise returns stored sats
 */
export function getLineItemSatAmount(lineItem: LineItem, currentBtcPrice: number): number {
  // If USD amount is set, convert it to sats
  if (lineItem.plannedAmountUsd && lineItem.plannedAmountUsd > 0) {
    return Math.round(lineItem.plannedAmountUsd / currentBtcPrice * 100_000_000);
  }
  
  // Use stored sats amount
  return lineItem.plannedAmount;
}

/**
 * Validate that split amounts sum to total
 * Returns { isValid: boolean, message?: string }
 */
export function validateBudgetSplits(
  buckets: Bucket[],
  currentBtcPrice: number
): { isValid: boolean; message?: string } {
  for (const bucket of buckets) {
    if (bucket.isIncome || bucket.lineItems.length === 0) continue;
    
    const bucketUsdTotal = calculateBucketTotalUsd(bucket, currentBtcPrice);
    const lineItemsTotal = bucket.lineItems.reduce((sum, item) => {
      return sum + getLineItemUsdAmount(item, currentBtcPrice);
    }, 0);
    
    // Allow small rounding differences (< 0.01 USD)
    const difference = Math.abs(bucketUsdTotal - lineItemsTotal);
    if (difference > 0.01) {
      return {
        isValid: false,
        message: `${bucket.name}: Line items total ($${lineItemsTotal.toFixed(2)}) doesn't match allocated ($${bucketUsdTotal.toFixed(2)})`,
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Calculate total budget for a bucket in USD
 */
export function calculateBucketTotalUsd(bucket: Bucket, currentBtcPrice: number): number {
  return bucket.lineItems.reduce((sum, item) => {
    return sum + getLineItemUsdAmount(item, currentBtcPrice);
  }, 0);
}

/**
 * Calculate total income in USD
 */
export function calculateTotalIncomeUsd(buckets: Bucket[], currentBtcPrice: number): number {
  return buckets
    .filter(b => b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalUsd(bucket, currentBtcPrice), 0);
}

/**
 * Calculate total expenses in USD
 */
export function calculateTotalExpensesUsd(buckets: Bucket[], currentBtcPrice: number): number {
  return buckets
    .filter(b => !b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalUsd(bucket, currentBtcPrice), 0);
}

/**
 * Calculate remaining to budget in USD
 */
export function calculateRemainingToBudgetUsd(buckets: Bucket[], currentBtcPrice: number): number {
  return calculateTotalIncomeUsd(buckets, currentBtcPrice) - calculateTotalExpensesUsd(buckets, currentBtcPrice);
}
