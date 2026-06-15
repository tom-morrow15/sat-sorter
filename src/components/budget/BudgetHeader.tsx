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

      {/* Donate to Sat Sorter Dialog */}
      <DonateDialog open={showDonateSorter} onOpenChange={setShowDonateSorter} />

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

        {/* Maple AI Dialog */}
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

        {/* Budget Partners Dialog */}
        <ManagePartnersDialog
          open={showPartners}
          onOpenChange={setShowPartners}
          userRole={userRole}
        />

         {/* Copy Budget Dialog */}
          <CopyMonthPrompt
            open={showCopyPrompt}
            onOpenChange={setShowCopyPrompt}
            currentMonth={currentMonth}
            previousMonth={hasPreviousMonthBudget ? getPreviousMonth() : null}
            previousBudget={hasPreviousMonthBudget 
              ? allBudgets.find(b => b.month === getPreviousMonth()) || null 
              : null}
            onStartFresh={() => {
              toast({
                title: 'Starting fresh',
                description: 'Your new month is ready.',
              });
            }}
            onCopyPrevious={() => {
              const prevMonth = getPreviousMonth();
              const result = onCopyPreviousMonth?.(prevMonth);
              if (result?.success) {
                toast({
                  title: 'Budget copied',
                  description: `Copied from ${formatMonth(prevMonth)}`,
                });
              } else {
                toast({
                  title: 'Could not copy',
                  description: result?.message || 'Please try again.',
                  variant: 'destructive',
                });
              }
            }}
          />

         {/* Reset Budget Month Confirmation Dialog */}
        <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Reset This Month's Budget?
              </DialogTitle>
              <DialogDescription>
                This will permanently delete all categories, line items, and transactions for {formatMonth(currentMonth)}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. Are you sure you want to reset this month's budget?
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onResetBudgetMonth?.();
                  setShowResetConfirm(false);
                }}
              >
                Reset Budget
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
