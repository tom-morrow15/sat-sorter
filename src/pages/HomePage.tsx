import { useState, useMemo } from 'react';
import { Plus, Bitcoin, Zap, Wallet, Info, Copy, X } from 'lucide-react';
import { useSeoMeta, useHead } from '@unhead/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BucketCard } from '@/components/budget/BucketCard';
import { DashboardSummary } from '@/components/budget/DashboardSummary';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBudget } from '@/hooks/useBudget';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBTCMap } from '@/hooks/useBTCMap';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useOnboarding } from '@/contexts/OnboardingContext';

export default function HomePage() {
  const navigate = useNavigate();
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [dismissedNwcPrompt, setDismissedNwcPrompt] = useLocalStorage<boolean>('sat-sorter:nwc-prompt-dismissed', false);
  const [dismissedGuestBanner, setDismissedGuestBanner] = useLocalStorage<boolean>('sat-sorter:guest-banner-dismissed', false);
  const { toast } = useToast();

  const { user } = useCurrentUser();
  const { hasNWC } = useWallet();
  const { merchants } = useBTCMap();
  const { state: onboardingState } = useOnboarding();

  const {
    currentBudget,
    currentMonth,
    currency,
    setCurrentMonth,
    toggleCurrency,
    addBucket,
    updateBucket,
    deleteBucket,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    addTransaction,
    duplicateFromMonth,
    getPreviousMonth,
    hasPreviousMonthBudget,
  } = useBudget();

  useSeoMeta({
    title: 'Sat Sorter - Bitcoin Budget App',
    description: 'Zero-based budgeting on a Bitcoin standard. Give every sat a job.',
  });

  useHead({
    link: [
      { rel: 'icon', type: 'image/svg+xml', href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">₿</text></svg>' },
    ],
  });

  // Month navigation
  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleViewTransactions = (lineItemId: string) => {
    navigate(`/transactions?lineItemId=${lineItemId}`);
  };

  // Sort buckets - income first, then by order
  const sortedBuckets = [...currentBudget.buckets].sort((a, b) => {
    if (a.isIncome !== b.isIncome) return a.isIncome ? -1 : 1;
    return a.order - b.order;
  });

  const incomeBucket = sortedBuckets.find(b => b.isIncome);
  const expenseBuckets = sortedBuckets.filter(b => !b.isIncome);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <BudgetHeader
        buckets={currentBudget.buckets}
        currentMonth={currentMonth}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onOpenWallet={() => setShowWalletModal(true)}
        onSelectMonth={setCurrentMonth}
      />

      <main className="container mx-auto px-3 sm:px-4 py-6 lg:py-8 max-w-4xl">
        {/* Alerts Section - Full width */}
        <div className="space-y-3 mb-4">
          {/* Guest mode banner */}
          {onboardingState === 'guest' && !dismissedGuestBanner && (
            <Alert className="border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 relative">
              <button
                onClick={() => setDismissedGuestBanner(true)}
                className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
                <span className="text-sm">
                  Your budget is stored in this browser only. To sync across devices or back up, create a free account.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/create-account')}
                  className="shrink-0 border-amber-400/60 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  Create Account
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Login prompt for logged-out users (not guest mode) */}
          {!user && onboardingState !== 'guest' && (
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm">
                  Log in with Nostr to sync your budget across devices.
                </span>
                <LoginArea className="shrink-0" />
              </AlertDescription>
            </Alert>
          )}

           {/* NWC connection prompt — dismissible so it doesn't live persistently */}
           {user && !hasNWC && !dismissedNwcPrompt && (
             <Alert className="border-primary/30 bg-primary/5 relative">
               <button
                 onClick={() => setDismissedNwcPrompt(true)}
                 className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground"
                 aria-label="Dismiss"
               >
                 <X className="h-4 w-4" />
               </button>
               <Zap className="h-4 w-4 text-primary" />
               <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
                 <span className="text-sm">
                   Connect your Lightning wallet to track transactions automatically.
                 </span>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setShowWalletModal(true)}
                   className="shrink-0"
                 >
                   <Wallet className="h-4 w-4 mr-2" />
                   Connect
                 </Button>
               </AlertDescription>
             </Alert>
           )}
        </div>

        {/* Dashboard Summary - at-a-glance overview */}
        <div className="mb-6 animate-slide-in-up" style={{ animationDelay: '0s', animationFillMode: 'both' }}>
          <DashboardSummary
            buckets={currentBudget.buckets}
            transactions={currentBudget.transactions}
            currency={currency}
          />
        </div>

        {/* Main Layout - Budget Categories */}
        <div className="space-y-4">
          {/* Income section header */}
          {incomeBucket && (
            <div className="flex items-center gap-2.5 pb-1" style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: '0.1s', animationFillMode: 'both' }}>
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-success to-emerald-400" />
              <div>
                <h2 className="text-lg font-bold tracking-tight">Income</h2>
                <p className="text-xs text-muted-foreground">Money coming in this month</p>
              </div>
            </div>
          )}

          {/* Income bucket - always first */}
           {incomeBucket && (
             <div className="animate-slide-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
               <BucketCard
                 bucket={incomeBucket}
                 buckets={currentBudget.buckets}
                 transactions={currentBudget.transactions}
                 currency={currency}
                 merchants={merchants}
                 onUpdateBucket={updateBucket}
                 onDeleteBucket={deleteBucket}
                 onAddLineItem={addLineItem}
                 onUpdateLineItem={updateLineItem}
                 onDeleteLineItem={deleteLineItem}
                 onAddTransaction={addTransaction}
                 onViewTransactions={handleViewTransactions}
               />
             </div>
           )}

           {/* Section header for expenses */}
           <div className="flex items-center justify-between pt-4 pb-1" style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: '0.2s', animationFillMode: 'both' }}>
             <div className="flex items-center gap-2.5">
               <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-orange-500" />
               <div>
                 <h2 className="text-lg font-bold tracking-tight">Expense Categories</h2>
                 <p className="text-xs text-muted-foreground">
                   {expenseBuckets.length} {expenseBuckets.length === 1 ? 'category' : 'categories'}
                 </p>
               </div>
             </div>
             <Button
               size="sm"
               onClick={() => setShowAddBucket(true)}
               className="btn-interactive shadow-sm"
             >
               <Plus className="h-4 w-4 mr-1.5" />
               <span className="hidden sm:inline">Add Category</span>
               <span className="sm:hidden">Add</span>
             </Button>
           </div>

            {/* Expense buckets */}
            <div className="space-y-3">
               {expenseBuckets.map((bucket, index) => (
                 <div
                   key={bucket.id}
                   className="animate-slide-in-up"
                   style={{ animationDelay: `${0.2 + index * 0.1}s`, animationFillMode: 'both' }}
                 >
                  <BucketCard
                    bucket={bucket}
                    buckets={currentBudget.buckets}
                    transactions={currentBudget.transactions}
                    currency={currency}
                    merchants={merchants}
                    onUpdateBucket={updateBucket}
                    onDeleteBucket={deleteBucket}
                    onAddLineItem={addLineItem}
                    onUpdateLineItem={updateLineItem}
                    onDeleteLineItem={deleteLineItem}
                    onAddTransaction={addTransaction}
                    onViewTransactions={handleViewTransactions}
                  />
                </div>
              ))}
            </div>

          {/* Empty state for no expense buckets */}
          {expenseBuckets.length === 0 && (
            <div className="relative text-center py-12 sm:py-16 px-6 sm:px-8 rounded-2xl bg-gradient-to-br from-card to-muted/40 border shadow-sm overflow-hidden">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-mesh-gradient opacity-40 pointer-events-none" />
              <div className="relative">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/10 flex items-center justify-center mx-auto mb-5 shadow-sm">
                  <Bitcoin className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                </div>
                <h3 className="font-bold text-xl sm:text-2xl mb-2 tracking-tight">
                  Start building your budget
                </h3>
                <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-6 leading-relaxed">
                  Create expense categories to organize your spending. Give every sat a job and take control of your finances.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {hasPreviousMonthBudget && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const result = duplicateFromMonth(getPreviousMonth());
                      if (result.success) {
                        toast({
                          title: 'Budget copied!',
                          description: result.message,
                        });
                      } else if (result.message) {
                        toast({
                          title: 'Cannot copy budget',
                          description: result.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy from Last Month
                  </Button>
                )}
                <Button onClick={() => setShowAddBucket(true)} className="shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {hasPreviousMonthBudget ? 'Start Fresh' : 'Add Your First Category'}
                </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 lg:mt-16 pt-6 lg:pt-8 border-t text-center space-y-3">
          {/* Easter egg - Dollar purchasing power */}
          <p className="text-xs text-muted-foreground/70 italic">
            💡 Since 1913, the US dollar has lost over 96% of its purchasing power.
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>
            Bitcoin fixes this.
          </p>

          <p className="text-sm text-muted-foreground">
            Vibed with{' '}
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Shakespeare
            </a>
          </p>
        </footer>
      </main>

      {/* Dialogs */}
      <AddBucketDialog
        open={showAddBucket}
        onOpenChange={setShowAddBucket}
        onAdd={(name, color, icon) => addBucket(name, color, icon)}
      />

      {/* Wallet / Data Sources modal (opened from the header wallet icon) */}
      {showWalletModal && (
        <WalletModalControlled
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
        />
      )}
    </div>
  );
}
