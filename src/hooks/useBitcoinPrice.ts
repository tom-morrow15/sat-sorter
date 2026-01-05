import { useQuery } from '@tanstack/react-query';

interface PriceData {
  usdPerBtc: number;
  satsPerUsd: number;
  lastUpdated: Date;
}

interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
  };
}

const SATS_PER_BTC = 100_000_000;

async function fetchBitcoinPrice(): Promise<PriceData> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    { signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch Bitcoin price');
  }

  const data: CoinGeckoResponse = await response.json();
  const usdPerBtc = data.bitcoin.usd;
  const satsPerUsd = SATS_PER_BTC / usdPerBtc;

  return {
    usdPerBtc,
    satsPerUsd,
    lastUpdated: new Date(),
  };
}

export function useBitcoinPrice() {
  return useQuery({
    queryKey: ['bitcoin-price'],
    queryFn: fetchBitcoinPrice,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refetch every minute
    retry: 3,
  });
}

// Conversion utilities
export function satsToUsd(sats: number, usdPerBtc: number): number {
  return (sats / SATS_PER_BTC) * usdPerBtc;
}

export function usdToSats(usd: number, usdPerBtc: number): number {
  return Math.round((usd / usdPerBtc) * SATS_PER_BTC);
}

// Format sats with comma separators
export function formatSats(sats: number): string {
  return sats.toLocaleString('en-US');
}

// Format USD
export function formatUsd(usd: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd);
}
