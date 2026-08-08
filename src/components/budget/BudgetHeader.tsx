import { useState, useEffect } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Zap, Calendar, Menu, Info, Heart, Shield, GraduationCap, LogIn, Moon, Sun, RotateCw, Copy, AlertTriangle } from 'lucide-react';

import pkg from '../../../package.json';
const APP_VERSION: string = (pkg as any)?.version ?? 'dev';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBitcoinPrice, formatSats, formatUsd } from '@/hooks/useBitcoinPrice';
import {
   calculateTotalIncome,
   calculateTotalExpenses,
   calculateRemainingToBudget,
   calculateTotalIncomeSats,
   calculateTotalExpensesSats,
   calculateRemainingToBudgetSats,
   calculateTotalIncomeUsd,
   calculateTotalExpensesUsd,
   calculateRemainingToBudgetUsd,
   formatMonth,
 } from '@/lib/budgetTypes';
import type { Bucket, BudgetPartner } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePartners } from '@/hooks/usePartners';
import { usePartnerInvites } from '@/hooks/usePartnerInvites';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import LoginDialog from '@/components/auth/LoginDialog';
import { useAppContext } from '@/hooks/useAppContext';
import { BackupRestoreDialog } from './BackupRestoreDialog';
import { ManagePartnersDialog } from './ManagePartnersDialog';
import { DonateDialog } from './DonateDialog';
import { BudgetKeyDialog } from './BudgetKeyDialog';
import { MapleSettings } from '@/components/maple/MapleSettings';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { useRegisterSW } from '@/hooks/useRegisterSW';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { GuestUpgradeModal } from '@/components/GuestUpgradeModal';
import { useBudget } from '@/hooks/useBudget';

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
  availableMonths?: string[];
  allBudgets?: any[];
  onCopyPreviousMonth?: () => void;
  onPlanNextMonth?: () => void;
  onResetBudgetMonth?: () => void;
  hasPreviousMonthBudget?: boolean;
  getPreviousMonth?: () => string;
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
  partners = [],
  userRole = 'owner',
  onAddPartner,
  onRemovePartner,
  onChangePartnerPermission,
  availableMonths = [],
  allBudgets = [],
  onCopyPreviousMonth,
  onPlanNextMonth,
  onResetBudgetMonth,
  hasPreviousMonthBudget = false,
  getPreviousMonth = () => '',
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { needRefresh, softReset, hardReset, totalReset } = useRegisterSW();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { partners: nostrPartners } = usePartners();
  const { pendingInvitesCount } = usePartnerInvites();
  const { state: onboardingState } = useOnboarding();
  const { fullState } = useBudget();
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showDonateSorter, setShowDonateSorter] = useState(false);
  const [showBitcoinEdu, setShowBitcoinEdu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showPartners, setShowPartners] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetFinalConfirm, setShowResetFinalConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showGuestUpgrade, setShowGuestUpgrade] = useState(false);
  const [showBudgetKey, setShowBudgetKey] = useState(false);

  // Scroll-based header gradient transition
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getAvailableMonths = () => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  };

  // Calculate amounts
  let totalIncome: number;
  let totalExpenses: number;
  let remaining: number;

  if (currency === 'usd' && priceData) {
    totalIncome = calculateTotalIncomeUsd(buckets, priceData.usdPerBtc);
    totalExpenses = calculateTotalExpensesUsd(buckets, priceData.usdPerBtc);
    remaining = calculateRemainingToBudgetUsd(buckets, priceData.usdPerBtc);
  } else {
    totalIncome = priceData
      ? calculateTotalIncomeSats(buckets, priceData.usdPerBtc)
      : calculateTotalIncome(buckets);
    totalExpenses = priceData
      ? calculateTotalExpensesSats(buckets, priceData.usdPerBtc)
      : calculateTotalExpenses(buckets);
    remaining = priceData
      ? calculateRemainingToBudgetSats(buckets, priceData.usdPerBtc)
      : calculateRemainingToBudget(buckets);
  }

  const formatAmt = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    const sats = Math.round(amount);
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(0)}K`;
    return `${formatSats(sats)}`;
  };

  const EPSILON = currency === 'usd' ? 0.01 : 1;
  const isZeroed = Math.abs(remaining) < EPSILON && totalIncome > 0;
  const isOver = remaining < -EPSILON;

  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const logoStyle = config.logoStyle || 'sats';

  const toggleLogo = () => {
    updateConfig((c) => ({ ...c, logoStyle: c.logoStyle === 'sats' ? 'bitcoin' : 'sats' }));
  };

  const handleSoftReset = async () => { await softReset(); };
  const handleHardReset = async () => { await hardReset(); };
  const handleTotalReset = async () => { await totalReset(); };

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full text-white relative overflow-hidden safe-top transition-all duration-500",
      isScrolled ? "header-scrolled" : "header-base"
    )}>
      <div className="wormhole-grid-bg" aria-hidden="true" />
      <div className="wormhole-glow" aria-hidden="true" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
        {/* ===== ROW 1: Slim top bar (56px) ===== */}
        <div className="flex h-14 items-center justify-between gap-2">
          {/* Logo + title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={toggleLogo}
              className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-all border border-white/10 touch-target-sm shrink-0"
            >
              {logoStyle === 'bitcoin' ? (
                <Bitcoin className="h-5 w-5 text-white" />
              ) : (
                <Zap className="h-5 w-5 text-white" />
              )}
            </button>
            <h1 className="font-serif-display text-lg tracking-tight text-white truncate hidden xs:block sm:text-xl">
              Sat Sorter
            </h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BTC price — desktop, kept exactly as-is */}
            {priceData && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 font-mono text-xs text-white/90 tabular-nums">
                    <Bitcoin className="h-3.5 w-3.5" />
                    {formatUsd(priceData.usdPerBtc)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Current Bitcoin price</p>
                  <p className="text-xs text-muted-foreground">
                    1 sat = {formatUsd(priceData.usdPerBtc / 100_000_000)}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* BTC price — mobile badge, kept exactly as-is */}
            {priceData && (
              <div className="flex md:hidden items-center gap-1 px-2 py-0.5 rounded-md bg-white/8 border border-white/10 font-mono text-[10px] text-white/80 tabular-nums">
                <Bitcoin className="h-3 w-3" />
                {formatUsd(priceData.usdPerBtc)}
              </div>
            )}

            {/* Currency toggle */}
            <div className="inline-flex rounded-lg border border-white/10 bg-white/8 p-0.5 text-[10px]">
              <button
                onClick={() => currency !== 'usd' && onToggleCurrency()}
                disabled={priceLoading}
                className={`flex items-center gap-0.5 rounded-md px-2 py-1 font-medium transition-all ${
                  currency === 'usd' ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <DollarSign className="h-3 w-3" /> USD
              </button>
              <button
                onClick={() => currency !== 'sats' && onToggleCurrency()}
                disabled={priceLoading}
                className={`flex items-center gap-0.5 rounded-md px-2 py-1 font-medium transition-all ${
                  currency === 'sats' ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <Bitcoin className="h-3 w-3" /> BTC
              </button>
            </div>

            {/* Account / Menu */}
            {user ? (
              <AccountSwitcher
                variant="avatar"
                updateAvailable={needRefresh}
                onAddAccountClick={() => setShowLogin(true)}
                onBudgetPartnersClick={() => setShowPartners(true)}
                partnersCount={nostrPartners.length}
                pendingInvitesCount={pendingInvitesCount}
                onShowBudgetKey={() => setShowBudgetKey(true)}
                onOpenWallet={() => onOpenWallet && onOpenWallet()}
                onOpenMapleSettings={() => setShowSettings(true)}
                onOpenPaymentMethods={() => setShowPaymentMethods(true)}
                onCopyPreviousMonth={() => onCopyPreviousMonth?.()}
                onPlanNextMonth={onPlanNextMonth}
                onResetBudgetMonth={() => setShowResetConfirm(true)}
                onSoftReset={handleSoftReset}
                onHardReset={handleHardReset}
                onTotalReset={handleTotalReset}
                onOpenBackup={() => setShowBackup(true)}
                onSupportSatSorter={() => setShowDonateSorter(true)}
                onSupportBitcoinProjects={() => setShowDonate(true)}
                onAbout={() => setShowAbout(true)}
                onLearnAboutBitcoin={() => setShowBitcoinEdu(true)}
              />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    className="h-9 w-9 bg-white/10 hover:bg-white/15 text-white border border-white/10 relative touch-target-sm"
                  >
                    <Menu className="h-5 w-5" />
                    {needRefresh && (
                      <span className="absolute top-1 right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300" />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  {onboardingState === 'guest' && (
                    <DropdownMenuItem onClick={() => setShowGuestUpgrade(true)}>
                      <Shield className="h-4 w-4 mr-2" />
                      Upgrade to Nostr Account
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowLogin(true)}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In with Nostr
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Budget Tools</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onCopyPreviousMonth?.()}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Previous Month
                  </DropdownMenuItem>
                  {onPlanNextMonth && (
                    <DropdownMenuItem onClick={() => onPlanNextMonth()}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Plan Next Month
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Settings</DropdownMenuLabel>
                  <DropdownMenuItem onClick={toggleTheme}>
                    {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Support & About</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowDonateSorter(true)}>
                    <Heart className="h-4 w-4 mr-2 text-pink-500" />
                    Support Sat Sorter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAbout(true)}>
                    <Info className="h-4 w-4 mr-2" />
                    About Sat Sorter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBitcoinEdu(true)}>
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Learn About Bitcoin
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSoftReset}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Refresh the app
                    <span className="ml-auto text-[10px] text-muted-foreground/60">get latest</span>
                  </DropdownMenuItem>
                  <div className="px-2 pt-2 text-[10px] text-muted-foreground/60 text-center tabular-nums">
                    v{APP_VERSION}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ===== ROW 2: Compact month nav + inline totals (~44px) ===== */}
        <div className="flex items-center justify-between gap-2 py-2.5 border-t border-white/8">
          {/* Month navigation */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={onPreviousMonth}
              className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors touch-target-sm shrink-0"
            >
              <ChevronLeft className="h-4 w-4 text-white/70" />
            </button>
            <button
              onClick={() => setShowMonthPicker(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/8 transition-colors min-w-0"
            >
              <span className="font-serif-display text-base text-white truncate">
                {formatMonth(currentMonth)}
              </span>
              <Calendar className="h-3.5 w-3.5 text-white/40 shrink-0" />
            </button>
            <button
              onClick={onNextMonth}
              className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors touch-target-sm shrink-0"
            >
              <ChevronRight className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {/* Inline budget totals */}
          <div className="flex items-center gap-3 sm:gap-5 text-xs tabular-nums shrink-0">
            {/* Income */}
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/40 leading-none mb-0.5">In</p>
              <p className="font-serif-display text-sm text-green-300/80 leading-none whitespace-nowrap">
                {formatAmt(totalIncome)}
              </p>
            </div>
            {/* Planned */}
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-wider text-white/40 leading-none mb-0.5">Plan</p>
              <p className="font-serif-display text-sm text-white/90 leading-none whitespace-nowrap">
                {formatAmt(totalExpenses)}
              </p>
            </div>
            {/* Remaining */}
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/40 leading-none mb-0.5">
                {isOver ? 'Over' : 'Left'}
              </p>
              <p
                className={cn(
                  'font-serif-display text-sm leading-none whitespace-nowrap',
                  isZeroed && 'text-green-300/80',
                  isOver && 'text-red-300/80',
                  !isZeroed && !isOver && 'text-blue-300/80'
                )}
              >
                {formatAmt(Math.abs(remaining))}
              </p>
            </div>
          </div>
        </div>

        {/* Zero-based status badge — very compact */}
        <div className="flex justify-center pb-2 -mt-1">
          {isZeroed ? (
            <Badge className="bg-success/20 text-success-foreground text-[10px] py-0.5 border-0">
              ✓ Every {currency === 'usd' ? 'dollar' : 'sat'} has a job
            </Badge>
          ) : isOver ? (
            <Badge variant="destructive" className="text-[10px] py-0.5">
              Over by {formatAmt(Math.abs(remaining))}
            </Badge>
          ) : totalIncome > 0 ? (
            <Badge className="bg-blue-500/20 text-blue-200 text-[10px] py-0.5 border-0">
              {formatAmt(remaining)} left to assign
            </Badge>
          ) : (
            <Badge className="bg-white/8 text-white/60 text-[10px] py-0.5 border-0">
              Add your income to start
            </Badge>
          )}
        </div>
      </div>

      {/* ===== DIALOGS — all preserved exactly ===== */}
      <Dialog open={showMonthPicker} onOpenChange={setShowMonthPicker}>
        <DialogContent className="sm:max-w-[340px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Month
            </DialogTitle>
            <DialogDescription>Choose a different month to view or edit</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="grid grid-cols-2 gap-2 p-1">
              {getAvailableMonths().map((month) => (
                <Button
                  key={month}
                  variant={month === currentMonth ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => { onSelectMonth?.(month); setShowMonthPicker(false); }}
                >
                  {formatMonth(month)}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset This Month?
            </DialogTitle>
            <DialogDescription>
              This will clear all categories, line items, and transactions for {formatMonth(currentMonth)}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setShowResetConfirm(false); setShowResetFinalConfirm(true); }}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetFinalConfirm} onOpenChange={setShowResetFinalConfirm}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription>
              This action is irreversible. All data for {formatMonth(currentMonth)} will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowResetFinalConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onResetBudgetMonth?.(); setShowResetFinalConfirm(false); }}>
              Yes, permanently reset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManagePartnersDialog open={showPartners} onOpenChange={setShowPartners} userRole={userRole} />
      <BackupRestoreDialog open={showBackup} onOpenChange={setShowBackup} />

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Budget Buddy</DialogTitle>
            <DialogDescription>Configure your AI provider, API key, and persistent context.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4"><MapleSettings /></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Payment Methods</DialogTitle>
            <DialogDescription>Manage the payment methods you use for transactions.</DialogDescription>
          </DialogHeader>
          <div className="py-4"><PaymentMethodsManager /></div>
        </DialogContent>
      </Dialog>

      <DonateDialog open={showDonateSorter} onOpenChange={setShowDonateSorter} />
      <DonateDialog open={showDonate} onOpenChange={setShowDonate} />

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              About Sat Sorter
            </DialogTitle>
            <DialogDescription>Zero-based budgeting on a Bitcoin standard</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h3 className="font-serif-display flex items-center gap-2">
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
                <h3 className="font-serif-display flex items-center gap-2">
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

      <Dialog open={showBitcoinEdu} onOpenChange={setShowBitcoinEdu}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Learn About Bitcoin
            </DialogTitle>
            <DialogDescription>Resources to deepen your understanding of Bitcoin</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h3 className="font-serif-display">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Bitcoin is a decentralized digital currency that enables peer-to-peer transactions
                  without intermediaries. It was created in 2009 by Satoshi Nakamoto.
                  Start with <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">the original whitepaper</a>.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif-display">Key Resources</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><a href="https://bitcoin.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">Bitcoin.org</a> — Official site</li>
                  <li><a href="https://btcmap.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">BTCMap.org</a> — Find Bitcoin merchants near you</li>
                  <li><a href="https://opensats.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenSats</a> — Fund Bitcoin open-source development</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <LoginDialog isOpen={showLogin} onClose={() => setShowLogin(false)} onLogin={() => setShowLogin(false)} />
      <GuestUpgradeModal open={showGuestUpgrade} onOpenChange={setShowGuestUpgrade} />
      <BudgetKeyDialog
        open={showBudgetKey}
        onOpenChange={setShowBudgetKey}
        budgetNsec={fullState.budgetKeypair?.budgetNsec}
        budgetNpub={fullState.budgetKeypair?.budgetNpub}
      />
    </header>
  );
}
