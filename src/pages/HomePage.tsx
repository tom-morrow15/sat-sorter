import { useState, useMemo, useRef } from 'react';
import { Plus, Bitcoin, Zap, Wallet, Info, Copy, X } from 'lucide-react';
import { useSeoMeta, useHead } from '@unhead/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BucketCard } from '@/components/budget/BucketCard';
import { DashboardSummary } from '@/components/budget/DashboardSummary';
import { BtcTipCard } from '@/components/budget/BtcTipCard';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { UpgradeDialog } from '@/components/budget/UpgradeDialog';
import { GuestLimitDialog } from '@/components/budget/GuestLimitDialog';
import { useSubscription } from '@/hooks/useSubscription';
import { CopyMonthPrompt, type AvailableMonth } from '@/components/budget/CopyMonthPrompt';
import { CopyMonthWithUpgrade } from '@/components/budget/CopyMonthWithUpgrade';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBudget } from '@/hooks/useBudget';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBTCMap } from '@/hooks/useBTCMap';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { useSyncCopiedBudget } from '@/hooks/useSharedBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { FirstRunOnboarding } from '@/components/FirstRunOnboarding';
import { formatMonth } from '@/lib/budgetTypes';

export default function HomePage() {
  const navigate = useNavigate();
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showGuestLimitDialog, setShowGuestLimitDialog] = useState(false);
  const [dismissedNwcPrompt, setDismissedNwcPrompt] = useLocalStorage<boolean>('sat-sorter:nwc-prompt-dismissed', false);
  const [dismissedGuestBanner, setDismissedGuestBanner] = useLocalStorage<boolean>('sat-sorter:guest-banner-dismissed', false);
  const { toast } = useToast();

  const { user } = useCurrentUser();
  const { hasNWC } = useWallet();
  const { merchants } = useBTCMap();
  const { data: priceData } = useBitcoinPrice();
  const { syncCopiedBudget } = useSyncCopiedBudget();
  const { state: onboardingState } = useOnboarding();
  const { data: subscription } = useSubscription();

  const {
    currentBudget, currentMonth, currency, fullState, setCurrentMonth, toggleCurrency,
    addBucket, updateBucket, deleteBucket, addLineItem, updateLineItem, deleteLineItem,
    addTransaction, duplicateFromMonth, paymentMethods,
  } = useBudget();

  // Subscription limit check
  const FREE_TIER_BUCKETS = 5;
  const UNLIMITED_SENTINEL = 999999;
  const maxBucketsAllowed = subscription?.buckets ?? FREE_TIER_BUCKETS;
  const isGuest = !user?.pubkey;
  const currentBucketCount = currentBudget.buckets.length;
  const hasReachedBucketLimit = currentBucketCount >= maxBucketsAllowed && maxBucketsAllowed < UNLIMITED_SENTINEL;

  const handleAddBucketClick = () => {
    if (hasReachedBucketLimit) {
      if (isGuest) {
        setShowGuestLimitDialog(true);
      } else {
        setShowUpgradeDialog(true);
      }
    } else {
      setShowAddBucket(true);
    }
  };

  useSeoMeta({
    title: 'Sat Sorter - Bitcoin Budget App',
    description: 'Zero-based budgeting on a Bitcoin standard. Give every sat a job.',
  });

  useHead({
    link: [
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/icon-192.png' },
    ],
  });

  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleViewTransactions = (lineItemId: string) => navigate(`/transactions?lineItemId=${lineItemId}`);

  const sortedBuckets = [...currentBudget.buckets].sort((a, b) => {
    if (a.isIncome !== b.isIncome) return a.isIncome ? -1 : 1;
    return a.order - b.order;
  });

  const incomeBucket = sortedBuckets.find(b => b.isIncome);
  const expenseBuckets = sortedBuckets.filter(b => !b.isIncome);

  const availableCopyMonths = useMemo<AvailableMonth[]>(() => {
    return fullState.budgets
      .filter(b => b.month !== currentMonth && b.buckets.length > 0)
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(b => ({ month: b.month, budget: b }));
  }, [fullState.budgets, currentMonth]);

  const [showPlanNextMonthUpgrade, setShowPlanNextMonthUpgrade] = useState(false);
  const pendingPlanNextMonth = useRef<string | null>(null);

  const handlePlanNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

    // If current month has more buckets than the subscription allows, require upgrade for next month
    // (skip for unlimited users — their maxBucketsAllowed is the unlimited sentinel)
    if (!isGuest && maxBucketsAllowed < UNLIMITED_SENTINEL && currentBudget.buckets.length > maxBucketsAllowed) {
      pendingPlanNextMonth.current = nextMonth;
      setShowPlanNextMonthUpgrade(true);
      return;
    }

    // Within limits — proceed with copy
    const result = duplicateFromMonth(currentMonth, nextMonth, priceData?.usdPerBtc);
    if (result.success) {
      toast({ title: 'Next month planned!', description: `Copied your budget to ${formatMonth(nextMonth)}.` });
      setCurrentMonth(nextMonth);
    } else {
      toast({ title: 'Could not plan next month', description: result.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handlePlanNextMonthAfterUpgrade = () => {
    if (!pendingPlanNextMonth.current) return;
    const nextMonth = pendingPlanNextMonth.current;
    pendingPlanNextMonth.current = null;
    setShowPlanNextMonthUpgrade(false);

    const result = duplicateFromMonth(currentMonth, nextMonth, priceData?.usdPerBtc);
    if (result.success) {
      toast({ title: 'Next month planned!', description: `Copied your budget to ${formatMonth(nextMonth)}.` });
      setCurrentMonth(nextMonth);
    } else {
      toast({ title: 'Could not plan next month', description: result.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleCopyPreviousMonth = (sourceMonth: string) => {
    const result = duplicateFromMonth(sourceMonth, currentMonth, priceData?.usdPerBtc);
    if (result.success) {
      toast({ title: 'Budget copied!', description: result.message });
      setShowCopyPrompt(false);
      const newBudget = fullState.budgets.find(b => b.month === currentMonth);
      if (newBudget && newBudget.buckets.length > 0) {
        syncCopiedBudget(newBudget).catch(e => console.error('[HomePage] Failed to sync:', e));
      }
    } else {
      toast({ title: 'Cannot copy budget', description: result.message ?? 'An unknown error occurred', variant: 'destructive' });
    }
  };

  const hasBudget = currentBudget.buckets.length > 0;
  // DashboardSummary only renders when there's a plan to track (planned > 0).
  // Otherwise we show the welcome hero so the seam is always bridged.
  const hasPlan = currentBudget.buckets.some(
    b => !b.isIncome && b.lineItems.some(li => li.plannedAmount > 0)
  );

  return (
    <div className="min-h-screen bg-background">
      <BudgetHeader
        buckets={currentBudget.buckets}
        currentMonth={currentMonth}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onOpenWallet={() => setShowWalletModal(true)}
        onSelectMonth={setCurrentMonth}
        availableMonths={[currentMonth]}
        allBudgets={fullState.budgets}
        onCopyPreviousMonth={() => setShowCopyPrompt(true)}
        onPlanNextMonth={handlePlanNextMonth}
      />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-5 pb-6">
        {hasPlan ? (
          <DashboardSummary
            buckets={currentBudget.buckets}
            transactions={currentBudget.transactions}
            currency={currency}
          />
        ) : (
          <div className="bh-card p-5 flex items-center gap-4 border-l-4 border-l-primary animate-slide-in-up" style={{ animationFillMode: 'both' }}>
            <div className="h-12 w-12 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <Bitcoin className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg leading-tight">Welcome to Sat Sorter</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Give every sat a job. Start by adding your income and expenses below.
              </p>
            </div>
          </div>
        )}

        {/* Alerts */}
        <div className="space-y-3 mt-4">
          {onboardingState === 'guest' && !dismissedGuestBanner && (
            <Alert className="bg-card border-l-4 border-l-primary relative">
              <button
                onClick={() => setDismissedGuestBanner(true)}
                className="absolute top-1 right-1 z-10 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-12">
                <div>
                  <span className="text-sm font-medium">Budgeting on a Bitcoin standard.</span>
                  <span className="text-sm text-muted-foreground"> Create a free Nostr account for cloud sync, budget sharing, and an AI budget buddy.</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/create-account')} className="shrink-0 touch-target-sm">
                  Create Account
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!user && onboardingState !== 'guest' && (
            <Alert className="bg-card border-l-4 border-l-primary">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm">Log in with Nostr to sync your budget across devices.</span>
                <LoginArea className="shrink-0" />
              </AlertDescription>
            </Alert>
          )}

          {user && !hasNWC && !dismissedNwcPrompt && (
            <Alert className="bg-card border-l-4 border-l-primary relative">
              <button
                onClick={() => setDismissedNwcPrompt(true)}
                className="absolute top-1 right-1 z-10 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-12">
                <span className="text-sm">Connect your Lightning wallet to track transactions automatically.</span>
                <Button variant="outline" size="sm" onClick={() => setShowWalletModal(true)} className="shrink-0 touch-target-sm">
                  <Wallet className="h-4 w-4 mr-2" /> Connect
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="mt-4">
          <BtcTipCard />
        </div>

        {/* Budget categories */}
        <div className="space-y-4 mt-6">
          {incomeBucket && (
            <>
              <div className="flex items-center gap-2.5" style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: '0.05s', animationFillMode: 'both' }}>
                <div className="h-6 w-1 rounded-sm bg-[hsl(var(--success))]" />
                <div>
                  <h2 className="font-serif text-lg tracking-tight leading-none">Income</h2>
                  <p className="bh-caption text-muted-foreground mt-1.5">Money coming in this month</p>
                </div>
              </div>
              <div className="animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
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
                  paymentMethods={paymentMethods}
                  isGuest={isGuest}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2" style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: '0.15s', animationFillMode: 'both' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-1 rounded-sm bg-primary" />
              <div>
                <h2 className="font-serif text-lg tracking-tight leading-none">Expenses</h2>
                <p className="bh-caption text-muted-foreground mt-1.5">
                  {expenseBuckets.length} {expenseBuckets.length === 1 ? 'category' : 'categories'}
                </p>
              </div>
            </div>
            {hasBudget && (
              <Button size="sm" onClick={handleAddBucketClick} className="touch-target-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Add Category</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>

          {/* Two-column grid on desktop, single column on mobile/tablet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {expenseBuckets.map((bucket, index) => (
              <div key={bucket.id} className="animate-slide-in-up" style={{ animationDelay: `${0.15 + index * 0.06}s`, animationFillMode: 'both' }}>
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
                  paymentMethods={paymentMethods}
                  isGuest={isGuest}
                />
              </div>
            ))}
          </div>

          {/* Empty state */}
          {expenseBuckets.length === 0 && (
            <div className="bh-card text-center py-14 sm:py-16 px-6 animate-slide-in-up" style={{ animationFillMode: 'both' }}>
              <div>
                <div className="h-16 w-16 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto mb-5">
                  <Bitcoin className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl mb-2 tracking-tight">Start building your budget</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  Create expense categories to organize your spending. Give every sat a job and take control of your finances.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {availableCopyMonths.length > 0 && (
                    <Button variant="outline" onClick={() => setShowCopyPrompt(true)} className="touch-target-sm">
                      <Copy className="h-4 w-4 mr-2" /> Copy from Previous Month
                    </Button>
                  )}
                  <Button onClick={handleAddBucketClick} className="btn-interactive touch-target-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {availableCopyMonths.length > 0 ? 'Start Fresh' : 'Add Your First Category'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 pt-8 divider-soft text-center space-y-2">
          <p className="text-xs text-muted-foreground/70 italic">
            Since 1913, the US dollar has lost over 96% of its purchasing power. Bitcoin fixes this.
          </p>
        </footer>
      </main>

      <AddBucketDialog
        open={showAddBucket}
        onOpenChange={setShowAddBucket}
        onAdd={(name, color, icon) => addBucket(name, color, icon)}
        currentBucketCount={currentBucketCount}
        maxBucketsAllowed={maxBucketsAllowed}
        isGuest={isGuest}
        onUpgradeNeeded={() => {
          setShowAddBucket(false);
          setShowUpgradeDialog(true);
        }}
        onLoginNeeded={() => {
          setShowAddBucket(false);
          setShowGuestLimitDialog(true);
        }}
      />

      {!isGuest && (
        <UpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          bucketCount={currentBucketCount}
          maxBucketsForFreeTier={FREE_TIER_BUCKETS}
          onUpgradeComplete={() => {
            toast({
              title: 'Access unlocked!',
              description: 'You can now add more budget buckets.',
            });
          }}
        />
      )}

      <GuestLimitDialog
        open={showGuestLimitDialog}
        onOpenChange={setShowGuestLimitDialog}
      />

      {/* Plan Next Month upgrade dialog */}
      {!isGuest && (
        <UpgradeDialog
          open={showPlanNextMonthUpgrade}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowPlanNextMonthUpgrade(false);
              pendingPlanNextMonth.current = null;
            }
          }}
          bucketCount={currentBudget.buckets.length}
          maxBucketsForFreeTier={FREE_TIER_BUCKETS}
          onUpgradeComplete={handlePlanNextMonthAfterUpgrade}
        />
      )}
      {(() => {
        const previousMonthBudget = availableCopyMonths[0]?.budget ?? null;
        return (
          <CopyMonthWithUpgrade
            open={showCopyPrompt}
            onOpenChange={setShowCopyPrompt}
            currentMonth={currentMonth}
            availableMonths={availableCopyMonths}
            previousBudget={previousMonthBudget}
            currentBudgets={fullState.budgets.filter(b => b.month === currentMonth)}
            onStartFresh={() => toast({ title: 'Starting fresh', description: 'Your new month is ready.' })}
              onCopyPrevious={handleCopyPreviousMonth}
              maxBucketsAllowed={maxBucketsAllowed}
            />
        );
      })()}
      {showWalletModal && <WalletModalControlled open={showWalletModal} onOpenChange={setShowWalletModal} />}
      <FirstRunOnboarding />
    </div>
  );
}
