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
import { BtcTipCard } from '@/components/budget/BtcTipCard';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { CopyMonthPrompt, type AvailableMonth } from '@/components/budget/CopyMonthPrompt';
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
  const [dismissedNwcPrompt, setDismissedNwcPrompt] = useLocalStorage<boolean>('sat-sorter:nwc-prompt-dismissed', false);
  const [dismissedGuestBanner, setDismissedGuestBanner] = useLocalStorage<boolean>('sat-sorter:guest-banner-dismissed', false);
  const { toast } = useToast();

  const { user } = useCurrentUser();
  const { hasNWC } = useWallet();
  const { merchants } = useBTCMap();
  const { data: priceData } = useBitcoinPrice();
  const { syncCopiedBudget } = useSyncCopiedBudget();
  const { state: onboardingState } = useOnboarding();

  const {
    currentBudget, currentMonth, currency, fullState, setCurrentMonth, toggleCurrency,
    addBucket, updateBucket, deleteBucket, addLineItem, updateLineItem, deleteLineItem,
    addTransaction, duplicateFromMonth, paymentMethods,
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

  const handlePlanNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
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
          <div className="surface-card p-6 flex items-center gap-4 animate-slide-in-up" style={{ animationFillMode: 'both' }}>
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/15 to-orange-500/8 flex items-center justify-center shrink-0">
              <Bitcoin className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg leading-tight">Welcome to Sat Sorter</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Give every sat a job. Start by adding your income and expenses below.
              </p>
            </div>
          </div>
        )}

        {/* Alerts */}
        <div className="space-y-3 mt-4">
          {onboardingState === 'guest' && !dismissedGuestBanner && (
            <Alert className="surface-card border-primary/15 bg-primary/[0.04] relative">
              <button
                onClick={() => setDismissedGuestBanner(true)}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground touch-target-sm flex items-center justify-center"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
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
            <Alert className="surface-card border-primary/15 bg-primary/[0.04]">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm">Log in with Nostr to sync your budget across devices.</span>
                <LoginArea className="shrink-0" />
              </AlertDescription>
            </Alert>
          )}

          {user && !hasNWC && !dismissedNwcPrompt && (
            <Alert className="surface-card border-primary/15 bg-primary/[0.04] relative">
              <button
                onClick={() => setDismissedNwcPrompt(true)}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground touch-target-sm flex items-center justify-center"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
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
                <div className="h-6 w-1 rounded-full bg-gradient-to-b from-success to-emerald-400" />
                <div>
                  <h2 className="font-display text-lg tracking-tight leading-none">Income</h2>
                  <p className="text-xs text-muted-foreground mt-1">Money coming in this month</p>
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
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2" style={{ animation: 'fadeIn 0.3s ease-out', animationDelay: '0.15s', animationFillMode: 'both' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-orange-500" />
              <div>
                <h2 className="font-display text-lg tracking-tight leading-none">Expenses</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {expenseBuckets.length} {expenseBuckets.length === 1 ? 'category' : 'categories'}
                </p>
              </div>
            </div>
            {hasBudget && (
              <Button size="sm" onClick={() => setShowAddBucket(true)} className="btn-interactive touch-target-sm">
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Add Category</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>

          <div className="space-y-3">
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
                />
              </div>
            ))}
          </div>

          {/* Empty state */}
          {expenseBuckets.length === 0 && (
            <div className="surface-card relative text-center py-14 sm:py-16 px-6 overflow-hidden animate-slide-in-up" style={{ animationFillMode: 'both' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/15 to-orange-500/8 flex items-center justify-center mx-auto mb-5">
                  <Bitcoin className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-2xl mb-2 tracking-tight">Start building your budget</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
                  Create expense categories to organize your spending. Give every sat a job and take control of your finances.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {availableCopyMonths.length > 0 && (
                    <Button variant="outline" onClick={() => setShowCopyPrompt(true)} className="touch-target-sm">
                      <Copy className="h-4 w-4 mr-2" /> Copy from Previous Month
                    </Button>
                  )}
                  <Button onClick={() => setShowAddBucket(true)} className="btn-interactive touch-target-sm">
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
          <p className="text-sm text-muted-foreground">
            Vibed with{' '}
            <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Shakespeare
            </a>
          </p>
        </footer>
      </main>

      <AddBucketDialog open={showAddBucket} onOpenChange={setShowAddBucket} onAdd={(name, color, icon) => addBucket(name, color, icon)} />
      <CopyMonthPrompt
        open={showCopyPrompt}
        onOpenChange={setShowCopyPrompt}
        currentMonth={currentMonth}
        availableMonths={availableCopyMonths}
        onStartFresh={() => toast({ title: 'Starting fresh', description: 'Your new month is ready.' })}
        onCopyPrevious={handleCopyPreviousMonth}
      />
      {showWalletModal && <WalletModalControlled open={showWalletModal} onOpenChange={setShowWalletModal} />}
      <FirstRunOnboarding />
    </div>
  );
}
