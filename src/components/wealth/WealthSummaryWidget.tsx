import { Coins, Layers, Crown } from 'lucide-react';
import { WealthSummary } from '@/lib/wealthTypes';
import { formatSats } from '@/hooks/useBitcoinPrice';
import type { BPData } from '@/hooks/useBitcoinPrice';

interface WealthSummaryWidgetProps {
  summary: WealthSummary;
  priceData: BPData | undefined;
}

export function WealthSummaryWidget({ summary, priceData }: WealthSummaryWidgetProps) {
  if (!priceData) return null;

  const formatUsd = (usd: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(usd);
  const formatBtc = (sats: number) => (sats / 100_000_000).toFixed(8);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Total Wealth — primary/hero card */}
      <div className="surface-card p-5 sm:col-span-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-xl bg-primary/12 flex items-center justify-center">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Wealth</p>
          </div>
          <p className="font-num text-3xl leading-none">{formatUsd(summary.totalUsd)}</p>
          <p className="text-xs text-muted-foreground mt-2 tabular-nums">{formatBtc(summary.totalSats)} BTC</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatSats(summary.totalSats)} sats</p>
        </div>
      </div>

      {/* Addresses */}
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-xl bg-blue-500/12 flex items-center justify-center">
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Addresses</p>
        </div>
        <p className="font-num text-3xl leading-none">{summary.addressCount}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {summary.addressCount === 1 ? 'address' : 'addresses'} monitored
        </p>
      </div>

      {/* Top address / status */}
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-xl bg-amber-500/12 flex items-center justify-center">
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {summary.topAddress ? 'Top Address' : 'Status'}
          </p>
        </div>
        {summary.topAddress ? (
          <>
            <p className="font-display text-lg leading-tight truncate">{summary.topAddress.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.topAddress.percentOfTotal.toFixed(1)}% of total</p>
            <p className="text-xs font-mono text-muted-foreground tabular-nums">{formatBtc(summary.topAddress.balanceSats)} BTC</p>
          </>
        ) : (
          <>
            <p className="font-num text-3xl leading-none">—</p>
            <p className="text-xs text-muted-foreground mt-2">No addresses added</p>
          </>
        )}
      </div>
    </div>
  );
}
