// Budget Types for Sat Sorter

export interface Transaction {
  id: string;
  amount: number; // in sats (derived from USD if usdAmount is set)
  usdAmount?: number; // if set, this is the "source of truth" and sats are recalculated
  usdPerBtcAtEntry?: number; // Exchange rate at time of entry (for USD drift prevention)
  description: string;
  date: string; // ISO date string
  lineItemId: string | null; // null means unassigned
  bucketId: string | null;
  paymentHash?: string; // from NWC
  preimage?: string;
  isIncome: boolean;
  source?: 'manual' | 'strike' | 'nwc' | 'zap'; // Track transaction source
  sourceWallet?: string; // Which wallet connection this came from (NWC alias)
  sourceWalletId?: string; // The connection string ID for the wallet
  merchantName?: string; // Merchant name from Strike or payment processor
  categoryHint?: string; // Auto-detected category hint from merchant data
  // Split transaction support
  parentTransactionId?: string; // If this is a split, references the original transaction
  isSplitParent?: boolean; // True if this transaction has been split into multiple parts
}

// Represents a single split allocation
export interface SplitAllocation {
  bucketId: string;
  lineItemId: string;
  amount: number; // in sats
  usdAmount?: number;
  description?: string; // Optional note for this split portion
}

export interface LineItem {
  id: string;
  name: string;
  plannedAmount: number; // in sats (derived from USD if usdAmount is set)
  usdAmount?: number; // if set, this is the "source of truth" and sats are recalculated
  usdPerBtcAtEntry?: number; // Exchange rate at time of entry (for USD drift prevention)
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

export interface BudgetState {
  currentMonth: string;
  budgets: MonthlyBudget[];
  currency: 'sats' | 'usd';

  // Sharing & versioning (Phase 1+)
  budgetId?: string;              // Unique identifier for this budget
  version?: number;               // Incrementing version for conflict detection
  lastEditedBy?: string;          // Pubkey of last editor
  lastEditedAt?: number;          // Timestamp of last edit

  // Budget partners (Phase 2+)
  isShared?: boolean;             // Is this a collaborative budget?
  ownerPubkey?: string;           // Who created/owns this budget
  partnerPubkeys?: string[];      // All budget partners (including owner)
}

// Budget invitation for partner invites
export interface BudgetInvitation {
  type: 'budget-invite';
  budgetId: string;
  budgetName: string;
  ownerPubkey: string;
  createdAt: number;
}

// Pending invitation with metadata
export interface PendingInvitation {
  id: string;                     // Event ID
  invitation: BudgetInvitation;
  fromPubkey: string;
  receivedAt: number;
}

// Helper to generate unique IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

// Calculate totals (in sats)
export function calculateBucketTotal(bucket: Bucket): number {
  return bucket.lineItems.reduce((sum, item) => sum + item.plannedAmount, 0);
}

// Calculate bucket total in USD respecting stored USD amounts
export function calculateBucketTotalForDisplay(bucket: Bucket, usdPerBtc: number, currency: 'sats' | 'usd'): { sats: number; usd: number } {
  let totalSats = 0;
  let totalUsd = 0;

  bucket.lineItems.forEach(item => {
    totalSats += item.plannedAmount;
    // Use stored USD amount if available, otherwise convert from sats
    if (item.usdAmount !== undefined) {
      totalUsd += item.usdAmount;
    } else {
      totalUsd += (item.plannedAmount / 100_000_000) * usdPerBtc;
    }
  });

  return { sats: totalSats, usd: totalUsd };
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

// Calculate totals in USD (using stored USD amounts when available)
export function calculateBucketTotalUsd(bucket: Bucket, usdPerBtc: number): number {
  return bucket.lineItems.reduce((sum, item) => {
    // Use stored USD amount if available, otherwise convert from sats
    if (item.usdAmount !== undefined) {
      return sum + item.usdAmount;
    }
    return sum + (item.plannedAmount / 100_000_000) * usdPerBtc;
  }, 0);
}

export function calculateTotalIncomeUsd(buckets: Bucket[], usdPerBtc: number): number {
  return buckets
    .filter(b => b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalUsd(bucket, usdPerBtc), 0);
}

export function calculateTotalExpensesUsd(buckets: Bucket[], usdPerBtc: number): number {
  return buckets
    .filter(b => !b.isIncome)
    .reduce((sum, bucket) => sum + calculateBucketTotalUsd(bucket, usdPerBtc), 0);
}

export function calculateRemainingToBudgetUsd(buckets: Bucket[], usdPerBtc: number): number {
  return calculateTotalIncomeUsd(buckets, usdPerBtc) - calculateTotalExpensesUsd(buckets, usdPerBtc);
}

// Calculate spent amount for a line item (in sats)
export function calculateSpentForLineItem(lineItemId: string, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.lineItemId === lineItemId && !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);
}

// Calculate spent amount for a line item in USD respecting stored USD amounts
export function calculateSpentForLineItemUsd(lineItemId: string, transactions: Transaction[], usdPerBtc: number): number {
  return transactions
    .filter(t => t.lineItemId === lineItemId && !t.isIncome)
    .reduce((sum, t) => {
      // Use stored USD amount if available, otherwise convert from sats
      if (t.usdAmount !== undefined) {
        return sum + t.usdAmount;
      }
      return sum + (t.amount / 100_000_000) * usdPerBtc;
    }, 0);
}

// Calculate spent amount for a bucket (in sats)
export function calculateSpentForBucket(bucket: Bucket, transactions: Transaction[]): number {
  return bucket.lineItems.reduce(
    (sum, item) => sum + calculateSpentForLineItem(item.id, transactions),
    0
  );
}

// Calculate spent amount for a bucket in USD (respecting stored USD amounts)
export function calculateSpentForBucketUsd(bucket: Bucket, transactions: Transaction[], usdPerBtc: number): number {
  return bucket.lineItems.reduce(
    (sum, item) => sum + calculateSpentForLineItemUsd(item.id, transactions, usdPerBtc),
    0
  );
}

// Get unassigned transactions
export function getUnassignedTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.lineItemId === null);
}
