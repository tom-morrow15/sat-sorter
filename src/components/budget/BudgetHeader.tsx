import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Moon, Sun, Zap, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  onSelectMonth?: (month: string) => void;
  unassignedCount?: number;
}

export function BudgetHeader({
  buckets,
  currentMonth,
  currency,
  onToggleCurrency,
  onPreviousMonth,
  onNextMonth,
  onOpenWallet,
  onSelectMonth,
  unassignedCount = 0,
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Generate list of months for picker (current month + 11 months back + 6 months forward)
  const getAvailableMonths = () => {
    const months: string[] = [];
    const now = new Date();
    // Go back 11 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    // Go forward 6 months
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  };

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

  // Default to lightning bolt (sats), user can toggle to bitcoin
  const logoStyle = config.logoStyle || 'sats';

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

            {/* Wallet Button with notification badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onOpenWallet}
                  className="h-8 w-8 sm:h-9 sm:w-9 relative"
                >
                  <Wallet className="h-4 w-4" />
                  {unassignedCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {unassignedCount > 9 ? '9+' : unassignedCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {unassignedCount > 0
                  ? `${unassignedCount} transaction${unassignedCount !== 1 ? 's' : ''} to categorize`
                  : 'Wallet'
                }
              </TooltipContent>
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
          {/* Bitcoin Price - Mobile only (above month) */}
          {priceData && (
            <div className="flex md:hidden justify-center">
              <Badge variant="secondary" className="gap-1 font-mono text-xs">
                <Bitcoin className="h-3 w-3" />
                {formatUsd(priceData.usdPerBtc)}
              </Badge>
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onPreviousMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              <h2 className="text-base sm:text-lg font-semibold min-w-[120px] sm:min-w-[160px] text-center">
                {formatMonth(currentMonth)}
              </h2>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </button>
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

      {/* Month Picker Dialog */}
      <Dialog open={showMonthPicker} onOpenChange={setShowMonthPicker}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Month
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="grid grid-cols-2 gap-2 p-1">
              {getAvailableMonths().map((month) => (
                <Button
                  key={month}
                  variant={month === currentMonth ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    onSelectMonth?.(month);
                    setShowMonthPicker(false);
                  }}
                >
                  {formatMonth(month)}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </header>
  );
}
