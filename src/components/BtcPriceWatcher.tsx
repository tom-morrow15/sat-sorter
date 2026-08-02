import { useEffect, useRef } from 'react';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { useToast } from '@/hooks/useToast';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Shows a fun, Bitcoin-native toast when the BTC price moves significantly
 * between price fetches (every 60 seconds).
 *
 * - Up 2%+: "Your sats are worth more today 🚀"
 * - Down 2%+: "Sats are on sale — time to stack 📉"
 *
 * Only fires once per significant move (not on every refetch) and only
 * after the second price reading (so we have a baseline to compare).
 */
const SIGNIFICANT_MOVE_THRESHOLD = 0.02; // 2%

export function BtcPriceWatcher() {
  const { data: priceData } = useBitcoinPrice();
  const { toast } = useToast();
  const lastPriceRef = useRef<number | null>(null);
  const lastToastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!priceData?.usdPerBtc) return;

    const currentPrice = priceData.usdPerBtc;

    // First reading — just record the baseline, don't toast
    if (lastPriceRef.current === null) {
      lastPriceRef.current = currentPrice;
      return;
    }

    const prevPrice = lastPriceRef.current;
    const changePct = (currentPrice - prevPrice) / prevPrice;

    // Only toast on significant moves, and throttle to once per 5 minutes
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (Math.abs(changePct) >= SIGNIFICANT_MOVE_THRESHOLD && now - lastToastTimeRef.current > fiveMinutes) {
      lastToastTimeRef.current = now;
      lastPriceRef.current = currentPrice;

      const formattedPrice = currentPrice.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });

      if (changePct > 0) {
        toast({
          title: 'Your sats are worth more 🚀',
          description: `Bitcoin is up ${(changePct * 100).toFixed(1)}% — now ${formattedPrice}.`,
        });
      } else {
        toast({
          title: 'Sats are on sale — time to stack 📉',
          description: `Bitcoin is down ${Math.abs(changePct * 100).toFixed(1)}% — now ${formattedPrice}.`,
        });
      }
    } else {
      // Update the baseline even for small moves so we always compare to the last reading
      lastPriceRef.current = currentPrice;
    }
  }, [priceData?.usdPerBtc, toast]);

  return null;
}
