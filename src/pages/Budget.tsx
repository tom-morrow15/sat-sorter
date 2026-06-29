import { useState, useMemo, useEffect } from 'react';

import { Plus, Bitcoin, Zap, Wallet, Info, Copy, Lock } from 'lucide-react';
import { useSeoMeta, useHead } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';
import { BucketCard } from '@/components/budget/BucketCard';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { CopyMonthPrompt, type AvailableMonth } from '@/components/budget/CopyMonthPrompt';
import { TransactionsPanel } from '@/components/budget/TransactionsPanel';
import { BTCMapBanner } from '@/components/budget/BTCMapBanner';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { QuickAddFAB } from '@/components/budget/QuickAddFAB';
import { PartnerSyncWrapper } from '@/components/budget/PartnerSyncWrapper';
import { MigrationBanner } from '@/components/budget/MigrationBanner';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBudget } from '@/hooks/useBudget';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBTCMap } from '@/hooks/useBTCMap';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { useSyncCopiedBudget } from '@/hooks/useSharedBudgetSync';
import { canAddBucket } from '@/lib/budgetPermissions';

const COPY_PROMPT_FLAG_PREFIX = 'sat-sorter-copy-prompt-shown-';

function hasCopyPromptBeenShown(month: string): boolean {
  try {
    return localStorage.getItem(`${COPY_PROMPT_FLAG_PREFIX}${month}`) === '1';
  } catch {
    return false;
  }
}

function markCopyPromptShown(month: string): void {
  try {
    localStorage.setItem(`${COPY_PROMPT_FLAG_PREFIX}${month}`, '1');
  } catch {
    // localStorage may not be available
  }
}

export default function Budget() {
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const { toast } = useToast();

  const { user } = useCurrentUser();
  const { hasNWC } = useWallet();
  const { merchants } = useBTCMap();
  const { data: priceData } = useBitcoinPrice();
  const { syncCopiedBudget } = useSyncCopiedBudget();

  const {
    currentBudget,
    currentMonth,
    currency,
    availableMonths,
    fullState,
    setCurrentMonth,
    toggleCurrency,
    addBucket,
    updateBucket,
    deleteBucket,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    addTransaction,
    addTransactions,
    assignTransaction,
    deleteTransaction,

    duplicateFromMonth,
    hasPreviousMonthBudget,
    partners,
    userRole,
    addPartner,
    removePartner,
    changePartnerPermission,
    resetCurrentMonth,
    paymentMethods,
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

  // Auto-prompt copy when navigating to a month with no budget
  useEffect(() => {
    const hasBudget = currentBudget.buckets.length > 0;
    if (hasBudget) return;

    // Only show the prompt once per month (tracked in localStorage)
    if (hasCopyPromptBeenShown(currentMonth)) return;

    // Only show if there are previous months to copy from
    if (!hasPreviousMonthBudget) return;

    markCopyPromptShown(currentMonth);
    // Small delay for smooth UX
    const timer = setTimeout(() => {
      setShowCopyPrompt(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [currentMonth, currentBudget.buckets.length, hasPreviousMonthBudget]);

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

  // Build available months list for CopyMonthPrompt (any month with budget data)
  const availableCopyMonths = useMemo<AvailableMonth[]>(() => {
    return fullState.budgets
      .filter(b => b.month !== currentMonth && b.buckets.length > 0)
      .sort((a, b) => b.month.localeCompare(a.month)) // newest first
      .map(b => ({ month: b.month, budget: b }));
  }, [fullState.budgets, currentMonth]);

  // Unified copy handler
  const handleCopyPreviousMonth = (sourceMonth: string) => {
    const currentPrice = priceData?.usdPerBtc;
    const result = duplicateFromMonth(sourceMonth, currentMonth, currentPrice);

    if (result.success) {
      toast({
        title: 'Budget copied!',
        description: result.message,
      });
      setShowCopyPrompt(false);

      // If on a shared budget, sync the new month to the budget keypair
      const newBudget = fullState.budgets.find(b => b.month === currentMonth);
      if (newBudget && newBudget.buckets.length > 0) {
        syncCopiedBudget(newBudget).catch(e => {
          console.error('[Budget] Failed to sync copied budget:', e);
        });
      }
    } else {
      toast({
        title: 'Cannot copy budget',
        description: result.message ?? 'An unknown error occurred',
        variant: 'destructive',
      });
      // Keep dialog open on failure so the user can try again
    }
  };

    return (
      <PartnerSyncWrapper>
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
         partners={partners}
         userRole={userRole}
         onAddPartner={addPartner}
         onRemovePartner={removePartner}
         onChangePartnerPermission={changePartnerPermission}
         availableMonths={availableMonths}
         allBudgets={fullState.budgets}
         onCopyPreviousMonth={() => setShowCopyPrompt(true)}
         onResetBudgetMonth={() => {
           resetCurrentMonth();
           toast({
             title: 'Budget reset',
             description: 'Your budget for this month has been cleared.',
           });
         }}
       />

       <MigrationBanner />

        <main className="container mx-auto px-3 sm:px-4 py-4 lg:py-6">
          {/* Alerts Section - Full width */}
           <div className="space-y-3 mb-4">
             {/* Role indicator for partners */}
             {userRole !== 'owner' && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className="text-sm text-amber-900 dark:text-amber-100">
                    You're viewing this budget as a <Badge variant="secondary" className="ml-1">{userRole === 'viewer' ? 'Viewer' : 'Editor'}</Badge>
                    {userRole === 'viewer' ? ' - view-only access' : ' - you can edit but not delete'}
                  </span>
                </AlertDescription>
              </Alert>
            )}

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

           {/* NWC connection prompt */}
           {user && !hasNWC && (
             <Alert className="border-primary/30 bg-primary/5">
               <Zap className="h-4 w-4 text-primary" />
               <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                  buckets={currentBudget.buckets}
                  transactions={currentBudget.transactions}
                  currency={currency}
                  merchants={merchants}
                  onUpdateBucket={updateBucket}
                  onDeleteBucket={deleteBucket}
                  onAddLineItem={addLineItem}
                  onUpdateLineItem={updateLineItem}
                  onDeleteLineItem={deleteLineItem}
                  paymentMethods={paymentMethods}
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
                  disabled={!canAddBucket(userRole)}
                  title={!canAddBucket(userRole) ? 'You don\'t have permission to add categories' : undefined}
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
                    buckets={currentBudget.buckets}
                    transactions={currentBudget.transactions}
                    currency={currency}
                    merchants={merchants}
                    onUpdateBucket={updateBucket}
                    onDeleteBucket={deleteBucket}
                    onAddLineItem={addLineItem}
                    onUpdateLineItem={updateLineItem}
                    onDeleteLineItem={deleteLineItem}
                    paymentMethods={paymentMethods}
                  />
                ))}
             </div>

             {/* Empty state for no expense buckets */}
             {expenseBuckets.length === 0 && (
               <div className="text-center py-8 sm:py-12 px-6 sm:px-8 border-2 border-dashed rounded-xl">
                 <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                   <Bitcoin className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                 </div>
                 <h3 className="font-semibold text-base sm:text-lg mb-2">
                   Start building your budget
                 </h3>
                 <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                   Create expense categories to organize your spending. Give every sat a job.
                 </p>
                 <div className="flex flex-col sm:flex-row gap-2 justify-center">
                   {availableCopyMonths.length > 0 && (
                     <Button
                       variant="outline"
                       onClick={() => setShowCopyPrompt(true)}
                     >
                       <Copy className="h-4 w-4 mr-2" />
                       Copy from Previous Month
                     </Button>
                   )}
                   <Button onClick={() => setShowAddBucket(true)}>
                     <Plus className="h-4 w-4 mr-2" />
                     {availableCopyMonths.length > 0 ? 'Start Fresh' : 'Add Your First Category'}
                   </Button>
                 </div>
               </div>
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
                 onAddTransactions={addTransactions}
                 onAssignTransaction={assignTransaction}
                 onDeleteTransaction={deleteTransaction}
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

       {/* Copy Budget Prompt — unified flow for all copy triggers */}
       <CopyMonthPrompt
         open={showCopyPrompt}
         onOpenChange={setShowCopyPrompt}
         currentMonth={currentMonth}
         availableMonths={availableCopyMonths}
         onStartFresh={() => {
           toast({
             title: 'Starting fresh',
             description: 'Your new month is ready.',
           });
         }}
         onCopyPrevious={handleCopyPreviousMonth}
       />

       {/* Wallet Modal - controlled via state */}
       {showWalletModal && (
         <WalletModalControlled
           open={showWalletModal}
           onOpenChange={setShowWalletModal}
         />
       )}

        {/* Quick Add FAB - Bottom right */}
        <QuickAddFAB
          onAddTransaction={addTransaction}
          currency={currency}
        />

        </div>
      </PartnerSyncWrapper>
    );
  }
