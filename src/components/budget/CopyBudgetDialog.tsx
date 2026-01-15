import { useState } from 'react';
import { Copy, Calendar, Check, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatMonth, type MonthlyBudget } from '@/lib/budgetTypes';
import { formatSats } from '@/hooks/useBitcoinPrice';
import { cn } from '@/lib/utils';

interface CopyBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  availableMonths: string[];
  budgets: MonthlyBudget[];
  onCopyFromMonth: (sourceMonth: string) => boolean;
}

export function CopyBudgetDialog({
  open,
  onOpenChange,
  currentMonth,
  availableMonths,
  budgets,
  onCopyFromMonth,
}: CopyBudgetDialogProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Filter to only months that have budgets (excluding current)
  const monthsWithBudgets = availableMonths
    .filter(m => m !== currentMonth && budgets.some(b => b.month === m))
    .sort((a, b) => b.localeCompare(a)); // Most recent first

  const handleCopy = async () => {
    if (!selectedMonth) return;

    setIsCopying(true);

    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));

    const success = onCopyFromMonth(selectedMonth);

    if (success) {
      setCopySuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setCopySuccess(false);
        setSelectedMonth(null);
      }, 1000);
    }

    setIsCopying(false);
  };

  const getBudgetSummary = (month: string) => {
    const budget = budgets.find(b => b.month === month);
    if (!budget) return null;

    const totalIncome = budget.buckets
      .filter(b => b.isIncome)
      .reduce((sum, bucket) =>
        sum + bucket.lineItems.reduce((s, li) => s + li.plannedAmount, 0), 0);

    const totalBudgeted = budget.buckets
      .filter(b => !b.isIncome)
      .reduce((sum, bucket) =>
        sum + bucket.lineItems.reduce((s, li) => s + li.plannedAmount, 0), 0);

    const categoryCount = budget.buckets.filter(b => !b.isIncome).length;

    return { totalIncome, totalBudgeted, categoryCount };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Copy Budget to {formatMonth(currentMonth)}
          </DialogTitle>
          <DialogDescription>
            Copy your budget categories and planned amounts from a previous month.
            Transactions won't be copied.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {monthsWithBudgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm">No previous budgets found.</p>
              <p className="text-xs mt-1">Create your first budget to get started!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Select a month to copy from:
              </p>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {monthsWithBudgets.map((month) => {
                    const summary = getBudgetSummary(month);
                    const isSelected = selectedMonth === month;

                    return (
                      <button
                        key={month}
                        onClick={() => setSelectedMonth(month)}
                        className={cn(
                          'w-full p-3 text-left rounded-lg border-2 transition-all',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatMonth(month)}</span>
                          </div>
                          {isSelected && (
                            <Badge className="bg-primary text-primary-foreground">
                              Selected
                            </Badge>
                          )}
                        </div>
                        {summary && (
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            <span>{summary.categoryCount} categories</span>
                            <span>•</span>
                            <span>{formatSats(summary.totalIncome)} income</span>
                            <span>•</span>
                            <span>{formatSats(summary.totalBudgeted)} budgeted</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Copy preview */}
              {selectedMonth && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{formatMonth(selectedMonth)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-primary">{formatMonth(currentMonth)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categories and planned amounts will be copied. Your new budget will start fresh with no transactions.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!selectedMonth || isCopying || copySuccess}
          >
            {isCopying ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : copySuccess ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copySuccess ? 'Copied!' : 'Copy Budget'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
