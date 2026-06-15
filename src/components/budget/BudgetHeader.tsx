import { useState } from 'react';
import { Bitcoin, DollarSign, ChevronLeft, ChevronRight, Wallet, Zap, Calendar, Menu, Info, Heart, ExternalLink, Shield, Globe, GraduationCap, User, LogIn, UserPlus, Cloud, Moon, Sun, RotateCw, Copy, AlertTriangle } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { BackupRestoreDialog } from './BackupRestoreDialog';
import { ManagePartnersDialog } from './ManagePartnersDialog';
import { CopyMonthPrompt } from './CopyMonthPrompt';
import { DonateDialog } from './DonateDialog';
import { MapleSettings } from '@/components/maple/MapleSettings';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { useRegisterSW } from '@/hooks/useRegisterSW';

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
  onCopyPreviousMonth?: (sourceMonth: string) => void;
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
  const { needRefresh } = useRegisterSW();
  const { isDark, toggle: toggleTheme } = useTheme();
  // Use Nostr-native partners hook for the count badge
  const { partners: nostrPartners } = usePartners();
  // Get pending invites count for the notification badge
  const { pendingInvitesCount } = usePartnerInvites();
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
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

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

   const handleRefresh = async () => {
     // Clear all caches to force fresh download of app code
     if ('caches' in window) {
       try {
         const cacheNames = await caches.keys();
         await Promise.all(cacheNames.map(name => caches.delete(name)));
       } catch (e) {
         console.warn('Failed to clear caches:', e);
       }
     }
      // 1. Unregister any service workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
        } catch (e) {
          console.warn('Failed to unregister service workers:', e);
        }
      }
      
      // 2. Clear Cache Storage (the app assets cache)
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        } catch (e) {
          console.warn('Failed to clear caches:', e);
        }
      }
      
      // 3. Hard reload - bypass browser cache
      window.location.reload();
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



            {/* Account Switcher (when logged in) */}
            {user && (
              <div className="ml-1">
                <AccountSwitcher 
                  onAddAccountClick={() => setShowLogin(true)}
                  onBudgetPartnersClick={() => setShowPartners(true)}
                  partnersCount={nostrPartners.length}
                  pendingInvitesCount={pendingInvitesCount}
                  onOpenWallet={() => onOpenWallet && onOpenWallet()}
                  onOpenMapleSettings={() => setShowSettings(true)}
                  onOpenPaymentMethods={() => setShowPaymentMethods(true)}
                  onCopyPreviousMonth={() => setShowCopyPrompt(true)}
                  onResetBudgetMonth={() => setShowResetConfirm(true)}
                  onRefreshApp={handleRefresh}
                  onOpenBackup={() => setShowBackup(true)}
                />
              </div>
            )}

             {/* App Menu — hidden when logged in (content lives inside the profile carrot) */}
              {!user && (
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
                {/* Account */}
                {!user && (
                  <DropdownMenuItem onClick={() => setShowLogin(true)}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In with Nostr
                  </DropdownMenuItem>
                )}
                {user && (
                  <DropdownMenuItem onClick={() => setShowPartners(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Budget Partners
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Budget Tools */}
                  <DropdownMenuItem onClick={() => setShowCopyPrompt(true)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Previous Month
                  </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowResetConfirm(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Reset This Month
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* AI Assistant - Maple (prominent and separate) */}
                <DropdownMenuItem onClick={() => setShowSettings(true)}>
                  <span className="h-4 w-4 mr-2 text-center text-sm">🤖</span>
                  Maple AI
                </DropdownMenuItem>

                {/* Payment Methods */}
                <DropdownMenuItem onClick={() => setShowPaymentMethods(true)}>
                  <span className="h-4 w-4 mr-2 text-center text-sm">💳</span>
                  Payment Methods
                </DropdownMenuItem>

                {/* Wallet / Data Sources */}
                <DropdownMenuItem onClick={onOpenWallet}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Lightning Wallet
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Preferences */}
                <DropdownMenuItem onClick={toggleTheme}>
                  {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Support */}
                <DropdownMenuItem onClick={() => setShowDonateSorter(true)}>
                  <Heart className="h-4 w-4 mr-2 text-pink-500" />
                  Support Sat Sorter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDonate(true)}>
                  <Heart className="h-4 w-4 mr-2" />
                  Support Bitcoin Projects
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* About */}
                <DropdownMenuItem onClick={() => setShowAbout(true)}>
                  <Info className="h-4 w-4 mr-2" />
                  About Sat Sorter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBitcoinEdu(true)}>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Learn About Bitcoin
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Advanced */}
                <DropdownMenuItem onClick={handleRefresh}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  Refresh App
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBackup(true)}>
                  <Cloud className="h-4 w-4 mr-2" />
                  Backup & Sync
                </DropdownMenuItem>
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
                Please confirm one more time that you want to completely reset this month’s budget.
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

        {/* Backup & Sync Dialog */}
        <BackupRestoreDialog
          open={showBackup}
          onOpenChange={setShowBackup}
        />
     </header>
   );
 }
