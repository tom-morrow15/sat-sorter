import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Zap, Calendar, Menu, Info, Heart, Shield, GraduationCap, LogIn, Moon, Sun, RotateCw, Copy, AlertTriangle, BookOpen } from 'lucide-react';

import pkg from '../../../package.json';
const APP_VERSION: string = (pkg as any)?.version ?? 'dev';
import { Button } from '@/components/ui/button';
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
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import LoginDialog from '@/components/auth/LoginDialog';
import { useAppContext } from '@/hooks/useAppContext';
import { BackupRestoreDialog } from './BackupRestoreDialog';
import { ManagePartnersDialog } from './ManagePartnersDialog';
import { DonateDialog } from './DonateDialog';
import { BudgetKeyDialog } from './BudgetKeyDialog';
import { SubscriptionSettings } from './SubscriptionSettings';
import { MapleSettings } from '@/components/maple/MapleSettings';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { DebugLogDialog } from './DebugLogDialog';
import { RelaySettingsDialog } from './RelaySettingsDialog';
import { AccountDetailsDialog } from './AccountDetailsDialog';
import { WelcomeTour } from '@/components/WelcomeTour';
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
  /** When false, hides the income/planned/left stat strip (non-budget pages). */
  showStatStrip?: boolean;
}

/**
 * Compact Bauhaus header:
 *  - Row 1 (sticky, ~64px): logotype · currency toggle · settings/account
 *  - Row 2 (stat strip): month selector + 3 compact mono stat blocks
 */
export function BudgetHeader({
  buckets,
  currentMonth,
  currency,
  onToggleCurrency,
  onPreviousMonth,
  onNextMonth,
  onOpenWallet,
  onSelectMonth,
  userRole = 'owner',
  onCopyPreviousMonth,
  onPlanNextMonth,
  onResetBudgetMonth,
  showStatStrip = true,
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { needRefresh, softReset, hardReset, totalReset } = useRegisterSW();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { partners: nostrPartners } = usePartners();
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
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [showRelaySettings, setShowRelaySettings] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

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

  let totalIncome: number;
  let totalExpenses: number;
  let remaining: number;

  if (currency === 'usd' && priceData) {
    totalIncome = calculateTotalIncomeUsd(buckets, priceData.usdPerBtc);
    totalExpenses = calculateTotalExpensesUsd(buckets, priceData.usdPerBtc);
    remaining = calculateRemainingToBudgetUsd(buckets, priceData.usdPerBtc);
  } else {
    totalIncome = priceData ? calculateTotalIncomeSats(buckets, priceData.usdPerBtc) : calculateTotalIncome(buckets);
    totalExpenses = priceData ? calculateTotalExpensesSats(buckets, priceData.usdPerBtc) : calculateTotalExpenses(buckets);
    remaining = priceData ? calculateRemainingToBudgetSats(buckets, priceData.usdPerBtc) : calculateRemainingToBudget(buckets);
  }

  const formatAmt = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    const sats = Math.round(amount);
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M`;
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
    <div className="bh-brand">
      {/* ===== ROW 1: STICKY TOP BAR (~64px) ===== */}
      <header className="sticky top-0 z-50 w-full bh-brand safe-top border-b border-[hsl(var(--brand-border))]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Logotype */}
            <button onClick={toggleLogo} className="flex items-center gap-2.5 shrink-0 group">
              <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--primary-hover))] transition-colors">
                {logoStyle === 'bitcoin' ? (
                  <Bitcoin className="h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
                ) : (
                  <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
                )}
              </div>
              <span className="hidden sm:inline font-serif text-xl tracking-tight text-white leading-none">Sat Sorter</span>
            </button>

            {/* Right cluster */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* BTC price — flat pill, no animation */}
              {priceData && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-[hsl(var(--brand-border))] font-mono text-[11px] text-white/85 tabular-nums whitespace-nowrap">
                      <Bitcoin className="h-3.5 w-3.5 text-primary" />
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

              {/* Currency toggle — flat segmented */}
              <div className="inline-flex h-8 rounded-md border border-[hsl(var(--brand-border))] overflow-hidden text-[11px] font-medium">
                <button
                  onClick={() => currency !== 'usd' && onToggleCurrency()}
                  disabled={priceLoading}
                  className={cn(
                    'flex items-center gap-1 px-2.5 transition-colors',
                    currency === 'usd' ? 'bg-primary text-primary-foreground' : 'text-white/55 hover:text-white'
                  )}
                >
                  <DollarSign className="h-3 w-3" /> USD
                </button>
                <button
                  onClick={() => currency !== 'sats' && onToggleCurrency()}
                  disabled={priceLoading}
                  className={cn(
                    'flex items-center gap-1 px-2.5 transition-colors border-l border-[hsl(var(--brand-border))]',
                    currency === 'sats' ? 'bg-primary text-primary-foreground' : 'text-white/55 hover:text-white'
                  )}
                >
                  <Bitcoin className="h-3 w-3" /> BTC
                </button>
              </div>

              {/* Account / Settings */}
              {user ? (
                <AccountSwitcher
                  variant="avatar"
                  updateAvailable={needRefresh}
                  onAddAccountClick={() => setShowLogin(true)}
                  onBudgetPartnersClick={() => setShowPartners(true)}
                  partnersCount={nostrPartners.length}
                  pendingInvitesCount={0}
                  onShowBudgetKey={() => setShowBudgetKey(true)}
                  onOpenWallet={() => onOpenWallet && onOpenWallet()}
                  onOpenMapleSettings={() => setShowSettings(true)}
                  onOpenPaymentMethods={() => setShowPaymentMethods(true)}
                  onCopyPreviousMonth={() => onCopyPreviousMonth?.()}
                  onOpenDebugLog={() => setShowDebugLog(true)}
                  onOpenRelaySettings={() => setShowRelaySettings(true)}
                  onOpenAccountDetails={() => setShowAccountDetails(true)}
                  onOpenWelcomeTour={() => setShowWelcomeTour(true)}
                  onOpenSubscription={() => setShowSubscription(true)}
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
                      className="h-9 w-9 bg-transparent hover:bg-white/10 text-white border border-[hsl(var(--brand-border))] relative touch-target-sm"
                    >
                      <Menu className="h-5 w-5" />
                      {needRefresh && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-md">
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
                    <DropdownMenuLabel className="bh-caption text-muted-foreground">Budget Tools</DropdownMenuLabel>
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
                    <DropdownMenuLabel className="bh-caption text-muted-foreground">Settings</DropdownMenuLabel>
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="bh-caption text-muted-foreground">Support & About</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setShowWelcomeTour(true)}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Welcome Tour
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowSubscription(true)}>
                      <Zap className="h-4 w-4 mr-2 text-amber-500" />
                      Subscription & Access
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDonateSorter(true)}>
                      <Heart className="h-4 w-4 mr-2 text-primary" />
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
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">latest</span>
                    </DropdownMenuItem>
                    <div className="px-2 pt-2 font-mono text-[10px] text-muted-foreground/60 text-center">
                      v{APP_VERSION}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== ROW 2: STAT STRIP ===== */}
      {showStatStrip && (
        <div className="bh-brand-2 border-b border-[hsl(var(--brand-border))]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3">
            {/* Month selector */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={onPreviousMonth}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-colors touch-target-sm"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowMonthPicker(true)}
                  className="flex items-center gap-1.5 px-2 h-8 rounded-md hover:bg-white/8 transition-colors"
                >
                  <span className="font-serif text-lg text-white leading-none">{formatMonth(currentMonth)}</span>
                  <Calendar className="h-3.5 w-3.5 text-white/40" />
                </button>
                <button
                  onClick={onNextMonth}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-colors touch-target-sm"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Status chip */}
              {isZeroed ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-sm bg-success/20 text-[hsl(var(--success))] font-medium text-[11px] px-2 py-1">
                  Balanced
                </span>
              ) : isOver ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-sm bg-destructive/20 text-[hsl(var(--destructive))] font-medium text-[11px] px-2 py-1">
                  Over budget
                </span>
              ) : totalIncome > 0 ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-sm bg-primary/20 text-primary font-medium text-[11px] px-2 py-1">
                  {formatAmt(remaining)} to assign
                </span>
              ) : null}
            </div>

            {/* Three compact stat blocks */}
            <div className="grid grid-cols-3 gap-px bg-[hsl(var(--brand-border))] rounded-md overflow-hidden border border-[hsl(var(--brand-border))]">
              <StatBlock label="Income" value={formatAmt(totalIncome)} tone="income" />
              <StatBlock label="Planned" value={formatAmt(totalExpenses)} tone="plain" />
              <StatBlock
                label={isOver ? 'Over' : 'Left'}
                value={formatAmt(Math.abs(remaining))}
                tone={isZeroed ? 'income' : isOver ? 'danger' : 'brand'}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== DIALOGS ===== */}
      <Dialog open={showMonthPicker} onOpenChange={setShowMonthPicker}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
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
                  className="justify-start font-mono text-xs"
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
        <DialogContent>
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
        <DialogContent>
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
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Budget Buddy</DialogTitle>
            <DialogDescription>Configure your AI provider, API key, and persistent context.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4"><MapleSettings /></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Methods</DialogTitle>
            <DialogDescription>Manage the payment methods you use for transactions.</DialogDescription>
          </DialogHeader>
          <div className="py-4"><PaymentMethodsManager /></div>
        </DialogContent>
      </Dialog>

      <DonateDialog open={showDonateSorter} onOpenChange={setShowDonateSorter} />
      <DonateDialog open={showDonate} onOpenChange={setShowDonate} />

      <Dialog open={showSubscription} onOpenChange={setShowSubscription}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription & Access</DialogTitle>
            <DialogDescription>Manage your budget bucket limits and payment status</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SubscriptionSettings />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
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
                <h3 className="font-serif text-lg flex items-center gap-2">
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
                <h3 className="font-serif text-lg flex items-center gap-2">
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
        <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
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
                <h3 className="font-serif text-lg">Getting Started</h3>
                <p className="text-sm text-muted-foreground">
                  Bitcoin is a decentralized digital currency that enables peer-to-peer transactions
                  without intermediaries. It was created in 2009 by Satoshi Nakamoto.
                  Start with <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">the original whitepaper</a>.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-lg">Key Resources</h3>
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

      {/* Sync Debug Log */}
      <DebugLogDialog open={showDebugLog} onOpenChange={setShowDebugLog} />

      {/* Relay Settings */}
      <RelaySettingsDialog open={showRelaySettings} onOpenChange={setShowRelaySettings} />

      {/* Account Details */}
      <AccountDetailsDialog open={showAccountDetails} onOpenChange={setShowAccountDetails} />

      {/* Welcome Tour */}
      <WelcomeTour open={showWelcomeTour} onOpenChange={setShowWelcomeTour} />
    </div>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: string; tone: 'income' | 'plain' | 'brand' | 'danger' }) {
  const valueColor =
    tone === 'income' ? 'text-[hsl(var(--success))]' :
    tone === 'brand' ? 'text-primary' :
    tone === 'danger' ? 'text-[hsl(var(--destructive))]' :
    'text-white';
  return (
    <div className="bh-brand-2 px-3 py-2.5">
      <p className="bh-caption text-white/40 mb-1">{label}</p>
      <p className={cn('font-mono text-base sm:text-lg leading-none whitespace-nowrap', valueColor)}>
        {value}
      </p>
    </div>
  );
}
