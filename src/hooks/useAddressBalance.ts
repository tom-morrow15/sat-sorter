import { useQuery } from '@tanstack/react-query';
import { useBitcoinPrice } from './useBitcoinPrice';

interface AddressBalance {
  address: string;
  balanceSats: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
}

/**
 * Fetch Bitcoin address balance from Blockstream API
 * Supports: Legacy (1...), P2SH (3...), Bech32 (bc1...)
 */
export function useAddressBalance(address: string | null) {
  const { data: priceData } = useBitcoinPrice();

  return useQuery({
    queryKey: ['address-balance', address],
    queryFn: async ({ signal }): Promise<AddressBalance | null> => {
      if (!address) return null;

      try {
        // Using Blockstream API (free, no auth needed, rate limited but generous)
        // Alternative: Mempool API would work too
        const response = await fetch(
          `https://blockstream.info/api/address/${address}`,
          { signal }
        );

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        // Blockstream API returns chain_stats for confirmed, mempool_stats for unconfirmed
        const confirmedBalance = data.chain_stats?.funded_txo_sum ?? 0;
        const unconfirmedBalance = data.mempool_stats?.funded_txo_sum ?? 0;
        const totalBalance = confirmedBalance + unconfirmedBalance;

        return {
          address,
          balanceSats: totalBalance,
          confirmedBalance,
          unconfirmedBalance,
          totalReceived: data.chain_stats?.funded_txo_sum ?? 0,
          totalSent: data.chain_stats?.spent_txo_sum ?? 0,
          txCount: (data.chain_stats?.tx_count ?? 0) + (data.mempool_stats?.tx_count ?? 0),
        };
      } catch (error) {
        console.error(`Failed to fetch balance for ${address}:`, error);
        throw error;
      }
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes (was cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Fetch multiple address balances in parallel
 */
export function useMultipleAddressBalances(addresses: (string | null)[]) {
  const { data: priceData } = useBitcoinPrice();

  const validAddresses = addresses.filter((a) => a !== null) as string[];

  return useQuery({
    queryKey: ['multi-address-balance', validAddresses.join(',')],
    queryFn: async ({ signal }): Promise<Map<string, AddressBalance>> => {
      if (validAddresses.length === 0) return new Map();

      try {
        const results = await Promise.allSettled(
          validAddresses.map((addr) =>
            fetch(`https://blockstream.info/api/address/${addr}`, { signal })
              .then((r) => {
                if (!r.ok) throw new Error(`API returned ${r.status}`);
                return r.json();
              })
              .then((data) => ({
                address: addr,
                balanceSats:
                  (data.chain_stats?.funded_txo_sum ?? 0) +
                  (data.mempool_stats?.funded_txo_sum ?? 0),
                confirmedBalance: data.chain_stats?.funded_txo_sum ?? 0,
                unconfirmedBalance: data.mempool_stats?.funded_txo_sum ?? 0,
                totalReceived: data.chain_stats?.funded_txo_sum ?? 0,
                totalSent: data.chain_stats?.spent_txo_sum ?? 0,
                txCount: (data.chain_stats?.tx_count ?? 0) + (data.mempool_stats?.tx_count ?? 0),
              }))
          )
        );

        const balanceMap = new Map<string, AddressBalance>();
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            balanceMap.set(validAddresses[index], result.value);
          }
        });

        return balanceMap;
      } catch (error) {
        console.error('Failed to fetch multiple address balances:', error);
        throw error;
      }
    },
    enabled: validAddresses.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  });
}
