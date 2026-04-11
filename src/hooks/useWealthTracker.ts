import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useBitcoinPrice } from './useBitcoinPrice';
import {
  WealthTrackerState,
  WatchedAddress,
  BalanceSnapshot,
  generateAddressId,
  generateSnapshotId,
  calculateWealthSummary,
  WealthSummary,
} from '@/lib/wealthTypes';

const WEALTH_TRACKER_KEY = 'sat-sorter-wealth-tracker';

const DEFAULT_STATE: WealthTrackerState = {
  watchedAddresses: [],
  balanceHistory: [],
};

export function useWealthTracker() {
  const [state, setState] = useLocalStorage<WealthTrackerState>(WEALTH_TRACKER_KEY, DEFAULT_STATE);
  const { data: priceData } = useBitcoinPrice();

  // Add a new address to watch
  const addAddress = useCallback(
    (address: string, label: string) => {
      setState((prev) => ({
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
      }));
    },
    [setState]
  );

  // Remove an address from watch list
  const removeAddress = useCallback(
    (addressId: string) => {
      setState((prev) => ({
        ...prev,
        watchedAddresses: prev.watchedAddresses.filter((a) => a.id !== addressId),
        // Also remove balance history for this address
        balanceHistory: prev.balanceHistory.filter((b) => b.addressId !== addressId),
      }));
    },
    [setState]
  );

  // Update address label
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

  // Record a balance snapshot
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

  // Get all balance snapshots for an address
  const getAddressHistory = useCallback(
    (addressId: string) => {
      return state.balanceHistory
        .filter((b) => b.addressId === addressId)
        .sort((a, b) => a.timestamp - b.timestamp);
    },
    [state.balanceHistory]
  );

  // Calculate wealth summary
  const wealthSummary = useMemo<WealthSummary | null>(() => {
    if (!priceData) return null;

    // Get latest balance for each address
    const latestBalances = new Map<string, number>();
    for (const addressId of state.watchedAddresses.map((a) => a.id)) {
      const history = state.balanceHistory.filter((b) => b.addressId === addressId);
      if (history.length > 0) {
        const latest = history[history.length - 1];
        latestBalances.set(addressId, latest.balanceSats);
      }
    }

    return calculateWealthSummary(state.watchedAddresses, latestBalances, priceData.usdPerBtc);
  }, [state.watchedAddresses, state.balanceHistory, priceData]);

  // Get weekly change
  const getWeeklyChange = useCallback(() => {
    if (!priceData || state.balanceHistory.length < 2) return null;

    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;

    // Group by address and get snapshots from a week ago and now
    const addressChanges: { addressId: string; oldSats: number; newSats: number; oldUsd: number; newUsd: number }[] = [];

    for (const address of state.watchedAddresses) {
      const history = state.balanceHistory.filter((b) => b.addressId === address.id);
      const oldSnapshot = history.find((b) => b.timestamp <= weekAgo);
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

    // Actions
    addAddress,
    removeAddress,
    updateAddressLabel,
    recordBalance,

    // Queries
    getAddressHistory,
    getWeeklyChange: getWeeklyChange(),
  };
}
