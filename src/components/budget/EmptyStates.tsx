import {
  Bitcoin,
  Plus,
  Wallet,
  Target,
  ArrowDownLeft,
  ArrowUpRight,
  Link2,
  Copy,
  Sparkles,
  PiggyBank,
  TrendingUp,
  ChevronRight,
  Zap,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  className?: string;
}

// Empty state for when there are no expense categories
export function EmptyBudgetCategories({
  onAddCategory,
  onCopyFromLastMonth,
  hasPreviousMonthBudget,
  className,
}: EmptyStateProps & {
  onAddCategory: () => void;
  onCopyFromLastMonth?: () => void;
  hasPreviousMonthBudget?: boolean;
}) {
  return (
    <div className={cn('text-center py-8 sm:py-12 px-6 sm:px-8 border-2 border-dashed rounded-xl', className)}>
      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center mx-auto mb-5">
        <Target className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
      </div>
      
      <h3 className="font-semibold text-lg sm:text-xl mb-2">
        Create Your First Budget Category
      </h3>
      
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
        Categories help you organize your spending. Create buckets like <strong>Housing</strong>, <strong>Food</strong>, 
        or <strong>Entertainment</strong> and give every sat a job.
      </p>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {hasPreviousMonthBudget && onCopyFromLastMonth && (
            <Button variant="outline" onClick={onCopyFromLastMonth}>
              <Copy className="h-4 w-4 mr-2" />
              Copy from Last Month
            </Button>
          )}
          <Button onClick={onAddCategory}>
            <Plus className="h-4 w-4 mr-2" />
            {hasPreviousMonthBudget ? 'Start Fresh' : 'Add Your First Category'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <SuggestionChip icon={PiggyBank} text="Savings" />
          <SuggestionChip icon={Bitcoin} text="Housing" />
          <SuggestionChip icon={TrendingUp} text="Investments" />
        </div>
      </div>
    </div>
  );
}

// Empty state for the transactions panel (no transactions yet)
export function EmptyTransactions({
  onConnectWallet,
  onAddManually,
  className,
}: EmptyStateProps & {
  onConnectWallet: () => void;
  onAddManually: () => void;
}) {
  return (
    <div className={cn('text-center py-8', className)}>
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
        <Link2 className="h-7 w-7 text-blue-500" />
      </div>
      
      <h4 className="font-semibold text-base mb-1.5">
        No Transactions Yet
      </h4>
      
      <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
        Import transactions from your Lightning wallet or add them manually to start tracking your spending.
      </p>

      <div className="flex flex-col gap-2 px-4">
        <Button onClick={onConnectWallet}>
          <Zap className="h-4 w-4 mr-2" />
          Connect Lightning Wallet
        </Button>
        <Button variant="outline" onClick={onAddManually}>
          <Plus className="h-4 w-4 mr-2" />
          Add Manually
        </Button>
      </div>

      <div className="mt-6 p-3 bg-muted/50 rounded-lg mx-4">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> NWC-compatible wallets like Alby, Primal, or Mutiny 
          can auto-import your transactions.
        </p>
      </div>
    </div>
  );
}

// Empty state for income bucket (no income set)
export function EmptyIncome({
  onSetIncome,
  className,
}: EmptyStateProps & {
  onSetIncome: () => void;
}) {
  return (
    <Card className={cn('border-dashed border-2 border-green-300 dark:border-green-800', className)}>
      <CardContent className="py-6 px-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <ArrowDownLeft className="h-6 w-6 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold mb-1">Start with Your Income</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Enter how many sats you expect to earn this month. This is the foundation of your budget.
            </p>
            <Button size="sm" variant="outline" onClick={onSetIncome}>
              <Wallet className="h-4 w-4 mr-2" />
              Set Monthly Income
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state for dashboard (no spending data)
export function EmptyDashboard({ className }: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="py-8 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
          <ListChecks className="h-6 w-6 text-muted-foreground" />
        </div>
        <h4 className="font-semibold mb-1">Spending Breakdown</h4>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Once you start recording transactions, you'll see a visual breakdown of where your sats are going.
        </p>
      </CardContent>
    </Card>
  );
}

// First-time budget setup prompt
export function FirstTimeBudgetPrompt({
  onStartTour,
  onDismiss,
  className,
}: EmptyStateProps & {
  onStartTour: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className={cn('bg-gradient-to-br from-primary/5 to-orange-500/5 border-primary/20', className)}>
      <CardContent className="py-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">New to Zero-Based Budgeting?</h3>
            <p className="text-sm text-muted-foreground">
              Take a quick tour to learn how to give every sat a job and take control of your finances.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Skip
            </Button>
            <Button size="sm" onClick={onStartTour}>
              Take the Tour
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component
function SuggestionChip({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 rounded-full text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </div>
  );
}

// Zero budget state (income = expenses, perfect balance)
export function ZeroBudgetAchieved({ className }: EmptyStateProps) {
  return (
    <div className={cn('p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800', className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h4 className="font-semibold text-green-800 dark:text-green-200">
            🎉 Perfect Balance!
          </h4>
          <p className="text-sm text-green-700 dark:text-green-300">
            Every sat has a job. You're ready to start tracking your spending.
          </p>
        </div>
      </div>
    </div>
  );
}
