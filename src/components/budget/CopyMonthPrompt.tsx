import { useState } from 'react';
import { Copy, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatMonth } from '@/lib/budgetTypes';
import type { MonthlyBudget } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

export interface AvailableMonth {
  month: string;
  budget: MonthlyBudget;
}

interface CopyMonthPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  availableMonths: AvailableMonth[];
  onStartFresh: () => void;
  onCopyPrevious: (selectedMonth: string) => void;
}

export function CopyMonthPrompt({
  open,
  onOpenChange,
  currentMonth,
  availableMonths,
  onStartFresh,
  onCopyPrevious,
}: CopyMonthPromptProps) {
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string | null>(null);

  const handleStartFresh = () => {
    onStartFresh();
    onOpenChange(false);
    setSelectedSourceMonth(null);
  };

  const handleCopyPrevious = () => {
    const monthToCopy = selectedSourceMonth ?? availableMonths[0]?.month;
    if (monthToCopy) {
      onCopyPrevious(monthToCopy);
    }
    onOpenChange(false);
    setSelectedSourceMonth(null);
  };

  // Single-month mode: show the two-card "start fresh or copy" layout
  if (availableMonths.length <= 1) {
    const onlyMonth = availableMonths[0] ?? null;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Welcome to {formatMonth(currentMonth)}</DialogTitle>
            <DialogDescription>
              Would you like to start fresh or copy your budget from a previous month?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Start Fresh Option */}
            <Card
              className="cursor-pointer transition-all border-2 border-muted hover:border-primary/50"
              onClick={handleStartFresh}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Start from scratch</h3>
                      <Badge variant="secondary" className="text-xs">Recommended</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Begin with a clean budget template. You can customize categories and amounts as you go.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Copy Previous Month Option */}
            {onlyMonth ? (
              <Card
                className="cursor-pointer transition-all border-2 border-muted hover:border-primary/50"
                onClick={handleCopyPrevious}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Copy className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Copy {formatMonth(onlyMonth.month)}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Start with the same categories, line items, and budgeted amounts from {formatMonth(onlyMonth.month)}.
                        All spending will be reset to $0.
                      </p>

                      {/* Preview */}
                      <div className="text-xs text-muted-foreground">
                        {onlyMonth.budget.buckets.length} categories •{' '}
                        {onlyMonth.budget.buckets.reduce((sum, b) => sum + b.lineItems.length, 0)} line items
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No previous month budget available to copy.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Multi-month mode: show a scrollable list of months
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Welcome to {formatMonth(currentMonth)}</DialogTitle>
          <DialogDescription>
            Would you like to start fresh or copy your budget from a previous month?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Start Fresh Option */}
          <Card
            className="cursor-pointer transition-all border-2 border-muted hover:border-primary/50"
            onClick={handleStartFresh}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">Start from scratch</h3>
                    <Badge variant="secondary" className="text-xs">Recommended</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Begin with a clean budget template. You can customize categories and amounts as you go.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available months list */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Or copy from a previous month:</label>
            <ScrollArea className="max-h-[260px]">
              <div className="space-y-2 pr-2">
                {availableMonths.map(({ month, budget }) => {
                  const categoryCount = budget.buckets.length;
                  const lineItemCount = budget.buckets.reduce((sum, b) => sum + b.lineItems.length, 0);
                  const isSelected = selectedSourceMonth === month;

                  return (
                    <button
                      key={month}
                      onClick={() => setSelectedSourceMonth(month)}
                      className={cn(
                        'w-full p-3 rounded-lg border-2 transition-all text-left',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-muted bg-muted/30 hover:bg-muted hover:border-muted-foreground/30'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {formatMonth(month)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {categoryCount} {categoryCount === 1 ? 'category' : 'categories'} •{' '}
                            {lineItemCount} {lineItemCount === 1 ? 'line item' : 'line items'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {isSelected && (
                            <Badge className="text-xs">Selected</Badge>
                          )}
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 transition-colors',
                              isSelected ? 'text-primary' : 'text-muted-foreground/50'
                            )}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Copy button */}
          <Button
            onClick={handleCopyPrevious}
            disabled={!selectedSourceMonth}
            className="w-full"
          >
            <Copy className="h-4 w-4 mr-2" />
            {selectedSourceMonth
              ? `Copy ${formatMonth(selectedSourceMonth)}`
              : 'Select a month to copy'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
