import { useState, useMemo } from 'react';
import { Copy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatMonth } from '@/lib/budgetTypes';
import type { MonthlyBudget } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface CopyBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  availableMonths: string[];
  budgets: MonthlyBudget[];
  onCopy: (sourceMonth: string) => void;
}

export function CopyBudgetDialog({
  open,
  onOpenChange,
  currentMonth,
  availableMonths,
  budgets,
  onCopy,
}: CopyBudgetDialogProps) {
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get months that have budgets, excluding current month
  const availableSourceMonths = useMemo(() => {
    return availableMonths
      .filter(month => month !== currentMonth && budgets.some(b => b.month === month))
      .sort()
      .reverse(); // Most recent first
  }, [availableMonths, currentMonth, budgets]);

  const selectedBudget = useMemo(() => {
    return budgets.find(b => b.month === selectedSourceMonth);
  }, [budgets, selectedSourceMonth]);

  const handleCopy = () => {
    if (selectedSourceMonth) {
      onCopy(selectedSourceMonth);
      onOpenChange(false);
      setSelectedSourceMonth(null);
      setShowConfirmation(false);
    }
  };

  const handleCopyClick = () => {
    if (selectedSourceMonth) {
      setShowConfirmation(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy Previous Budget
          </DialogTitle>
          <DialogDescription>
            Quick-start {currentMonth} by copying a budget structure from a previous month
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Confirmation step */}
          {showConfirmation && selectedBudget && (
            <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      ✓ Copy {selectedBudget.buckets.length} categories from {formatMonth(selectedSourceMonth!)}?
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                      This will copy:
                    </p>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 list-disc list-inside mt-1 ml-1">
                      <li>{selectedBudget.buckets.length} categories</li>
                      <li>
                        {selectedBudget.buckets.reduce((sum, b) => sum + b.lineItems.length, 0)} line items
                      </li>
                      <li>Category structure and allocation amounts</li>
                    </ul>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 font-medium">
                      Transactions will NOT be copied. Click "Copy Budget" to confirm.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Month selection - hidden during confirmation */}
          {!showConfirmation && (
            <>
              {availableSourceMonths.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No previous budgets available</p>
                  <p className="text-xs mt-1">Create a budget first to copy from it</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select a budget to copy:</label>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2 pr-4">
                      {availableSourceMonths.map((month) => {
                        const budget = budgets.find(b => b.month === month);
                        if (!budget) return null;

                        const categoryCount = budget.buckets.length;
                        const lineItemCount = budget.buckets.reduce((sum, b) => sum + b.lineItems.length, 0);

                        return (
                          <button
                            key={month}
                            onClick={() => setSelectedSourceMonth(month)}
                            className={cn(
                              'w-full p-3 rounded-lg border-2 transition-colors text-left',
                              selectedSourceMonth === month
                                ? 'border-primary bg-primary/5'
                                : 'border-muted bg-muted/50 hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {formatMonth(month)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {categoryCount} categories • {lineItemCount} line items
                                </p>
                              </div>
                              {selectedSourceMonth === month && (
                                <Badge className="shrink-0">Selected</Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Preview of selected budget */}
              {selectedBudget && !showConfirmation && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <h4 className="text-sm font-medium mb-2">Budget Preview</h4>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {selectedBudget.buckets.map((bucket) => (
                        <div key={bucket.id} className="text-xs">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: bucket.color }}
                            />
                            {bucket.name} ({bucket.lineItems.length})
                          </p>
                          <div className="ml-4 text-muted-foreground space-y-0.5">
                            {bucket.lineItems.map((item) => (
                              <p key={item.id} className="text-xs">
                                • {item.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info box */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  <strong>💡 Tip:</strong> Copying preserves your category structure and planned amounts,
                  but starts fresh with no transactions. Perfect for recurring budgets!
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {showConfirmation ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCopy}>
                Copy Budget
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={handleCopyClick}
                disabled={!selectedSourceMonth || availableSourceMonths.length === 0}
              >
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
