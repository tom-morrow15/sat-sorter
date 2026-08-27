import { useState } from 'react';
import { Plus, CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SplitRow } from './SplitRow';
import { createSplit, getTotalFromSplits } from '@/lib/splitUtils';
import { useBitcoinPrice, formatUsd, formatSats, satsToUsd } from '@/hooks/useBitcoinPrice';
import type { Transaction, TransactionSplit, Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface SplitEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  buckets: Bucket[];
  onSave: (splits: TransactionSplit[]) => void;
}

export function SplitEditor({
  open,
  onOpenChange,
  transaction,
  buckets,
  onSave,
}: SplitEditorProps) {
  const { data: priceData } = useBitcoinPrice();
  const [splits, setSplits] = useState<TransactionSplit[]>([]);

  // Calculate the total USD amount for this transaction.
  // If amountUsd is already set (e.g., manually entered in USD mode), use it.
  // Otherwise, convert from sats using the current BTC price.
  // This fixes the issue where NWC-imported transactions had no amountUsd
  // and the split editor showed $0.00 as the total.
  const totalUsd = transaction.amountUsd
    ?? (priceData ? satsToUsd(transaction.amount, priceData.usdPerBtc) : 0);
  const splitsTotalUsd = getTotalFromSplits(splits);
  const remainingUsd = totalUsd - splitsTotalUsd;
  const remainingSats = remainingUsd > 0 && priceData 
    ? Math.round((remainingUsd / priceData.usdPerBtc) * 100_000_000)
    : 0;

  const isComplete = Math.abs(remainingUsd) < 0.01;

  const handleAddSplit = () => {
    // Start empty — user chooses category/line item and amount.
    const newSplit = createSplit('', '', 0, 0);
    setSplits([...splits, newSplit]);
  };

  const handleUpdateSplit = (index: number, updatedSplit: TransactionSplit) => {
    const newSplits = [...splits];
    newSplits[index] = updatedSplit;
    setSplits(newSplits);
  };

  const handleDeleteSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!isComplete) return;
    onSave(splits);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div>
            <DialogTitle>Split Transaction</DialogTitle>
            <DialogDescription>
              Divide this transaction across multiple budget categories
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable body — keeps action buttons reachable even with many splits */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 min-h-0">
          {/* Total Amount - Clean and prominent at the top */}
          <div className="text-center p-6 bg-muted rounded-2xl">
            <p className="text-xs text-muted-foreground mb-1">TOTAL AMOUNT</p>
            <p className="text-4xl font-bold tabular-nums tracking-tight">
              {formatUsd(totalUsd)}
            </p>
          </div>

          {/* Splits Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Split Into</h3>
              <span className="text-xs text-muted-foreground">{splits.length} split{splits.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-3">
              {splits.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl">
                  Tap below to add your first split
                </div>
              )}

              {splits.map((split, index) => (
                <SplitRow
                  key={split.id}
                  split={split}
                  buckets={buckets}
                  onUpdate={(updated) => handleUpdateSplit(index, updated)}
                  onDelete={() => handleDeleteSplit(index)}
                />
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={handleAddSplit}
              disabled={isComplete}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Split
            </Button>
          </div>

          {/* Remaining Balance - Always at the bottom */}
          <div className="p-4 bg-muted rounded-2xl flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Remaining to allocate</span>
            <span className={cn(
              "font-semibold tabular-nums text-lg",
              isComplete ? "text-green-600" : "text-foreground"
            )}>
              {formatUsd(remainingUsd)}
            </span>
          </div>

          {/* Validation */}
          {isComplete ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Ready to split
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Add splits until remaining is $0.00
            </div>
          )}
        </div>

        {/* Sticky footer — always visible, never scrolls out of reach */}
        <div className="shrink-0 border-t bg-background px-6 py-4">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!isComplete} 
              className="flex-1"
            >
              Confirm Split
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
