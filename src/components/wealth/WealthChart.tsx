import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WatchedAddress } from '@/lib/wealthTypes';

interface WealthChartProps {
  watchedAddresses: WatchedAddress[];
}

export function WealthChart({ watchedAddresses }: WealthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wealth History</CardTitle>
        <CardDescription>
          Track your total Bitcoin holdings over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg border-2 border-dashed">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              📊 Chart coming soon
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Historical balance data will be visualized here
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
