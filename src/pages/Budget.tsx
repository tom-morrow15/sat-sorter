import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Bitcoin, Zap, Wallet, Info, Copy, Cloud, Loader2, X, RefreshCw } from 'lucide-react';
import { useSeoMeta, useHead } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { BucketCard } from '@/components/budget/BucketCard';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { TransactionsPanel } from '@/components/budget/TransactionsPanel';
import { BTCMapBanner } from '@/components/budget/BTCMapBanner';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { QuickAddFAB } from '@/components/budget/QuickAddFAB';
import { OnboardingWelcome } from '@/components/budget/OnboardingWelcome';
import { FirstTimeBudgetPrompt, EmptyBudgetCategories } from '@/components/budget/EmptyStates';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBudget } from '@/hooks/useBudget';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBTCMap } from '@/hooks/useBTCMap';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useNWCSync } from '@/hooks/useNWCSync';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';

const AUTO_SYNC_INTERVAL_MS = 30000; // 30 seconds

export default function Budget() {
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const autoSyncIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastSyncedStateRef = useRef<string>('');
  const initialLoadCompleteRef = useRef(false);

  const { user } = useCurrentUser();
  const { hasAlbyHub, hasLNbits } = useWallet();
  const { merchants } = useBTCMap();
  const { shouldShowOnboarding, hasCompletedOnboarding, completeOnboarding } = useOnboarding();
  const [walletPromptDismissed, setWalletPromptDismissed] = useLocalStorage('wallet-prompt-dismissed', false);
  const { toast } = useToast();

  // Check if user has any wallet connected
  const hasWalletConnected = hasAlbyHub || hasLNbits;

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
    updateTransaction,
    assignTransaction,
    deleteTransaction,
    duplicateFromMonth,
    getPreviousMonth,
    hasPreviousMonthBudget,
    mergeBudgetFromCloud,
    getFullBudgetState,
  } = useBudget();

  const { uploadBudget, downloadBudget, canSync, remoteTimestamp } = useBudgetSync();

  // Manual sync function
  const performSync = useCallback(async (showToast = true) => {
    if (!canSync) return false;

    try {
      setSyncStatus('syncing');
      const fullState = getFullBudgetState();
      const success = await uploadBudget(fullState);

      if (success) {
        localStorage.setItem('sat-sorter-last-sync', Math.floor(Date.now() / 1000).toString());
        lastSyncedStateRef.current = JSON.stringify(fullState);
        setHasUnsyncedChanges(false);
        setSyncStatus('synced');
        if (showToast) {
          toast({
            title: 'Budget synced',
            description: 'Your budget has been saved to Nostr relays.',
          });
        }
        syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 2000);
        return true;
      } else {
        setSyncStatus('error');
        syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
        return false;
      }
    } catch (error) {
      console.error('[Budget] Sync failed:', error);
      setSyncStatus('error');
      syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
      return false;
    }
  }, [canSync, getFullBudgetState, uploadBudget, toast]);

  // Show onboarding for new users
  useEffect(() => {
    if (shouldShowOnboarding) {
      // Small delay for smoother UX
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowOnboarding]);

  useSeoMeta({
    title: 'Sat Sorter - Bitcoin Budget App',
    description: 'Zero-based budgeting on a Bitcoin standard. Give every sat a job.',
  });

  useHead({
    link: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  });

  // State to track when initial cloud load is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(!canSync);

  // Initialize NWC sync - only after initial budget load is complete
  // This prevents NWC-imported transactions from being overwritten by cloud sync
  useNWCSync({ enabled: initialLoadComplete });

  // Load budget from cloud when user logs in
  useEffect(() => {
    if (!canSync || initialLoadCompleteRef.current) return;

    const loadCloudBudget = async () => {
      try {
        setSyncStatus('syncing');
        const cloudBudget = await downloadBudget();
        if (cloudBudget && remoteTimestamp) {
          console.log('[Budget] Loaded budget from cloud, merging...');
          // Merge the cloud budget into local state
          const wasApplied = mergeBudgetFromCloud(cloudBudget, remoteTimestamp);
          if (wasApplied) {
            console.log('[Budget] Cloud budget applied successfully');
            // Update the reference to prevent detecting this as a change
            lastSyncedStateRef.current = JSON.stringify(cloudBudget);
          }
        }
        initialLoadCompleteRef.current = true;
        setInitialLoadComplete(true);
        setSyncStatus('synced');
        syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (error) {
        console.error('[Budget] Failed to load cloud budget:', error);
        initialLoadCompleteRef.current = true;
        setInitialLoadComplete(true);
        setSyncStatus('error');
        syncTimeoutRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
      }
    };

    loadCloudBudget();

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [canSync, downloadBudget, mergeBudgetFromCloud, remoteTimestamp]);

  // Detect changes to the budget state
  useEffect(() => {
    if (!initialLoadCompleteRef.current) return;

    const currentStateStr = JSON.stringify(getFullBudgetState());
    if (lastSyncedStateRef.current && currentStateStr !== lastSyncedStateRef.current) {
      setHasUnsyncedChanges(true);
    }
  }, [currentBudget, getFullBudgetState]);

  // Auto-save every 30 seconds if there are unsynced changes
  useEffect(() => {
    if (!canSync) return;

    // Clear any existing interval
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
    }

    // Set up the 30-second auto-save interval
    autoSyncIntervalRef.current = setInterval(async () => {
      if (hasUnsyncedChanges && syncStatus !== 'syncing') {
        console.log('[Budget] Auto-syncing budget (30s interval)...');
        await performSync(false); // Silent sync (no toast)
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [canSync, hasUnsyncedChanges, syncStatus, performSync]);

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

  // Sort buckets - income first, then by order
  const sortedBuckets = [...currentBudget.buckets].sort((a, b) => {
    if (a.isIncome !== b.isIncome) return a.isIncome ? -1 : 1;
    return a.order - b.order;
  });

  const incomeBucket = sortedBuckets.find(b => b.isIncome);
  const expenseBuckets = sortedBuckets.filter(b => !b.isIncome);

  // Count unassigned transactions
  const unassignedCount = useMemo(() =>
    currentBudget.transactions.filter(t => t.lineItemId === null).length,
    [currentBudget.transactions]
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
        unassignedCount={unassignedCount}
        syncStatus={syncStatus}
        hasUnsyncedChanges={hasUnsyncedChanges}
        onManualSync={() => performSync(true)}
        canSync={canSync}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 lg:py-6">
        {/* Alerts Section - Full width */}
        <div className="space-y-3 mb-4">
          {/* Login prompt for guests */}
          {!user && (
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

          {/* Wallet connection prompt - only show if not connected and not dismissed */}
          {user && !hasWalletConnected && !walletPromptDismissed && (
            <Alert className="border-primary/30 bg-primary/5 relative">
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
                <span className="text-sm">
                  Import transactions from your wallet or add them manually.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWalletModal(true)}
                  className="shrink-0"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </AlertDescription>
              <button
                onClick={() => setWalletPromptDismissed(true)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </Alert>
          )}
        </div>

        {/* Tour prompt for users who haven't done onboarding */}
        {!hasCompletedOnboarding && showTourPrompt && (
          <FirstTimeBudgetPrompt
            onStartTour={() => {
              setShowOnboarding(true);
              setShowTourPrompt(false);
            }}
            onDismiss={() => {
              setShowTourPrompt(false);
              completeOnboarding();
            }}
            className="mb-4"
          />
        )}

        {/* Main Layout - Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Left Column - Budget Categories */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* BTCMap Banner */}
            <BTCMapBanner />

            {/* Budget Dashboard - Spending Overview */}
            <BudgetDashboard
              buckets={currentBudget.buckets}
              transactions={currentBudget.transactions}
              currency={currency}
              month={currentMonth}
            />

            {/* Income bucket - always first */}
            {incomeBucket && (
              <BucketCard
                bucket={incomeBucket}
                transactions={currentBudget.transactions}
                currency={currency}
                merchants={merchants}
                onUpdateBucket={updateBucket}
                onDeleteBucket={deleteBucket}
                onAddLineItem={addLineItem}
                onUpdateLineItem={updateLineItem}
                onDeleteLineItem={deleteLineItem}
              />
            )}

            {/* Section header for expenses */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Expense Categories</h2>
                <span className="text-sm text-muted-foreground">
                  ({expenseBuckets.length})
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddBucket(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Add Category</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>

            {/* Expense buckets */}
            <div className="space-y-3">
              {expenseBuckets.map((bucket) => (
                <BucketCard
                  key={bucket.id}
                  bucket={bucket}
                  transactions={currentBudget.transactions}
                  currency={currency}
                  merchants={merchants}
                  onUpdateBucket={updateBucket}
                  onDeleteBucket={deleteBucket}
                  onAddLineItem={addLineItem}
                  onUpdateLineItem={updateLineItem}
                  onDeleteLineItem={deleteLineItem}
                />
              ))}
            </div>

            {/* Empty state for no expense buckets */}
            {expenseBuckets.length === 0 && (
              <EmptyBudgetCategories
                onAddCategory={() => setShowAddBucket(true)}
                onCopyFromLastMonth={hasPreviousMonthBudget ? () => duplicateFromMonth(getPreviousMonth()) : undefined}
                hasPreviousMonthBudget={hasPreviousMonthBudget}
              />
            )}
          </div>

          {/* Right Column - Transactions */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-6">
              <TransactionsPanel
                transactions={currentBudget.transactions}
                buckets={currentBudget.buckets}
                currency={currency}
                onAddTransaction={addTransaction}
                onAssignTransaction={assignTransaction}
                onUpdateTransaction={updateTransaction}
                onDeleteTransaction={deleteTransaction}
                onOpenWallet={() => setShowWalletModal(true)}
              />
            </div>
          </div>
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

      {/* Wallet Modal - controlled via state */}
      {showWalletModal && (
        <WalletModalControlled
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
        />
      )}

      {/* Quick Add FAB */}
      <QuickAddFAB
        onAddTransaction={addTransaction}
        currency={currency}
      />

      {/* Onboarding Welcome Dialog */}
      <OnboardingWelcome
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={completeOnboarding}
      />
    </div>
  );
}
