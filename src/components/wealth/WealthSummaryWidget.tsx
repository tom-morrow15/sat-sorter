import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { WealthSummary } from '@/lib/wealthTypes';
import { formatSats } from '@/hooks/useBitcoinPrice';
import type { BPData } from '@/hooks/useBitcoinPrice';

interface WealthSummaryWidgetProps {
  summary: WealthSummary;
  priceData: BPData | undefined;
}

export function WealthSummaryWidget({ summary, priceData }: WealthSummaryWidgetProps) {
  if (!priceData) return null;

  const formatUsd = (usd: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(usd);
  };

  const formatBtc = (sats: number) => {
    return (sats / 100_000_000).toFixed(8);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Wealth */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Total Wealth</p>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{formatUsd(summary.totalUsd)}</p>
              <p className="text-xs text-muted-foreground">{formatBtc(summary.totalSats)} BTC</p>
              <p className="text-xs text-muted-foreground">
                {formatSats(summary.totalSats)} sats
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addresses Monitored */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Addresses</p>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{summary.addressCount}</p>
              <p className="text-xs text-muted-foreground">
                {summary.addressCount === 1 ? 'address' : 'addresses'} monitored
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Address or Weekly Change */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {summary.topAddress ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">Top Address</p>
                <div className="space-y-1">
                  <p className="text-sm font-semibold truncate">{summary.topAddress.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {summary.topAddress.percentOfTotal.toFixed(1)}% of total
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {formatBtc(summary.topAddress.balanceSats)} BTC
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">-</p>
                  <p className="text-xs text-muted-foreground">No addresses added</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
