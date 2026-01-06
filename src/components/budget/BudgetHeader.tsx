import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Moon, Sun, Zap } from 'lucide-react';
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
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import { useAppContext } from '@/hooks/useAppContext';

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

  // Compact format for mobile
  const formatAmountCompact = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    // Compact format: 1.2M, 50K, etc.
    if (sats >= 1_000_000) {
      return `${(sats / 1_000_000).toFixed(1)}M`;
    }
    if (sats >= 1_000) {
      return `${(sats / 1_000).toFixed(0)}K`;
    }
    return formatSats(sats);
  };

  const isZeroed = remaining === 0 && totalIncome > 0;
  const isOver = remaining < 0;
  const isUnder = remaining > 0 && totalIncome > 0;

  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  const logoStyle = config.logoStyle || 'bitcoin';

  const toggleLogo = () => {
    updateConfig((c) => ({ ...c, logoStyle: c.logoStyle === 'sats' ? 'bitcoin' : 'sats' }));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
      <div className="container mx-auto px-3 sm:px-4">
        {/* Top bar with logo and actions */}
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button onClick={toggleLogo} className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg bitcoin-glow">
                {logoStyle === 'bitcoin' ? (
                  <Bitcoin className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                ) : (
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                )}
              </button>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Sat Sorter</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Zero-based budgeting</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Bitcoin Price - Hidden on small mobile */}
            {priceData && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="hidden md:flex gap-1 font-mono text-xs">
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
                  size="icon"
                  onClick={onToggleCurrency}
                  disabled={priceLoading}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  {currency === 'sats' ? (
                    <Bitcoin className="h-4 w-4" />
                  ) : (
                    <DollarSign className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Switch to {currency === 'sats' ? 'USD' : 'Sats'} view
              </TooltipContent>
            </Tooltip>

            {/* Wallet Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onOpenWallet}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Wallet</TooltipContent>
            </Tooltip>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 sm:h-9 sm:w-9"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* User avatar / account switcher */}
            {user ? (
              <div className="ml-1">
                <AccountSwitcher onAddAccountClick={() => { /* noop */ }} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Budget summary bar - More compact */}
        <div className="py-3 sm:py-4 space-y-3">
          {/* Month navigation */}
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onPreviousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <h2 className="text-base sm:text-lg font-semibold min-w-[140px] sm:min-w-[180px] text-center">
              {formatMonth(currentMonth)}
            </h2>
            <Button variant="ghost" size="icon" onClick={onNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>

          {/* Budget totals - Responsive grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Income</p>
              <p className="text-sm sm:text-lg font-bold text-success tabular-nums">
                <span className="sm:hidden">{formatAmountCompact(totalIncome)}</span>
                <span className="hidden sm:inline">{formatAmount(totalIncome)}</span>
              </p>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Planned</p>
              <p className="text-sm sm:text-lg font-bold tabular-nums">
                <span className="sm:hidden">{formatAmountCompact(totalExpenses)}</span>
                <span className="hidden sm:inline">{formatAmount(totalExpenses)}</span>
              </p>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                <span className="sm:hidden">Left</span>
                <span className="hidden sm:inline">Left to Budget</span>
              </p>
              <p
                className={cn(
                  'text-sm sm:text-lg font-bold tabular-nums',
                  isZeroed && 'text-success',
                  isOver && 'text-destructive',
                  isUnder && 'text-primary'
                )}
              >
                <span className="sm:hidden">{formatAmountCompact(Math.abs(remaining))}</span>
                <span className="hidden sm:inline">{formatAmount(remaining)}</span>
              </p>
            </div>
          </div>

          {/* Zero-based budget indicator */}
          <div className="flex justify-center">
            {isZeroed ? (
              <Badge className="bg-success text-success-foreground text-xs">
                ✓ Every sat has a job!
              </Badge>
            ) : isOver ? (
              <Badge variant="destructive" className="text-xs">
                <span className="sm:hidden">Over by {formatAmountCompact(Math.abs(remaining))}</span>
                <span className="hidden sm:inline">⚠ Over budget by {formatAmount(Math.abs(remaining))}</span>
              </Badge>
            ) : totalIncome > 0 ? (
              <Badge variant="secondary" className="text-primary text-xs">
                <span className="sm:hidden">{formatAmountCompact(remaining)} left</span>
                <span className="hidden sm:inline">{formatAmount(remaining)} left to assign</span>
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Start by adding your income
              </Badge>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
