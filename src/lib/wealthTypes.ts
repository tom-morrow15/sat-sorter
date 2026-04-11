// Wealth Tracker Types

export interface WatchedAddress {
  id: string;
  address: string; // Bitcoin address (legacy, SegWit, bech32, etc)
  label: string; // User-friendly name
  createdAt: number; // Unix timestamp
  isSyncing?: boolean; // Currently fetching balance
}

export interface BalanceSnapshot {
  id: string;
  addressId: string;
  timestamp: number; // Unix timestamp
  balanceSats: number; // Balance in sats
  balanceUsd: number; // Balance in USD at this time
  btcPrice: number; // BTC/USD price at this snapshot
}

export interface AddressData {
  address: string;
  label: string;
  currentBalanceSats: number;
  currentBalanceUsd: number;
  lastUpdated: number;
  history: BalanceSnapshot[]; // Historical snapshots
}

export interface WealthTrackerState {
  watchedAddresses: WatchedAddress[];
  balanceHistory: BalanceSnapshot[]; // All snapshots for all addresses
  lastSyncTime?: number;
  lastSyncError?: string;
}

export interface WealthSummary {
  totalSats: number;
  totalUsd: number;
  addressCount: number;
  topAddress: {
    label: string;
    balanceSats: number;
    percentOfTotal: number;
  } | null;
  weeklyChange?: {
    satsChange: number;
    usdChange: number;
    percentChange: number;
  };
}

// Helper to generate unique IDs for addresses
export function generateAddressId(): string {
  return `addr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to generate unique IDs for snapshots
export function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Calculate wealth summary from balance history and current data
export function calculateWealthSummary(
  addresses: WatchedAddress[],
  balances: Map<string, number>, // addressId -> balanceSats
  btcPriceUsd: number
): WealthSummary {
  let totalSats = 0;
  let topBalance = { label: '', sats: 0, id: '' };

  for (const addr of addresses) {
    const balance = balances.get(addr.id) || 0;
    totalSats += balance;

    if (balance > topBalance.sats) {
      topBalance = { label: addr.label, sats: balance, id: addr.id };
    }
  }

  const totalUsd = totalSats / 100_000_000 * btcPriceUsd;

  return {
    totalSats,
    totalUsd,
    addressCount: addresses.length,
    topAddress: topBalance.sats > 0
      ? {
          label: topBalance.label,
          balanceSats: topBalance.sats,
          percentOfTotal: (topBalance.sats / totalSats) * 100,
        }
      : null,
  };
}

// Validate Bitcoin address format (basic check)
export function isValidBitcoinAddress(address: string): boolean {
  // Basic validation for common Bitcoin address formats
  // Legacy: 1...  (26-35 chars, starts with 1)
  // P2SH: 3...   (26-35 chars, starts with 3)
  // Bech32: bc1... (42-62 chars, starts with bc1)

  const legacyPattern = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const p2shPattern = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const bech32Pattern = /^bc1[a-z0-9]{39,59}$/;

  return legacyPattern.test(address) || p2shPattern.test(address) || bech32Pattern.test(address);
}
