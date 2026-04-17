import { useQuery } from '@tanstack/react-query';

export interface AddressBalance {
  address: string;
  balanceSats: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
}

// Mempool.space supports CORS out-of-the-box and mirrors Blockstream's API shape.
// Blockstream.info is kept as a fallback via the Shakespeare CORS proxy.
const PRIMARY_API = 'https://mempool.space/api/address';
const FALLBACK_API = 'https://proxy.shakespeare.diy/?url=https%3A%2F%2Fblockstream.info%2Fapi%2Faddress';

interface ChainStats {
  funded_txo_sum?: number;
  spent_txo_sum?: number;
  tx_count?: number;
}

interface AddressApiResponse {
  address?: string;
  chain_stats?: ChainStats;
  mempool_stats?: ChainStats;
}

function parseAddressData(address: string, data: AddressApiResponse): AddressBalance {
  const chainFunded = data.chain_stats?.funded_txo_sum ?? 0;
  const chainSpent = data.chain_stats?.spent_txo_sum ?? 0;
  const mempoolFunded = data.mempool_stats?.funded_txo_sum ?? 0;
  const mempoolSpent = data.mempool_stats?.spent_txo_sum ?? 0;

  // Current balance = funded - spent (applied across both chain and mempool).
  const confirmedBalance = chainFunded - chainSpent;
  const unconfirmedBalance = mempoolFunded - mempoolSpent;
  const totalBalance = confirmedBalance + unconfirmedBalance;

  return {
    address,
    balanceSats: totalBalance,
    confirmedBalance,
    unconfirmedBalance,
    totalReceived: chainFunded,
    totalSent: chainSpent,
    txCount: (data.chain_stats?.tx_count ?? 0) + (data.mempool_stats?.tx_count ?? 0),
  };
}

async function fetchAddress(address: string, signal?: AbortSignal): Promise<AddressBalance> {
  let lastError: unknown;

  for (const base of [PRIMARY_API, FALLBACK_API]) {
    try {
      const response = await fetch(`${base}/${address}`, { signal });
      if (!response.ok) {
        lastError = new Error(`API returned ${response.status}`);
        continue;
      }
      const data = (await response.json()) as AddressApiResponse;
      return parseAddressData(address, data);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to fetch address balance from all providers');
}

/**
 * Fetch Bitcoin address balance.
 * Supports: Legacy (1...), P2SH (3...), Bech32 (bc1...)
 */
export function useAddressBalance(address: string | null) {
  return useQuery({
    queryKey: ['address-balance', address],
    queryFn: async ({ signal }): Promise<AddressBalance | null> => {
      if (!address) return null;
      return fetchAddress(address, signal);
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Fetch multiple address balances in parallel.
 */
export function useMultipleAddressBalances(addresses: (string | null)[]) {
  const validAddresses = addresses.filter((a): a is string => !!a);

  return useQuery({
    queryKey: ['multi-address-balance', [...validAddresses].sort().join(',')],
    queryFn: async ({ signal }): Promise<Map<string, AddressBalance>> => {
      if (validAddresses.length === 0) return new Map();

      const results = await Promise.allSettled(
        validAddresses.map((addr) => fetchAddress(addr, signal))
      );

      const balanceMap = new Map<string, AddressBalance>();
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          balanceMap.set(validAddresses[index], result.value);
        } else {
          console.error(`Failed to fetch balance for ${validAddresses[index]}:`, result.reason);
        }
      });

      return balanceMap;
    },
    enabled: validAddresses.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
}
