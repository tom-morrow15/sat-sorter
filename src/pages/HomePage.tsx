import { useState, useMemo } from 'react';
import { Plus, Bitcoin, Zap, Wallet, Info, Copy } from 'lucide-react';
import { useSeoMeta, useHead } from '@unhead/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BucketCard } from '@/components/budget/BucketCard';
import { AddBucketDialog } from '@/components/budget/AddBucketDialog';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBudget } from '@/hooks/useBudget';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBTCMap } from '@/hooks/useBTCMap';

export default function HomePage() {
  const navigate = useNavigate();
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { toast } = useToast();

  const { user } = useCurrentUser();
  const { hasNWC } = useWallet();
  const { merchants } = useBTCMap();

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

        {/* Main Layout - Budget Categories */}
        <div className="space-y-4">
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
               onAddTransaction={addTransaction}
               onViewTransactions={handleViewTransactions}
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
                <Button onClick={() => setShowAddBucket(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {hasPreviousMonthBudget ? 'Start Fresh' : 'Add Your First Category'}
                </Button>
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
    </div>
  );
}
