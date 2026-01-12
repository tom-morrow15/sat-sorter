import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Moon, Sun, Zap, Calendar, Menu, Info, Heart, ExternalLink, Shield, Globe, GraduationCap, LogIn, Wifi, Loader2, Check, AlertCircle, HelpCircle, Download, BookOpen, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateRemainingToBudget,
  calculateTotalIncomeUsd,
  calculateTotalExpensesUsd,
  calculateRemainingToBudgetUsd,
  formatMonth,
} from '@/lib/budgetTypes';
import type { Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import LoginDialog from '@/components/auth/LoginDialog';
import { useAppContext } from '@/hooks/useAppContext';

import { BackupRestoreDialog } from './BackupRestoreDialog';
import { DataExportDialog } from './DataExportDialog';
import { OnboardingWelcome } from './OnboardingWelcome';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAppUpdate } from '@/hooks/useAppUpdate';

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
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  hasUnsyncedChanges?: boolean;
  onManualSync?: () => void;
  canSync?: boolean;
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
  syncStatus = 'idle',
  hasUnsyncedChanges = false,
  onManualSync,
  canSync = false,
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showBitcoinEdu, setShowBitcoinEdu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showBitcoinProjects, setShowBitcoinProjects] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showDataExport, setShowDataExport] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const { completeOnboarding } = useOnboarding();
  const { updateAvailable, performUpdate } = useAppUpdate();

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

  // Calculate totals - use USD functions when in USD mode to respect stored USD amounts
  const totalIncomeSats = calculateTotalIncome(buckets);
  const totalExpensesSats = calculateTotalExpenses(buckets);
  const remainingSats = calculateRemainingToBudget(buckets);

  // USD totals (using stored USD amounts where available)
  const totalIncomeUsd = priceData ? calculateTotalIncomeUsd(buckets, priceData.usdPerBtc) : 0;
  const totalExpensesUsd = priceData ? calculateTotalExpensesUsd(buckets, priceData.usdPerBtc) : 0;
  const remainingUsd = priceData ? calculateRemainingToBudgetUsd(buckets, priceData.usdPerBtc) : 0;

  // Format amounts based on currency mode
  const formatAmount = (sats: number, usdValue?: number) => {
    if (currency === 'usd') {
      if (usdValue !== undefined) {
        return formatUsd(usdValue);
      }
      if (priceData) {
        return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
      }
      return '$0.00';
    }
    return `${formatSats(sats)} sats`;
  };

  // Compact format for mobile
  const formatAmountCompact = (sats: number, usdValue?: number) => {
    if (currency === 'usd') {
      if (usdValue !== undefined) {
        return formatUsd(usdValue);
      }
      if (priceData) {
        return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
      }
      return '$0.00';
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

  // Use appropriate totals based on currency
  const totalIncome = currency === 'usd' ? totalIncomeUsd : totalIncomeSats;
  const totalExpenses = currency === 'usd' ? totalExpensesUsd : totalExpensesSats;
  const remaining = currency === 'usd' ? remainingUsd : remainingSats;

  const isZeroed = Math.abs(remaining) < 0.01 && totalIncome > 0;
  const isOver = remaining < 0;
  const isUnder = remaining > 0 && totalIncome > 0;

  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  // Default to lightning bolt (sats), user can toggle to bitcoin
  const logoStyle = config.logoStyle || 'sats';

  const toggleLogo = () => {
    updateConfig((c) => ({ ...c, logoStyle: c.logoStyle === 'sats' ? 'bitcoin' : 'sats' }));
  };

  // App developer's pubkey for donations - will be set by project maintainer
  // For now, we'll note that this should be configured
  const DEVELOPER_PUBKEY = ''; // TODO: Replace with actual developer pubkey for zaps

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

            {/* Currency Toggle - Shows both ₿ and $ with active highlighted */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={onToggleCurrency}
                  disabled={priceLoading}
                  className="h-8 sm:h-9 px-2 gap-0.5"
                >
                  <Bitcoin className={cn(
                    "h-4 w-4 transition-colors",
                    currency === 'sats' ? 'text-primary' : 'text-muted-foreground/50'
                  )} />
                  <span className="text-muted-foreground/50 text-xs">/</span>
                  <DollarSign className={cn(
                    "h-4 w-4 transition-colors",
                    currency === 'usd' ? 'text-green-600' : 'text-muted-foreground/50'
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle currency view</p>
                <p className="text-xs text-muted-foreground">
                  Currently showing: {currency === 'sats' ? 'Sats (₿)' : 'USD ($)'}
                </p>
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

            {/* Account Switcher (when logged in) */}
            {user && (
              <div className="ml-1">
                <AccountSwitcher onAddAccountClick={() => setShowLogin(true)} />
              </div>
            )}

            {/* App Menu - Always visible */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 relative"
                >
                  <Menu className="h-4 w-4" />
                  {updateAvailable && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Login/Signup for guests */}
                {!user && (
                  <>
                    <DropdownMenuItem onClick={() => setShowLogin(true)}>
                      <LogIn className="h-4 w-4 mr-2" />
                      Log In with Nostr
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Info section */}
                <DropdownMenuItem onClick={() => setShowAbout(true)}>
                  <Info className="h-4 w-4 mr-2" />
                  About Sat Sorter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBitcoinEdu(true)}>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Learn About Bitcoin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDonate(true)}>
                  <Heart className="h-4 w-4 mr-2" />
                  Support Sat Sorter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBitcoinProjects(true)}>
                  <Globe className="h-4 w-4 mr-2" />
                  Other Bitcoin Projects
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowBackup(true)}>
                  <Wifi className="h-4 w-4 mr-2" />
                  Nostr Relay Sync
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDataExport(true)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export & Backup Data
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowOnboardingTour(true)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  How It Works Tour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowFAQ(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  FAQ & Help
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme}>
                  {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowFeedback(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Feedback & Requests
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open('https://primal.net/p/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg', '_blank')}
                >
                  <span className="mr-2 text-base">🤙</span>
                  Follow on Nostr
                </DropdownMenuItem>
                {updateAvailable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={performUpdate} className="text-primary">
                      <span className="relative mr-2">
                        <Download className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      Update App
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
                <span className="sm:hidden">
                  {currency === 'usd' ? formatUsd(totalIncomeUsd) : formatAmountCompact(totalIncomeSats)}
                </span>
                <span className="hidden sm:inline">
                  {currency === 'usd' ? formatUsd(totalIncomeUsd) : `${formatSats(totalIncomeSats)} sats`}
                </span>
              </p>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Planned</p>
              <p className="text-sm sm:text-lg font-bold tabular-nums">
                <span className="sm:hidden">
                  {currency === 'usd' ? formatUsd(totalExpensesUsd) : formatAmountCompact(totalExpensesSats)}
                </span>
                <span className="hidden sm:inline">
                  {currency === 'usd' ? formatUsd(totalExpensesUsd) : `${formatSats(totalExpensesSats)} sats`}
                </span>
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
                <span className="sm:hidden">
                  {currency === 'usd' ? formatUsd(Math.abs(remainingUsd)) : formatAmountCompact(Math.abs(remainingSats))}
                </span>
                <span className="hidden sm:inline">
                  {currency === 'usd' ? formatUsd(remainingUsd) : `${formatSats(remainingSats)} sats`}
                </span>
              </p>
            </div>
          </div>

          {/* Nostr Relay Sync Status - Always present to prevent layout jump */}
          <div className="flex justify-center items-center gap-2 h-7">
            {syncStatus === 'syncing' && (
              <Badge variant="outline" className="text-xs gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing...
              </Badge>
            )}
            {syncStatus === 'synced' && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1.5">
                <Check className="h-3 w-3" />
                Synced
              </Badge>
            )}
            {syncStatus === 'error' && (
              <Badge variant="destructive" className="text-xs gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Sync failed
              </Badge>
            )}
            {/* Show sync button when logged in and there are unsynced changes or idle */}
            {canSync && syncStatus === 'idle' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hasUnsyncedChanges ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "h-7 text-xs gap-1.5",
                      hasUnsyncedChanges && "animate-pulse"
                    )}
                    onClick={onManualSync}
                  >
                    <Wifi className="h-3 w-3" />
                    {hasUnsyncedChanges ? 'Sync Now' : 'Sync'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasUnsyncedChanges
                    ? 'You have unsaved changes. Click to sync now.'
                    : 'Manually sync your budget to Nostr relays'
                  }
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Zero-based budget indicator - only show for special states */}
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
            ) : totalIncome === 0 ? (
              <Badge variant="secondary" className="text-xs">
                Start by adding your income
              </Badge>
            ) : null}
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

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              About Sat Sorter
            </DialogTitle>
            <DialogDescription>
              Zero-based budgeting on a Bitcoin standard
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-primary" />
                  What is Sat Sorter?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sat Sorter is a privacy-first budgeting app built for Bitcoiners.
                  It uses the zero-based budgeting method — where every satoshi gets assigned a job
                  before you spend it. No wasted sats, no wasted money.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  How It Works
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Add your monthly income in sats</li>
                  <li>Create categories for your expenses</li>
                  <li>Assign every sat to a category until you hit zero</li>
                  <li>Track your spending and stay on budget</li>
                  <li>Connect your Lightning wallet for automatic tracking</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  100% Private
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your data stays on your device. We don't have servers that store your financial information.
                  When you log in with Nostr, your budget syncs securely using your own keys.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bitcoin Education Dialog */}
      <Dialog open={showBitcoinEdu} onOpenChange={setShowBitcoinEdu}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Learn About Bitcoin
            </DialogTitle>
            <DialogDescription>
              Understanding sound money
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-primary" />
                  What is Bitcoin?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Bitcoin is a decentralized digital currency that operates without a central bank or single administrator.
                  It was created in 2009 by an anonymous person (or group) using the pseudonym Satoshi Nakamoto.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Why is Bitcoin Sound Money?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Unlike fiat currencies that governments can print at will, Bitcoin has a fixed supply of 21 million coins.
                  This scarcity makes it resistant to inflation. When you save in Bitcoin, your purchasing power is protected
                  from the devaluation that affects traditional currencies.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  What are Satoshis (Sats)?
                </h3>
                <p className="text-sm text-muted-foreground">
                  A satoshi (or "sat") is the smallest unit of Bitcoin. Just like a dollar has 100 cents,
                  1 Bitcoin has 100,000,000 satoshis. This makes Bitcoin highly divisible and practical for
                  everyday transactions of any size.
                </p>
                <div className="bg-muted p-3 rounded-lg mt-2">
                  <p className="text-sm font-mono text-center">
                    1 BTC = 100,000,000 sats
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  The Lightning Network
                </h3>
                <p className="text-sm text-muted-foreground">
                  The Lightning Network is a "layer 2" payment protocol built on top of Bitcoin.
                  It enables instant, low-cost transactions — perfect for everyday purchases.
                  Sat Sorter can connect to your Lightning wallet to automatically track your spending.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">The Dollar's Decline</h3>
                <p className="text-sm text-muted-foreground">
                  Since the Federal Reserve was created in 1913, the US dollar has lost over 96% of its purchasing power.
                  What cost $1 in 1913 would cost over $30 today. Bitcoin offers an alternative — money that can't be
                  inflated away by central banks.
                </p>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-2">Learn More</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://bitcoin.org', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Bitcoin.org
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://bitcoin.rocks', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Bitcoin.rocks
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://hope.com', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Hope.com
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://21lessons.com', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    21 Lessons
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Donate Dialog (for guests) */}
      {/* Support Developer Dialog */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Support Sat Sorter
            </DialogTitle>
            <DialogDescription>
              Help me keep building and improving Sat Sorter
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <p className="text-sm text-muted-foreground">
                I built Sat Sorter because I believe in Bitcoin and want to help people take control of their finances.
                Your donation helps me continue building this app and adding new features.
                Thanks for using Sat Sorter. Fix the money, fix the world. 🙏
              </p>

              <div className="p-4 border rounded-lg bg-primary/5 space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">⚡ Send Sats via Lightning</h3>
                  <p className="text-sm text-muted-foreground">
                    The fastest way to support us. Send any amount instantly.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => window.open('https://getalby.com/p/satsorter', '_blank')}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Donate via Alby
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h3 className="font-semibold">⚙️ What Your Donation Goes To</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Building new features</li>
                  <li>Bug fixes and improvements</li>
                  <li>Development time</li>
                  <li>Keeping Sat Sorter free for everyone</li>
                </ul>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h3 className="font-semibold">💡 Even a Little Helps</h3>
                <p className="text-sm text-muted-foreground">
                  Send whatever you can - 100 sats, 1000 sats, whatever feels right.
                  Even small donations add up and help me dedicate more time to building this. ⚡
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Other Bitcoin Projects Dialog */}
      <Dialog open={showBitcoinProjects} onOpenChange={setShowBitcoinProjects}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Support Other Bitcoin Projects
            </DialogTitle>
            <DialogDescription>
              Help build the future of freedom technology
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <p className="text-sm text-muted-foreground">
                Bitcoin and the tools around it are built by passionate developers working on open-source projects.
                Your donations help keep these projects alive and growing.
              </p>

              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">OpenSats</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://opensats.org', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visit
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Funds open-source Bitcoin and Nostr developers. 100% of donations go to grants.
                </p>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Human Rights Foundation</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://hrf.org/devfund', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visit
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  The Bitcoin Development Fund supports developers building privacy and freedom tools.
                </p>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Brink</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://brink.dev', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visit
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Supports Bitcoin Core developers working on the protocol itself.
                </p>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Geyser Fund</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://geyser.fund', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Visit
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Crowdfunding platform for Bitcoin projects. Find and support grassroots initiatives.
                </p>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                "We shape our tools, and thereafter our tools shape us." — Marshall McLuhan
              </p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={() => setShowLogin(false)}
      />

      {/* Backup & Sync Dialog */}
      <BackupRestoreDialog
        open={showBackup}
        onOpenChange={setShowBackup}
      />

      {/* Data Export Dialog */}
      <DataExportDialog
        open={showDataExport}
        onOpenChange={setShowDataExport}
      />

      {/* Onboarding Tour Dialog */}
      <OnboardingWelcome
        open={showOnboardingTour}
        onOpenChange={setShowOnboardingTour}
        onComplete={completeOnboarding}
      />

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Feedback & Feature Requests
            </DialogTitle>
            <DialogDescription>
              We'd love to hear from you!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Have a bug to report, a feature request, or just want to say hi?
              Reach out to us on Nostr — you can send a direct message or post publicly.
            </p>

            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => window.open('https://primal.net/messages/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg', '_blank')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send a Direct Message
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://primal.net/p/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Post Publicly on Nostr
              </Button>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> When reporting a bug, please include:
              </p>
              <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                <li>What you were trying to do</li>
                <li>What happened instead</li>
                <li>Your device and browser</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ & Help Dialog */}
      <Dialog open={showFAQ} onOpenChange={setShowFAQ}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              FAQ & Help
            </DialogTitle>
            <DialogDescription>
              Common questions about Sat Sorter
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6 py-4">
              {/* What is Zero-Based Budgeting */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">💰 What is zero-based budgeting?</h3>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Zero-based budgeting means giving every satoshi a job <strong>before</strong> you spend it.
                    Your income minus your planned expenses should equal zero. This doesn't mean you spend
                    everything — savings and investments are categories too! The goal is intentionality:
                    knowing exactly where every sat goes.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Why No Credit Card Tracking */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">💳 Why doesn't Sat Sorter connect to my bank or credit cards?</h3>
                <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                    <strong>Privacy is the reason.</strong> Traditional bank and credit card integrations require
                    sharing your login credentials or connecting through third-party services like Plaid.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    These services can see, store, and analyze all your financial data — where you shop,
                    what you buy, your spending patterns, and your net worth. This data is often sold
                    to advertisers, used for credit scoring, or shared with partners.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Sat Sorter is built on the principle that <strong>your financial data belongs to you</strong>.
                    We don't have servers that store your data, and we never will. For fiat expenses, you can
                    manually enter transactions or import CSV exports from your bank.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Transaction Import Methods */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  How do I import transactions?
                </h3>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      🐝 Alby Hub (Auto-Import)
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                      Connect via NWC for automatic Lightning transaction import:
                    </p>
                    <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
                      <li><strong>Alby Hub only</strong> - Other NWC wallets don't support transaction listing</li>
                      <li>Get your NWC URI from Alby Hub settings</li>
                      <li>Scan QR code or paste the connection string</li>
                      <li>New transactions sync automatically</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      📁 CSV Import
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                      Export transactions from your wallet and import the CSV file:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                      <li><strong>Phoenix</strong> - Settings → Payment History → Export</li>
                      <li><strong>BlueWallet</strong> - Wallet → ••• → Export Transactions</li>
                      <li><strong>Zeus</strong> - History → Export</li>
                      <li><strong>Bank statements</strong> - Most banks offer CSV export</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">
                      ✏️ Manual Entry
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      You can always add transactions manually. This works for cash, any wallet,
                      or payment method. Tap the + button to add income or expenses.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privacy Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  How does Sat Sorter protect my privacy?
                </h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="bg-primary/5 p-3 rounded-lg">
                    <p className="text-sm font-medium text-primary">🔒 Your Data Stays Yours</p>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      <li>• <strong>No central server</strong> - Everything runs in your browser</li>
                      <li>• <strong>Local storage</strong> - Budget data saved on your device</li>
                      <li>• <strong>Encrypted sync</strong> - Cloud backup uses NIP-44 encryption</li>
                      <li>• <strong>Only you can decrypt</strong> - Uses your Nostr keys</li>
                      <li>• <strong>Open source</strong> - Verify the code yourself</li>
                    </ul>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    When you connect Alby Hub, data flows directly from your wallet to your browser.
                    Sat Sorter never sees, stores, or transmits your transaction data to any server.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Nostr Sync Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-primary" />
                  How does syncing across devices work?
                </h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your budget syncs across devices using <strong>Nostr relays</strong> instead of a central cloud server.
                  </p>

                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Data is encrypted with YOUR Nostr keys</li>
                    <li>Relays store encrypted data they can't read</li>
                    <li>You choose which relays to use</li>
                    <li>No single point of failure</li>
                    <li>True ownership of your data</li>
                  </ul>

                  <p className="text-xs text-muted-foreground mt-2">
                    Go to <strong>Menu → Nostr Relay Sync</strong> to manage your relays.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Why Bitcoin */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">₿ Why budget in sats instead of dollars?</h3>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    The dollar loses purchasing power every year due to inflation. What costs $100 today
                    might cost $105 next year. Bitcoin has a fixed supply of 21 million coins — no one can
                    print more.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    By budgeting in sats, you're thinking in terms of sound money. You can still view
                    everything in USD using the currency toggle — Sat Sorter supports both! But building
                    the habit of thinking in sats helps you transition to a Bitcoin standard.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Do I need Nostr */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">🔑 Do I need a Nostr account?</h3>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>No!</strong> You can use Sat Sorter without logging in. Your data will be
                    stored locally in your browser.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    However, if you want to sync your budget across devices or back it up to the cloud,
                    you'll need to log in with Nostr. This gives you encrypted backup and sync without
                    trusting any central server with your data.
                  </p>
                </div>
              </div>

              <Separator />

              {/* What if I lose my data */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">💾 What if I clear my browser data?</h3>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    If you're logged in with Nostr and have synced your data, you can recover it by
                    logging in again on any device. Your encrypted budget will be downloaded from
                    Nostr relays.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If you're not logged in, we recommend using <strong>Menu → Export & Backup Data</strong>
                    to regularly download a backup file. You can also install Sat Sorter as a PWA (Progressive
                    Web App) for a more app-like experience.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Getting Started Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">🚀 Quick Start Guide</h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li><strong>Add your income</strong> - Tap the + button and add your monthly income</li>
                    <li><strong>Create buckets</strong> - Add categories like Rent, Food, Savings, etc.</li>
                    <li><strong>Assign every sat</strong> - Distribute your income until "Left to Budget" is zero</li>
                    <li><strong>Track spending</strong> - Add transactions as you spend throughout the month</li>
                    <li><strong>Connect a wallet</strong> - (Optional) Link Alby Hub for automatic tracking</li>
                    <li><strong>Log in with Nostr</strong> - (Optional) Enable encrypted cloud backup</li>
                  </ol>
                </div>
              </div>

              <Separator />

              {/* Need Help Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Need More Help?</h3>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://nwc.dev', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    NWC Documentation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://getalby.com', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Get Alby Wallet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://nostr.how', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Learn About Nostr
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </header>
  );
}
