import { useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useBitcoinPrice } from './useBitcoinPrice';
import { useMultipleAddressBalances } from './useAddressBalance';
import {
  WealthTrackerState,
  generateAddressId,
  generateSnapshotId,
  calculateWealthSummary,
  WealthSummary,
} from '@/lib/wealthTypes';

const WEALTH_TRACKER_KEY = 'sat-sorter-wealth-tracker';

// Only record a new snapshot for an address when it's been this long since the
// last snapshot OR when the balance actually changed. Prevents history spam.
const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

const DEFAULT_STATE: WealthTrackerState = {
  watchedAddresses: [],
  balanceHistory: [],
};

export function useWealthTracker() {
  const [state, setState] = useLocalStorage<WealthTrackerState>(WEALTH_TRACKER_KEY, DEFAULT_STATE);
  const { data: priceData } = useBitcoinPrice();

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

  // Whenever fresh balances come in, persist a snapshot so we can build the
  // wealth-over-time chart.
  useEffect(() => {
    if (!priceData || !balanceMap || balanceMap.size === 0) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    setState((prev) => {
      const newSnapshots = [...prev.balanceHistory];
      let changed = false;

      for (const watched of prev.watchedAddresses) {
        const live = balanceMap.get(watched.address);
        if (!live) continue;

        // Find the most recent snapshot for this address.
        const history = prev.balanceHistory
          .filter((b) => b.addressId === watched.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const last = history[history.length - 1];

        const balanceChanged = !last || last.balanceSats !== live.balanceSats;
        const enoughTimePassed =
          !last || nowMs - last.timestamp * 1000 >= SNAPSHOT_THROTTLE_MS;

        if (balanceChanged || enoughTimePassed) {
          newSnapshots.push({
            id: generateSnapshotId(),
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
        balanceHistory: newSnapshots,
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
        };
      });
    },
    [setState]
  );

  // Remove an address from the watch list.
  const removeAddress = useCallback(
    (addressId: string) => {
      setState((prev) => ({
        ...prev,
        watchedAddresses: prev.watchedAddresses.filter((a) => a.id !== addressId),
        balanceHistory: prev.balanceHistory.filter((b) => b.addressId !== addressId),
      }));
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
        balanceHistory: [
          ...prev.balanceHistory,
          {
            id: generateSnapshotId(),
            addressId,
            timestamp: Math.floor(Date.now() / 1000),
            balanceSats,
            balanceUsd: (balanceSats / 100_000_000) * priceData.usdPerBtc,
            btcPrice: priceData.usdPerBtc,
          },
        ],
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
