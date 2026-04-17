import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WatchedAddress, BalanceSnapshot } from '@/lib/wealthTypes';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WealthChartProps {
  watchedAddresses: WatchedAddress[];
  balanceHistory: BalanceSnapshot[];
}

interface ChartPoint {
  timestamp: number;
  dateLabel: string;
  totalSats: number;
  totalUsd: number;
}

/**
 * Build a "total wealth over time" series from per-address snapshots.
 *
 * Because snapshots arrive at different times for different addresses, at each
 * timestamp we sum the most recent known balance for every address.
 */
function buildChartSeries(
  addresses: WatchedAddress[],
  history: BalanceSnapshot[]
): ChartPoint[] {
  if (addresses.length === 0 || history.length === 0) return [];

  // Sort all snapshots by time.
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

  // Track the latest-known balance (sats + usd) per address.
  const latestSats = new Map<string, number>();
  const latestUsd = new Map<string, number>();

  const points: ChartPoint[] = [];

  for (const snap of sorted) {
    latestSats.set(snap.addressId, snap.balanceSats);
    latestUsd.set(snap.addressId, snap.balanceUsd);

    let totalSats = 0;
    let totalUsd = 0;
    for (const addr of addresses) {
      totalSats += latestSats.get(addr.id) ?? 0;
      totalUsd += latestUsd.get(addr.id) ?? 0;
    }

    const date = new Date(snap.timestamp * 1000);
    points.push({
      timestamp: snap.timestamp,
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      totalSats,
      totalUsd,
    });
  }

  return points;
}

function formatUsd(usd: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(usd);
}

export function WealthChart({ watchedAddresses, balanceHistory }: WealthChartProps) {
  const data = useMemo(
    () => buildChartSeries(watchedAddresses, balanceHistory),
    [watchedAddresses, balanceHistory]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wealth History</CardTitle>
        <CardDescription>
          Track your total Bitcoin holdings over time (USD)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <div className="h-64 flex items-center justify-center bg-muted/40 rounded-lg border border-dashed">
            <div className="text-center px-6">
              <p className="text-sm font-medium text-muted-foreground">
                Not enough history yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Refresh your balances over time to build a history chart.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="wealthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(v) => formatUsd(v as number)}
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value: number) => [formatUsd(value), 'Total']}
                />
                <Area
                  type="monotone"
                  dataKey="totalUsd"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#wealthFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
