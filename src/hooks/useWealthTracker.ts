import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createEncryptedSerializer } from '@/lib/secureStorage';
import { useBitcoinPrice } from './useBitcoinPrice';
import { useMultipleAddressBalances } from './useAddressBalance';
import { useWealthSync } from './useWealthSync';
import { useCurrentUser } from './useCurrentUser';
import {
  WealthTrackerState,
  generateAddressId,
  generateSnapshotId,
  calculateWealthSummary,
  dayBucket,
  dedupeHistoryByDay,
  WealthSummary,
} from '@/lib/wealthTypes';

const WEALTH_TRACKER_KEY = 'sat-sorter-wealth-tracker';

// Debounce window before pushing local wealth changes to Nostr. Long enough
// to batch rapid edits (e.g. renaming an address while the user types) but
// short enough that switching devices feels snappy.
const NOSTR_PUSH_DEBOUNCE_MS = 5_000;

const DEFAULT_STATE: WealthTrackerState = {
  watchedAddresses: [],
  balanceHistory: [],
};

/**
 * Build a stable string fingerprint of the parts of wealth state that we
 * actually care about persisting to Nostr. Used to detect whether a push is
 * needed after a local change.
 */
function persistentFingerprint(state: WealthTrackerState): string {
  return JSON.stringify({
    addresses: [...(state.watchedAddresses || [])]
      .map((a) => ({ address: a.address, label: a.label, createdAt: a.createdAt }))
      .sort((a, b) => (a.address < b.address ? -1 : 1)),
    history: [...(state.balanceHistory || [])]
      .map((s) => ({
        addressId: s.addressId,
        day: dayBucket(s.timestamp),
        sats: s.balanceSats,
      }))
      .sort((a, b) =>
        a.addressId === b.addressId
          ? a.day < b.day
            ? -1
            : 1
          : a.addressId < b.addressId
          ? -1
          : 1
      ),
  });
}

export function useWealthTracker() {
  // Encrypt wealth data at rest — it contains Bitcoin addresses and balance history
  const wealthSerializer = useMemo(() => createEncryptedSerializer<WealthTrackerState>(), []);
  const [state, setState] = useLocalStorage<WealthTrackerState>(WEALTH_TRACKER_KEY, DEFAULT_STATE, wealthSerializer);
  const { data: priceData } = useBitcoinPrice();
  const { user } = useCurrentUser();
  const { uploadWealth, canSync } = useWealthSync();

  // Fetch live balances for every watched address.
  const addresses = useMemo(
    () => state.watchedAddresses.map((a) => a.address),
    [state.watchedAddresses]
  );

  const {
    data: balanceMap,
    isLoading: isLoadingBalances,
    isFetching: isFetchingBalances,
    error: balanceError,
    refetch: refetchBalances,
  } = useMultipleAddressBalances(addresses);

  // Map live balances from `address` -> sats to `addressId` -> sats for easy lookup.
  const liveBalancesById = useMemo(() => {
    const map = new Map<string, number>();
    if (!balanceMap) return map;

    for (const watched of state.watchedAddresses) {
      const live = balanceMap.get(watched.address);
      if (live) {
        map.set(watched.id, live.balanceSats);
      }
    }
    return map;
  }, [balanceMap, state.watchedAddresses]);

  // When fresh balances come in, record daily snapshots. We keep at most one
  // snapshot per address per UTC day — the latest one wins — so the synced
  // history stays compact no matter how often the user refreshes.
  useEffect(() => {
    if (!priceData || !balanceMap || balanceMap.size === 0) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const today = dayBucket(nowSec);

    setState((prev) => {
      let changed = false;
      // Snapshots we're keeping from history, indexed for fast edit-in-place.
      const historyByKey = new Map<string, (typeof prev.balanceHistory)[number]>();
      for (const snap of prev.balanceHistory) {
        historyByKey.set(`${snap.addressId}|${dayBucket(snap.timestamp)}`, snap);
      }

      for (const watched of prev.watchedAddresses) {
        const live = balanceMap.get(watched.address);
        if (!live) continue;

        const key = `${watched.id}|${today}`;
        const existing = historyByKey.get(key);

        // Only record a new snapshot if we don't have one today, or if today's
        // recorded balance differs from what we just fetched.
        if (!existing || existing.balanceSats !== live.balanceSats) {
          historyByKey.set(key, {
            id: existing?.id || generateSnapshotId(),
            addressId: watched.id,
            timestamp: nowSec,
            balanceSats: live.balanceSats,
            balanceUsd: (live.balanceSats / 100_000_000) * priceData.usdPerBtc,
            btcPrice: priceData.usdPerBtc,
          });
          changed = true;
        }
      }

      if (!changed) return prev;

      return {
        ...prev,
        balanceHistory: Array.from(historyByKey.values()).sort(
          (a, b) => a.timestamp - b.timestamp
        ),
        lastSyncTime: nowSec,
        lastSyncError: undefined,
      };
    });
  }, [balanceMap, priceData, setState]);

  // Persist the last error if a fetch fails.
  useEffect(() => {
    if (!balanceError) return;
    setState((prev) => ({
      ...prev,
      lastSyncError: balanceError instanceof Error ? balanceError.message : String(balanceError),
    }));
  }, [balanceError, setState]);

  // --- Nostr auto-push ---------------------------------------------------
  //
  // Whenever the persistent parts of wealth state change (addresses added /
  // removed / renamed, or a new daily snapshot is recorded), push the state
  // to Nostr after a short debounce. This keeps devices in sync automatically
  // — no "Save" button needed like the budget flow.
  const lastPushedFingerprint = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user?.pubkey || !canSync) return;
    // Don't push an empty state — NostrSync hasn't finished downloading yet,
    // or the user really has no addresses. Either way, uploadWealth's guard
    // would reject it, so no point scheduling.
    if (state.watchedAddresses.length === 0) return;

    const fingerprint = persistentFingerprint(state);

    // First run for this user session: just record the baseline. Don't push
    // yet — NostrSync may still be merging data in. This avoids a race where
    // we push stale local state over richer remote data.
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastPushedFingerprint.current = fingerprint;
      return;
    }

    if (fingerprint === lastPushedFingerprint.current) return;

    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      const latest = persistentFingerprint(state);
      // Another change may have arrived while we were debouncing.
      if (latest === lastPushedFingerprint.current) return;

      const ok = await uploadWealth(state);
      if (ok) {
        lastPushedFingerprint.current = latest;
      }
    }, NOSTR_PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, user?.pubkey, canSync, uploadWealth]);

  // When the user changes (login / logout), reset the push baseline so the
  // next user's state doesn't get pushed under the wrong identity.
  useEffect(() => {
    hasInitialized.current = false;
    lastPushedFingerprint.current = null;
  }, [user?.pubkey]);

  // --- Mutations ---------------------------------------------------------

  // Add a new address to watch.
  const addAddress = useCallback(
    (address: string, label: string) => {
      setState((prev) => {
        // Avoid adding the same address twice.
        if (prev.watchedAddresses.some((a) => a.address === address)) {
          return prev;
        }
        return {
          ...prev,
          watchedAddresses: [
            ...prev.watchedAddresses,
            {
              id: generateAddressId(),
              address,
              label,
              createdAt: Math.floor(Date.now() / 1000),
            },
          ],
          // Un-tombstone: re-adding a previously deleted address is an
          // explicit act — the deletion no longer applies.
          deletedAddresses: (prev.deletedAddresses || []).filter(
            (a) => a !== address
          ),
        };
      });
    },
    [setState]
  );

  // Remove an address from the watch list.
  const removeAddress = useCallback(
    (addressId: string) => {
      setState((prev) => {
        const removed = prev.watchedAddresses.find((a) => a.id === addressId);
        return {
          ...prev,
          watchedAddresses: prev.watchedAddresses.filter((a) => a.id !== addressId),
          balanceHistory: prev.balanceHistory.filter((b) => b.addressId !== addressId),
          // Tombstone the BTC address so the deletion survives the wealth sync
          // merge instead of resurrecting on the next snapshot union.
          deletedAddresses: removed?.address
            ? [...(prev.deletedAddresses || []), removed.address]
            : prev.deletedAddresses,
        };
      });
    },
    [setState]
  );

  // Update address label.
  const updateAddressLabel = useCallback(
    (addressId: string, newLabel: string) => {
      setState((prev) => ({
        ...prev,
        watchedAddresses: prev.watchedAddresses.map((a) =>
          a.id === addressId ? { ...a, label: newLabel } : a
        ),
      }));
    },
    [setState]
  );

  // Manual balance recording — still exposed for power users / tests.
  const recordBalance = useCallback(
    (addressId: string, balanceSats: number) => {
      if (!priceData) return;

      setState((prev) => ({
        ...prev,
        balanceHistory: dedupeHistoryByDay([
          ...prev.balanceHistory,
          {
            id: generateSnapshotId(),
            addressId,
            timestamp: Math.floor(Date.now() / 1000),
            balanceSats,
            balanceUsd: (balanceSats / 100_000_000) * priceData.usdPerBtc,
            btcPrice: priceData.usdPerBtc,
          },
        ]),
      }));
    },
    [setState, priceData]
  );

  // All snapshots for a given address, sorted oldest -> newest.
  const getAddressHistory = useCallback(
    (addressId: string) => {
      return state.balanceHistory
        .filter((b) => b.addressId === addressId)
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    [state.balanceHistory]
  );

  // Get the live balance for a single watched address (in sats).
  const getLiveBalance = useCallback(
    (addressId: string) => liveBalancesById.get(addressId),
    [liveBalancesById]
  );

  // Calculate wealth summary using LIVE balances (fallback to last snapshot).
  const wealthSummary = useMemo<WealthSummary | null>(() => {
    if (!priceData) return null;

    const balances = new Map<string, number>();
    for (const addr of state.watchedAddresses) {
      const live = liveBalancesById.get(addr.id);
      if (live !== undefined) {
        balances.set(addr.id, live);
        continue;
      }
      // Fallback: use most recent stored snapshot if live balance isn't ready yet.
      const history = state.balanceHistory.filter((b) => b.addressId === addr.id);
      if (history.length > 0) {
        const latest = history.sort((a, b) => a.timestamp - b.timestamp)[history.length - 1];
        balances.set(addr.id, latest.balanceSats);
      }
    }

    return calculateWealthSummary(state.watchedAddresses, balances, priceData.usdPerBtc);
  }, [state.watchedAddresses, state.balanceHistory, liveBalancesById, priceData]);

  // Weekly change based on stored snapshots.
  const getWeeklyChange = useCallback(() => {
    if (!priceData || state.balanceHistory.length < 2) return null;

    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;

    const addressChanges: {
      addressId: string;
      oldSats: number;
      newSats: number;
      oldUsd: number;
      newUsd: number;
    }[] = [];

    for (const address of state.watchedAddresses) {
      const history = state.balanceHistory
        .filter((b) => b.addressId === address.id)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Closest snapshot at-or-before a week ago.
      const oldSnapshot = [...history].reverse().find((b) => b.timestamp <= weekAgo);
      const newSnapshot = history.length > 0 ? history[history.length - 1] : null;

      if (oldSnapshot && newSnapshot) {
        addressChanges.push({
          addressId: address.id,
          oldSats: oldSnapshot.balanceSats,
          newSats: newSnapshot.balanceSats,
          oldUsd: oldSnapshot.balanceUsd,
          newUsd: newSnapshot.balanceUsd,
        });
      }
    }

    if (addressChanges.length === 0) return null;

    const totalOldSats = addressChanges.reduce((sum, a) => sum + a.oldSats, 0);
    const totalNewSats = addressChanges.reduce((sum, a) => sum + a.newSats, 0);
    const totalOldUsd = addressChanges.reduce((sum, a) => sum + a.oldUsd, 0);
    const totalNewUsd = addressChanges.reduce((sum, a) => sum + a.newUsd, 0);

    return {
      satsChange: totalNewSats - totalOldSats,
      usdChange: totalNewUsd - totalOldUsd,
      percentChange: totalOldSats > 0 ? ((totalNewSats - totalOldSats) / totalOldSats) * 100 : 0,
    };
  }, [state.watchedAddresses, state.balanceHistory, priceData]);

  return {
    // State
    watchedAddresses: state.watchedAddresses,
    balanceHistory: state.balanceHistory,
    wealthSummary,
    liveBalancesById,
    lastSyncTime: state.lastSyncTime,
    lastSyncError: state.lastSyncError,

    // Loading / error state for live fetches
    isLoadingBalances,
    isFetchingBalances,
    balanceError,

    // Nostr sync status
    canSyncToNostr: canSync,

    // Actions
    addAddress,
    removeAddress,
    updateAddressLabel,
    recordBalance,
    refetchBalances,

    // Queries
    getAddressHistory,
    getLiveBalance,
    getWeeklyChange: getWeeklyChange(),
  };
}
