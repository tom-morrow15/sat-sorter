import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Moon, Sun, Zap, Calendar, Menu, Info, Heart, ExternalLink, Shield, Globe, GraduationCap, User, LogIn, UserPlus, Wifi, Loader2, Check, AlertCircle, HelpCircle, MessageCircle } from 'lucide-react';
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
  formatMonth,
} from '@/lib/budgetTypes';
import type { Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import LoginDialog from '@/components/auth/LoginDialog';
import { useAppContext } from '@/hooks/useAppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { BackupRestoreDialog } from './BackupRestoreDialog';

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
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Menu className="h-4 w-4" />
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowFAQ(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  FAQ & Help
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.open('https://nostrtool.com/profile/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg', '_blank')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Follow on Nostr
                </DropdownMenuItem>
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

          {/* Nostr Relay Sync Status - Show when syncing, synced, or error */}
          {syncStatus !== 'idle' && (
            <div className="flex justify-center">
              {syncStatus === 'syncing' && (
                <Badge variant="outline" className="text-xs gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing to relays...
                </Badge>
              )}
              {syncStatus === 'synced' && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1.5">
                  <Check className="h-3 w-3" />
                  Synced to Nostr
                </Badge>
              )}
              {syncStatus === 'error' && (
                <Badge variant="destructive" className="text-xs gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Sync failed
                </Badge>
              )}
            </div>
          )}

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
                    The fastest way to support us. Send any amount instantly with no fees.
                  </p>
                  <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                    devin@primal.net
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText('devin@primal.net');
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Copy Lightning Address
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
              {/* Wallet Compatibility Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Wallet Compatibility
                </h3>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      ✅ Fully Compatible Wallets
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                      These wallets support automatic transaction import:
                    </p>
                    <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
                      <li><strong>Alby</strong> - Browser extension (recommended)</li>
                      <li><strong>Alby Hub</strong> - Self-hosted, full control</li>
                      <li><strong>Primal</strong> - iOS, Android, Web</li>
                      <li><strong>Mutiny Wallet</strong> - Privacy-focused, self-custodial</li>
                      <li><strong>Zeus</strong> - Connect to your own node</li>
                      <li><strong>Umbrel + NWC Plugin</strong> - For Umbrel users</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      🟡 May Work (Limited Support)
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                      These wallets have NWC but may not support transaction listing:
                    </p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                      <li><strong>Phoenix</strong> - NWC is newer, test to verify</li>
                      <li><strong>Breez</strong> - Check if NWC supported</li>
                      <li><strong>BlueWallet</strong> - May work via LNDHub</li>
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                      ❌ Not Compatible
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                      These wallets don't support NWC or transaction listing:
                    </p>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                      <li><strong>Wallet of Satoshi</strong> - Custodial, no NWC</li>
                      <li><strong>Strike</strong> - No NWC support</li>
                      <li><strong>Cash App</strong> - No NWC support</li>
                      <li><strong>River, Swan</strong> - No NWC support</li>
                    </ul>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      You can still manually add transactions or import via CSV.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* How It Works Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  How Transaction Import Works
                </h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sat Sorter uses <strong>Nostr Wallet Connect (NWC)</strong> to observe your Lightning transactions. Here's what happens:
                  </p>

                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>You create an NWC connection in your wallet</li>
                    <li>You paste the connection string into Sat Sorter</li>
                    <li>Sat Sorter asks your wallet: "What transactions happened?"</li>
                    <li>Your wallet responds with transaction data</li>
                    <li>Sat Sorter displays them for you to categorize</li>
                  </ol>

                  <div className="bg-primary/5 p-3 rounded-lg mt-3">
                    <p className="text-sm font-medium text-primary">🔒 Privacy Guarantee</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                      <li>• No central server sees your transactions</li>
                      <li>• Data flows directly: Your Wallet → Your Browser</li>
                      <li>• Transaction data stays on YOUR device</li>
                      <li>• You can revoke access anytime in your wallet</li>
                      <li>• We never store, share, or transmit your data</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* What is NWC Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  What is NWC?
                </h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Nostr Wallet Connect (NWC)</strong> is an open protocol that lets apps communicate with Lightning wallets securely.
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Think of it like OAuth for Bitcoin wallets - you authorize Sat Sorter to <em>view</em> your transactions, but we can never spend your sats.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300">✅ NWC Can:</p>
                      <ul className="text-xs text-green-600 dark:text-green-400 mt-1">
                        <li>• View transactions</li>
                        <li>• See balances</li>
                        <li>• Request payments</li>
                      </ul>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">❌ NWC Cannot:</p>
                      <ul className="text-xs text-red-600 dark:text-red-400 mt-1">
                        <li>• Spend your sats</li>
                        <li>• Access your keys</li>
                        <li>• Control your wallet</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Nostr Sync Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-primary" />
                  Nostr Relay Sync
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

              {/* Getting Started Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">🚀 Quick Start</h3>

                <div className="p-4 border rounded-lg space-y-3">
                  <p className="text-sm font-medium">To enable automatic transaction import:</p>

                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Get a compatible wallet (Alby recommended)</li>
                    <li>Create an NWC connection in your wallet</li>
                    <li>Click the Wallet icon in Sat Sorter</li>
                    <li>Paste your NWC connection string</li>
                    <li>Enable "Auto-sync" for automatic imports</li>
                    <li>Transactions will appear for categorizing!</li>
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
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </header>
  );
}
