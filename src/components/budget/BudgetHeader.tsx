import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Zap, Calendar, Menu, Info, Heart, Shield, GraduationCap, LogIn, Moon, Sun, RotateCw, Copy, AlertTriangle } from 'lucide-react';

// Import version directly from package.json.
// Vite inlines the JSON object at build time, giving us a real string constant.
// This approach does not depend on Vite's `define` global replacement, which was failing with the SWC plugin.
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
import { MapleSettings } from '@/components/maple/MapleSettings';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { useRegisterSW } from '@/hooks/useRegisterSW';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { GuestUpgradeModal } from '@/components/GuestUpgradeModal';

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
  unassignedCount = 0,
  partners = [],
  userRole = 'owner',
  onAddPartner,
  onRemovePartner,
  onChangePartnerPermission,
  availableMonths = [],
  allBudgets = [],
  onCopyPreviousMonth,
  onResetBudgetMonth,
  hasPreviousMonthBudget = false,
  getPreviousMonth = () => '',
}: BudgetHeaderProps) {
  const { data: priceData, isLoading: priceLoading } = useBitcoinPrice();
  const { needRefresh, forceReloadLatest, updateApp, factoryResetApp } = useRegisterSW();
  const { isDark, toggle: toggleTheme } = useTheme();
  // Use Nostr-native partners hook for the count badge
  const { partners: nostrPartners } = usePartners();
  // Get pending invites count for the notification badge
  const { pendingInvitesCount } = usePartnerInvites();
  const { state: onboardingState } = useOnboarding();
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

   // Calculate amounts in display currency
   // In USD mode, use USD calculations to preserve stored amounts
   // In sats mode, use sats calculations
   let totalIncome: number;
   let totalExpenses: number;
   let remaining: number;
   
   if (currency === 'usd' && priceData) {
     // USD mode: use USD calculations to avoid amounts shifting with BTC price
     totalIncome = calculateTotalIncomeUsd(buckets, priceData.usdPerBtc);
     totalExpenses = calculateTotalExpensesUsd(buckets, priceData.usdPerBtc);
     remaining = calculateRemainingToBudgetUsd(buckets, priceData.usdPerBtc);
   } else {
     // Sats mode: use sats calculations
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

   const formatAmount = (amount: number) => {
     if (currency === 'usd') {
       return formatUsd(amount);
     }
     return `${formatSats(Math.round(amount))} sats`;
   };

   // Compact format for mobile
   const formatAmountCompact = (amount: number) => {
     if (currency === 'usd') {
       return formatUsd(amount);
     }
     // Compact format: 1.2M, 50K, etc.
     const sats = Math.round(amount);
     if (sats >= 1_000_000) {
       return `${(sats / 1_000_000).toFixed(1)}M`;
     }
     if (sats >= 1_000) {
       return `${(sats / 1_000).toFixed(0)}K`;
     }
     return formatSats(sats);
   };

    // Use appropriate epsilon for floating point comparison in zero-based budgeting
    // In USD mode, epsilon is $0.01; in sats mode, it's 1 sat
    const EPSILON = currency === 'usd' ? 0.01 : 1;
    const isZeroed = Math.abs(remaining) < EPSILON && totalIncome > 0;
    const isOver = remaining < -EPSILON;
    const isUnder = remaining > EPSILON && totalIncome > 0;

  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  // Default to lightning bolt (sats), user can toggle to bitcoin
  const logoStyle = config.logoStyle || 'sats';

  const toggleLogo = () => {
    updateConfig((c) => ({ ...c, logoStyle: c.logoStyle === 'sats' ? 'bitcoin' : 'sats' }));
  };

    // "Force reload latest code from server"
    // More aggressive safe button — always bypasses browser cache.
    const handleForceReload = async () => {
      await forceReloadLatest();
    };

    // "Update App" (recommended)
    // Polite normal update using Service Worker when available.
    const handleUpdateApp = async () => {
      await updateApp();
    };

    // NUCLEAR: Factory Reset — deletes local budget data.
    const handleFactoryReset = async () => {
      await factoryResetApp();
    };

   return (
     <header className="sticky top-0 z-50 w-full bg-header-gradient text-white relative overflow-hidden safe-top">
       {/* Decorative mesh background */}
       <div className="absolute inset-0 bg-mesh-gradient opacity-30 pointer-events-none" />
       
       <div className="container mx-auto px-3 sm:px-4 relative z-10">
         {/* Top bar with logo and actions */}
         <div className="flex h-16 items-center justify-between">
           <div className="flex items-center gap-3 sm:gap-4">
             <div className="relative">
               <button onClick={toggleLogo} className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center transition-all duration-300 border border-white/30">
                 {logoStyle === 'bitcoin' ? (
                   <Bitcoin className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                 ) : (
                   <Zap className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                 )}
               </button>
             </div>
             <div>
               <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Sat Sorter</h1>
               <p className="text-xs sm:text-sm text-white/80 hidden sm:block">Zero-based Bitcoin budgeting</p>
             </div>
           </div>

           <div className="flex items-center gap-2 sm:gap-3">
             {/* Bitcoin Price - Hidden on small mobile */}
             {priceData && (
               <Tooltip>
                 <TooltipTrigger asChild>
                   <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 font-mono text-sm text-white">
                     <Bitcoin className="h-4 w-4" />
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

              {/* Currency Toggle — compact labeled segmented control */}
              <div className="inline-flex rounded-lg border border-white/30 bg-white/10 p-0.5 text-[10px]">
                <button
                  onClick={() => currency !== 'usd' && onToggleCurrency()}
                  disabled={priceLoading}
                  className={`flex items-center gap-0.5 rounded-md px-2 py-0.5 font-medium transition-all ${
                    currency === 'usd'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <DollarSign className="h-3 w-3" /> USD
                </button>
                <button
                  onClick={() => currency !== 'sats' && onToggleCurrency()}
                  disabled={priceLoading}
                  className={`flex items-center gap-0.5 rounded-md px-2 py-0.5 font-medium transition-all ${
                    currency === 'sats'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Bitcoin className="h-3 w-3" /> BTC
                </button>
              </div>



            {/* Account Switcher (avatar trigger, far right) — only when logged in */}
            {user ? (
              <AccountSwitcher 
                variant="avatar"
                updateAvailable={needRefresh}
                onAddAccountClick={() => setShowLogin(true)}
                onBudgetPartnersClick={() => setShowPartners(true)}
                partnersCount={nostrPartners.length}
                pendingInvitesCount={pendingInvitesCount}
                onOpenWallet={() => onOpenWallet && onOpenWallet()}
                onOpenMapleSettings={() => setShowSettings(true)}
                onOpenPaymentMethods={() => setShowPaymentMethods(true)}
                onCopyPreviousMonth={() => onCopyPreviousMonth?.()}
                onResetBudgetMonth={() => setShowResetConfirm(true)}
                onRefreshApp={handleForceReload}
                onUpdateApp={handleUpdateApp}
                onFactoryReset={handleFactoryReset}
                onOpenBackup={() => setShowBackup(true)}
                onSupportSatSorter={() => setShowDonateSorter(true)}
                onSupportBitcoinProjects={() => setShowDonate(true)}
                onAbout={() => setShowAbout(true)}
                onLearnAboutBitcoin={() => setShowBitcoinEdu(true)}
              />
            ) : (
                /* Guest hamburger menu — limited options until login */
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      className="h-9 w-9 sm:h-10 sm:w-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 relative"
                    >
                      <Menu className="h-4 w-4" />
                      {needRefresh && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300"></span>
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
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

                    {/* Budget Tools */}
                    <DropdownMenuItem onClick={() => onCopyPreviousMonth?.()}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Previous Month
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Preferences */}
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Support & About */}
                    <DropdownMenuItem onClick={() => setShowDonateSorter(true)}>
                      <Heart className="h-4 w-4 mr-2 text-pink-500" />
                      Support Sat Sorter
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDonate(true)}>
                      <Heart className="h-4 w-4 mr-2" />
                      Support Bitcoin Projects
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => setShowAbout(true)}>
                      <Info className="h-4 w-4 mr-2" />
                      About Sat Sorter
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowBitcoinEdu(true)}>
                      <GraduationCap className="h-4 w-4 mr-2" />
                      Learn About Bitcoin
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Safe reloads — never delete your local budgets */}
                    <DropdownMenuItem onClick={handleForceReload}>
                      <RotateCw className="h-4 w-4 mr-2" />
                      Force reload latest code from server
                      <span className="ml-auto text-[10px] text-muted-foreground/60">bypass cache</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleUpdateApp}>
                      <RotateCw className="h-4 w-4 mr-2" />
                      Update to latest version
                      <span className="ml-auto text-[10px] text-muted-foreground/60">recommended</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* NUCLEAR OPTION — can permanently delete local budgets */}
                    <DropdownMenuItem
                      onClick={handleFactoryReset}
                      className="text-destructive focus:text-destructive font-medium"
                    >
                      <RotateCw className="h-4 w-4 mr-2" />
                      Factory Reset — Delete all local data
                    </DropdownMenuItem>
                    <div className="px-3 pb-1 text-[9px] leading-tight text-destructive/80">
                      ⚠️ WARNING: This permanently deletes your budgets on this device.<br />
                      Safe ONLY if you are logged in with Nostr AND have a working cloud backup.<br />
                      Guest mode or no backup = your data will be lost forever.
                    </div>

                    <div className="px-2 pt-2 text-[10px] text-muted-foreground/60 text-center tabular-nums">
                      v{APP_VERSION}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
           <div className="flex items-center justify-center gap-3 py-6">
             <Button size="icon" onClick={onPreviousMonth} className="h-10 w-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30">
               <ChevronLeft className="h-5 w-5" />
             </Button>
             <button
               onClick={() => setShowMonthPicker(true)}
               className="flex items-center gap-3 px-6 py-2 rounded-lg hover:bg-white/10 transition-colors"
             >
               <div>
                 <p className="text-xs text-white/70 uppercase tracking-widest">Current Month</p>
                 <h2 className="text-3xl font-bold text-white">
                   {formatMonth(currentMonth)}
                 </h2>
               </div>
               <Calendar className="h-5 w-5 text-white/60" />
             </button>
             <Button size="icon" onClick={onNextMonth} className="h-10 w-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30">
               <ChevronRight className="h-5 w-5" />
             </Button>
           </div>

             {/* Budget totals - Responsive grid with cards */}
             <div className="grid grid-cols-3 gap-2 sm:gap-4 pb-6">
               {/* Income */}
               <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 sm:p-4 text-center min-w-0">
                 <p className="text-xs text-white/70 uppercase tracking-widest mb-0.5">Income</p>
                 <p className="text-lg sm:text-3xl font-bold text-green-300 tabular-nums whitespace-nowrap">
                   {formatAmountCompact(totalIncome)}
                 </p>
               </div>
 
               {/* Planned */}
               <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 sm:p-4 text-center min-w-0">
                 <p className="text-xs text-white/70 uppercase tracking-widest mb-0.5">Planned</p>
                 <p className="text-lg sm:text-3xl font-bold text-white tabular-nums whitespace-nowrap">
                   {formatAmountCompact(totalExpenses)}
                 </p>
               </div>
 
               {/* Remaining */}
               <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 sm:p-4 text-center min-w-0">
                 <p className="text-xs text-white/70 uppercase tracking-widest mb-0.5">Left</p>
                 <p
                   className={cn(
                     'text-lg sm:text-3xl font-bold tabular-nums whitespace-nowrap',
                     isZeroed && 'text-green-300',
                     isOver && 'text-red-300',
                     !isZeroed && !isOver && 'text-blue-300'
                   )}
                 >
                   {formatAmountCompact(Math.abs(remaining))}
                 </p>
               </div>
             </div>

          {/* Zero-based budget indicator */}
          <div className="flex justify-center">
            {isZeroed ? (
              <Badge className="bg-success text-success-foreground text-xs">
                ✓ Every {currency === 'usd' ? 'dollar' : 'sat'} has a job!
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
            <DialogDescription>
              Choose a different month to view or edit
            </DialogDescription>
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

         {/* Reset Confirmation — first step */}
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
               <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
                 Cancel
               </Button>
               <Button
                 variant="destructive"
                 onClick={() => {
                   setShowResetConfirm(false);
                   setShowResetFinalConfirm(true);
                 }}
               >
                 Continue
               </Button>
             </div>
           </DialogContent>
         </Dialog>

         {/* Final Reset Confirmation — extra security layer */}
         <Dialog open={showResetFinalConfirm} onOpenChange={setShowResetFinalConfirm}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2 text-destructive">
                 <AlertTriangle className="h-5 w-5" />
                 Final Confirmation — Reset This Month?
               </DialogTitle>
               <DialogDescription>
                 This action is irreversible. All categories, line items, and transactions for {formatMonth(currentMonth)} will be permanently deleted.
               </DialogDescription>
             </DialogHeader>
             <div className="space-y-4">
               <p className="text-sm text-muted-foreground">
                 Please confirm one more time that you want to completely reset this month's budget.
               </p>
             </div>
             <div className="flex gap-3 justify-end">
               <Button variant="outline" onClick={() => setShowResetFinalConfirm(false)}>
                 Cancel
               </Button>
               <Button
                 variant="destructive"
                 onClick={() => {
                   onResetBudgetMonth?.();
                   setShowResetFinalConfirm(false);
                 }}
               >
                 Yes, permanently reset
               </Button>
             </div>
           </DialogContent>
         </Dialog>

         {/* Manage Partners Dialog */}
         <ManagePartnersDialog
           open={showPartners}
           onOpenChange={setShowPartners}
           userRole={userRole}
         />

        {/* Backup & Sync Dialog */}
        <BackupRestoreDialog
          open={showBackup}
          onOpenChange={setShowBackup}
        />

        {/* Maple AI Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Maple AI</DialogTitle>
              <DialogDescription>
                Connect your Maple API key and configure Budget Buddy.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <MapleSettings />
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Methods Dialog */}
        <Dialog open={showPaymentMethods} onOpenChange={setShowPaymentMethods}>
          <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Methods</DialogTitle>
              <DialogDescription>
                Manage the payment methods you use for transactions.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <PaymentMethodsManager />
            </div>
          </DialogContent>
        </Dialog>

        {/* Donate Dialog — Support Sat Sorter */}
        <DonateDialog
          open={showDonateSorter}
          onOpenChange={setShowDonateSorter}
        />

        {/* Donate Dialog — Support Bitcoin Projects */}
        <DonateDialog
          open={showDonate}
          onOpenChange={setShowDonate}
        />

        {/* About Sat Sorter Dialog */}
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

        {/* Learn About Bitcoin Dialog */}
        <Dialog open={showBitcoinEdu} onOpenChange={setShowBitcoinEdu}>
          <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Learn About Bitcoin
              </DialogTitle>
              <DialogDescription>
                Resources to deepen your understanding of Bitcoin
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Getting Started</h3>
                  <p className="text-sm text-muted-foreground">
                    Bitcoin is a decentralized digital currency that enables peer-to-peer transactions
                    without intermediaries. It was created in 2009 by Satoshi Nakamoto.
                    Start with <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">the original whitepaper</a>.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Key Resources</h3>
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

         {/* Login Dialog */}
        <LoginDialog
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onLogin={() => setShowLogin(false)}
        />

        {/* Guest Upgrade Modal */}
        <GuestUpgradeModal
          open={showGuestUpgrade}
          onOpenChange={setShowGuestUpgrade}
        />
      </header>
   );
 }
