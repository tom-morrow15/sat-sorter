import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateRemainingToBudget,
  formatMonth,
} from '@/lib/budgetTypes';
import type { Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface BudgetHeaderProps {
  buckets: Bucket[];
  currentMonth: string;
  currency: 'sats' | 'usd';
  onToggleCurrency: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onOpenWallet: () => void;
}

export function BudgetHeader({
  buckets,
  currentMonth,
  currency,
  onToggleCurrency,
  onPreviousMonth,
  onNextMonth,
  onOpenWallet,
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { isDark, toggle: toggleTheme } = useTheme();

  const totalIncome = calculateTotalIncome(buckets);
  const totalExpenses = calculateTotalExpenses(buckets);
  const remaining = calculateRemainingToBudget(buckets);

  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  const isZeroed = remaining === 0 && totalIncome > 0;
  const isOver = remaining < 0;
  const isUnder = remaining > 0 && totalIncome > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        {/* Top bar with logo and actions */}
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg bitcoin-glow">
                <Bitcoin className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Sat Sorter</h1>
              <p className="text-xs text-muted-foreground">Zero-based budgeting</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bitcoin Price */}
            {priceData && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="hidden sm:flex gap-1 font-mono text-xs">
                    <Bitcoin className="h-3 w-3" />
                    {formatUsd(priceData.usdPerBtc)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current Bitcoin price</p>
                  <p className="text-xs text-muted-foreground">
                    1 sat = {formatUsd(priceData.usdPerBtc / 100_000_000)}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Currency Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleCurrency}
                  className="gap-1"
                  disabled={priceLoading}
                >
                  {currency === 'sats' ? (
                    <>
                      <Bitcoin className="h-4 w-4" />
                      <span className="hidden sm:inline">Sats</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4" />
                      <span className="hidden sm:inline">USD</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Switch to {currency === 'sats' ? 'USD' : 'Sats'} view
              </TooltipContent>
            </Tooltip>

            {/* Wallet Button */}
            <Button variant="outline" size="sm" onClick={onOpenWallet} className="gap-1">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
            </Button>

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Budget summary bar */}
        <div className="py-4 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[180px] text-center">
              {formatMonth(currentMonth)}
            </h2>
            <Button variant="ghost" size="icon" onClick={onNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Budget totals */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Income</p>
              <p className="text-lg font-bold text-success tabular-nums">
                {formatAmount(totalIncome)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Planned</p>
              <p className="text-lg font-bold tabular-nums">
                {formatAmount(totalExpenses)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Left to Budget
              </p>
              <p
                className={cn(
                  'text-lg font-bold tabular-nums',
                  isZeroed && 'text-success',
                  isOver && 'text-destructive',
                  isUnder && 'text-primary'
                )}
              >
                {formatAmount(remaining)}
              </p>
            </div>
          </div>

          {/* Zero-based budget indicator */}
          <div className="flex justify-center">
            {isZeroed ? (
              <Badge className="bg-success text-success-foreground">
                ✓ Every sat has a job!
              </Badge>
            ) : isOver ? (
              <Badge variant="destructive">
                ⚠ You're over budget by {formatAmount(Math.abs(remaining))}
              </Badge>
            ) : totalIncome > 0 ? (
              <Badge variant="secondary" className="text-primary">
                {formatAmount(remaining)} left to assign
              </Badge>
            ) : (
              <Badge variant="secondary">
                Start by adding your income
              </Badge>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
