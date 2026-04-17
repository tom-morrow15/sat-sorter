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

/**
 * Convert a Unix timestamp (seconds) to a UTC day bucket key ("YYYY-MM-DD").
 * Used to keep at most one snapshot per address per day, so historical data
 * stays compact when synced across devices.
 */
export function dayBucket(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Collapse balance history so there's at most one snapshot per address per
 * UTC day. When multiple snapshots exist for the same address on the same
 * day, the latest one wins. Returns snapshots sorted oldest -> newest.
 */
export function dedupeHistoryByDay(history: BalanceSnapshot[]): BalanceSnapshot[] {
  const byKey = new Map<string, BalanceSnapshot>();
  for (const snap of history) {
    const key = `${snap.addressId}|${dayBucket(snap.timestamp)}`;
    const existing = byKey.get(key);
    if (!existing || snap.timestamp > existing.timestamp) {
      byKey.set(key, snap);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Merge two wealth tracker states without losing user data.
 *
 * Watched addresses are merged by their `address` string (not by `id`, which
 * is only meaningful within a single device). If both sides have the same
 * Bitcoin address, we keep the entry with the earliest createdAt (so the id
 * stays stable) but prefer the most recent label.
 *
 * Balance history is merged across both sides with day-level deduplication,
 * and all addressIds are rewritten to the merged address id so cross-device
 * history lines up on a single timeline.
 */
export function mergeWealthStates(
  local: WealthTrackerState,
  remote: WealthTrackerState
): WealthTrackerState {
  // Build a merged address list keyed by the btc address itself.
  type MergedAddress = WatchedAddress & { _idAliases: Set<string> };
  const byBtcAddr = new Map<string, MergedAddress>();

  const ingest = (addrs: WatchedAddress[], isRemote: boolean) => {
    for (const a of addrs) {
      if (!a || !a.address) continue;
      const existing = byBtcAddr.get(a.address);
      if (!existing) {
        byBtcAddr.set(a.address, {
          ...a,
          _idAliases: new Set([a.id]),
        });
      } else {
        existing._idAliases.add(a.id);
        // Keep the earliest createdAt so we have a stable creation date.
        if (a.createdAt && (!existing.createdAt || a.createdAt < existing.createdAt)) {
          existing.createdAt = a.createdAt;
        }
        // Prefer the remote label on ties — that's what the user explicitly
        // saved — but only if it's non-empty.
        if (isRemote && a.label && a.label.trim()) {
          existing.label = a.label;
        } else if (!existing.label && a.label) {
          existing.label = a.label;
        }
      }
    }
  };

  ingest(local.watchedAddresses || [], false);
  ingest(remote.watchedAddresses || [], true);

  // Build an alias map: any id ever used for an address -> the canonical id
  // we'll keep in the merged state.
  const idRemap = new Map<string, string>();
  const mergedAddresses: WatchedAddress[] = [];
  for (const merged of byBtcAddr.values()) {
    const { _idAliases, ...rest } = merged;
    for (const alias of _idAliases) {
      idRemap.set(alias, rest.id);
    }
    mergedAddresses.push(rest);
  }

  // Combine histories, rewriting addressIds through the remap so snapshots
  // for the same BTC address all share the same addressId.
  const allHistory: BalanceSnapshot[] = [];
  const pushAll = (items: BalanceSnapshot[]) => {
    for (const s of items || []) {
      if (!s || !s.addressId) continue;
      const canonicalId = idRemap.get(s.addressId);
      if (!canonicalId) continue; // orphan snapshot (address was deleted)
      allHistory.push({ ...s, addressId: canonicalId });
    }
  };
  pushAll(local.balanceHistory || []);
  pushAll(remote.balanceHistory || []);

  const mergedHistory = dedupeHistoryByDay(allHistory);

  const lastSyncTime = Math.max(
    local.lastSyncTime || 0,
    remote.lastSyncTime || 0
  );

  return {
    watchedAddresses: mergedAddresses,
    balanceHistory: mergedHistory,
    lastSyncTime: lastSyncTime || undefined,
    // Don't carry over old error messages after a successful merge.
    lastSyncError: undefined,
  };
}

/**
 * A small "richness" score used to detect whether a remote snapshot has more
 * data than a local one — mirrors the safety guard in useBudgetSync so we
 * never accidentally overwrite a device's richer state with a stub.
 */
export function scoreWealthState(state: WealthTrackerState): number {
  const addrCount = state.watchedAddresses?.length || 0;
  const histCount = state.balanceHistory?.length || 0;
  return addrCount * 1000 + histCount;
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
