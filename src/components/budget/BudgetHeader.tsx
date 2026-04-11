import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Zap, Calendar, Menu, Info, Heart, ExternalLink, Shield, Globe, GraduationCap, User, LogIn, UserPlus, Cloud, Moon, Sun, Users, RotateCw, Layers } from 'lucide-react';
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
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateRemainingToBudget,
  calculateTotalIncomeSats,
  calculateTotalExpensesSats,
  calculateRemainingToBudgetSats,
  formatMonth,
} from '@/lib/budgetTypes';
import type { Bucket, BudgetPartner, BudgetTemplate } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import LoginDialog from '@/components/auth/LoginDialog';
import { useAppContext } from '@/hooks/useAppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { BackupRestoreDialog } from './BackupRestoreDialog';
import { ManagePartnersDialog } from './ManagePartnersDialog';
import { ManageBudgetTemplateDialog } from './ManageBudgetTemplateDialog';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';

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
  partners?: BudgetPartner[];
  userRole?: 'owner' | 'editor' | 'viewer';
  onAddPartner?: (pubkey: string, permission: 'view' | 'edit') => void;
  onRemovePartner?: (pubkey: string) => void;
  onChangePartnerPermission?: (pubkey: string, permission: 'view' | 'edit') => void;
  templates?: BudgetTemplate[];
  defaultTemplateId?: string;
  onSaveTemplate?: (name: string, description?: string) => void;
  onUpdateTemplate?: (templateId: string, name: string, description?: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onSetDefaultTemplate?: (templateId: string) => void;
  onApplyTemplate?: (templateId: string) => void;
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
  partners = [],
  userRole = 'owner',
  onAddPartner,
  onRemovePartner,
  onChangePartnerPermission,
  templates = [],
  defaultTemplateId,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
  onApplyTemplate,
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showBitcoinEdu, setShowBitcoinEdu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showPartners, setShowPartners] = useState(false);
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);

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

  // Use sats versions when BTC price is available (to use USD source of truth)
  const totalIncome = priceData
    ? calculateTotalIncomeSats(buckets, priceData.usdPerBtc)
    : calculateTotalIncome(buckets);
  const totalExpenses = priceData
    ? calculateTotalExpensesSats(buckets, priceData.usdPerBtc)
    : calculateTotalExpenses(buckets);
  const remaining = priceData
    ? calculateRemainingToBudgetSats(buckets, priceData.usdPerBtc)
    : calculateRemainingToBudget(buckets);

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

  const handleRefresh = () => {
    // Full page reload - useful for PWA and when login state changes
    window.location.reload();
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
                  Support Bitcoin Projects
                </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={toggleTheme}>
                   {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                   {isDark ? 'Light Mode' : 'Dark Mode'}
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 {user && (
                   <>
                     <DropdownMenuItem onClick={() => setShowPartners(true)}>
                       <Users className="h-4 w-4 mr-2" />
                       Budget Partners
                       {partners.length > 0 && (
                         <Badge variant="secondary" className="ml-2 text-xs">
                           {partners.length}
                         </Badge>
                       )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowManageTemplates(true)}>
                        <Layers className="h-4 w-4 mr-2" />
                        Budget Templates
                        {templates.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {templates.length}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                      {templates.length > 0 && (
                        <DropdownMenuItem onClick={() => setShowApplyTemplate(true)}>
                          <Layers className="h-4 w-4 mr-2" />
                          Apply Template
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                   )}
                   <DropdownMenuSeparator />
                   <DropdownMenuItem onClick={handleRefresh}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Refresh App
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowBackup(true)}>
                    <Cloud className="h-4 w-4 mr-2" />
                    Backup & Sync
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
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Support Bitcoin Projects
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

      {/* Budget Partners Dialog */}
      <ManagePartnersDialog
        open={showPartners}
        onOpenChange={setShowPartners}
        partners={partners}
        userRole={userRole}
        onAddPartner={onAddPartner || (() => {})}
        onRemovePartner={onRemovePartner || (() => {})}
        onChangePermission={onChangePartnerPermission || (() => {})}
      />

       {/* Budget Template Manager Dialog */}
       <ManageBudgetTemplateDialog
         open={showManageTemplates}
         onOpenChange={setShowManageTemplates}
         templates={templates}
         defaultTemplateId={defaultTemplateId}
         onSaveTemplate={onSaveTemplate || (() => {})}
         onUpdateTemplate={onUpdateTemplate || (() => {})}
         onDeleteTemplate={onDeleteTemplate || (() => {})}
         onSetDefaultTemplate={onSetDefaultTemplate || (() => {})}
         currentBudgetName={currentMonth}
       />

       {/* Apply Template Dialog */}
       <ApplyTemplateDialog
         open={showApplyTemplate}
         onOpenChange={setShowApplyTemplate}
         templates={templates}
         defaultTemplateId={defaultTemplateId}
         onApply={onApplyTemplate || (() => {})}
         currentMonth={currentMonth}
       />

       {/* Backup & Sync Dialog */}
       <BackupRestoreDialog
         open={showBackup}
         onOpenChange={setShowBackup}
       />
     </header>
   );
 }
