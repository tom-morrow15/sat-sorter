import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
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
import { formatMonth } from '@/lib/budgetTypes';
import type { MonthlyBudget } from '@/lib/budgetTypes';

interface CopyMonthPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  previousMonth: string | null;
  previousBudget: MonthlyBudget | null;
  onStartFresh: () => void;
  onCopyPrevious: () => void;
}

export function CopyMonthPrompt({
  open,
  onOpenChange,
  currentMonth,
  previousMonth,
  previousBudget,
  onStartFresh,
  onCopyPrevious,
}: CopyMonthPromptProps) {
  const [selectedOption, setSelectedOption] = useState<'fresh' | 'copy' | null>(null);

  const handleStartFresh = () => {
    setSelectedOption('fresh');
    onStartFresh();
    onOpenChange(false);
    setSelectedOption(null);
  };

  const handleCopyPrevious = () => {
    setSelectedOption('copy');
    onCopyPrevious();
    onOpenChange(false);
    setSelectedOption(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Welcome to {formatMonth(currentMonth)}</DialogTitle>
          <DialogDescription>
            Would you like to start fresh or copy your budget from last month?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Start Fresh Option */}
          <Card
            className={`cursor-pointer transition-all border-2 ${
              selectedOption === 'fresh' ? 'border-primary' : 'border-muted hover:border-primary/50'
            }`}
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
          {previousMonth && previousBudget && (
            <Card
              className={`cursor-pointer transition-all border-2 ${
                selectedOption === 'copy' ? 'border-primary' : 'border-muted hover:border-primary/50'
              }`}
              onClick={handleCopyPrevious}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Copy className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Copy {formatMonth(previousMonth)}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Start with the same categories, line items, and budgeted amounts from last month.
                      All spending will be reset to $0.
                    </p>
                    
                    {/* Preview */}
                    <div className="text-xs text-muted-foreground">
                      {previousBudget.buckets.length} categories •{' '}
                      {previousBudget.buckets.reduce((sum, b) => sum + b.lineItems.length, 0)} line items
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!previousMonth && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No previous month budget available to copy.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
