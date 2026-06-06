import { useState, useMemo } from 'react';
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SplitRow } from './SplitRow';
import { createSplit, validateSplits, getTotalFromSplits } from '@/lib/splitUtils';
import { useBitcoinPrice, formatUsd, formatSats } from '@/hooks/useBitcoinPrice';
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
  const [unit, setUnit] = useState<'usd' | 'sats'>('usd');
  const [splits, setSplits] = useState<TransactionSplit[]>(
    transaction.splits ?? [
      createSplit(
        transaction.bucketId ?? buckets[0]?.id ?? '',
        buckets[0]?.lineItems[0]?.id ?? '',
        transaction.amountUsd ?? 0,
        transaction.amount
      ),
    ]
  );

  // Calculate totals
  const totalUsd = transaction.amountUsd ?? 0;
  const totalSats = transaction.amount;
  const splitsTotalUsd = getTotalFromSplits(splits);
  const splitsValidation = validateSplits(totalUsd, splits);

  // Calculate remaining amount to allocate
  const remainingUsd = totalUsd - splitsTotalUsd;
  const remainingSats = remainingUsd > 0 && priceData 
    ? Math.round((remainingUsd / priceData.usdPerBtc) * 100_000_000)
    : 0;

  const hasAllocation = Math.abs(remainingUsd) < 0.01; // Allow tiny rounding differences

  const handleAddSplit = () => {
    // Create a new split with the remaining amount
    const newSplit = createSplit(
      buckets[0]?.id ?? '',
      buckets[0]?.lineItems[0]?.id ?? '',
      Math.max(0, remainingUsd),
      Math.max(0, remainingSats)
    );
    setSplits([...splits, newSplit]);
  };

  const handleUpdateSplit = (index: number, updatedSplit: TransactionSplit) => {
    const newSplits = [...splits];
    newSplits[index] = updatedSplit;
    setSplits(newSplits);
  };

  const handleDeleteSplit = (index: number) => {
    if (splits.length <= 1) {
      // Don't allow deleting the last split
      return;
    }
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!splitsValidation.isValid) {
      return;
    }
    onSave(splits);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Split Transaction
          </DialogTitle>
          <DialogDescription>
            Divide this transaction across multiple categories and line items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transaction total display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transaction Total</p>
                <p className="text-2xl font-bold">
                  {formatUsd(totalUsd)}
                  <span className="text-sm text-muted-foreground ml-2">({formatSats(totalSats)})</span>
                </p>
              </div>
            </div>
          </div>

          {/* Unit toggle */}
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Show amounts in:</p>
            <div className="inline-flex rounded-md border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setUnit('usd')}
                className={cn(
                  'px-3 py-1 rounded-sm transition-colors',
                  unit === 'usd' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setUnit('sats')}
                className={cn(
                  'px-3 py-1 rounded-sm transition-colors',
                  unit === 'sats' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                Sats
              </button>
            </div>
          </div>

          <Separator />

          {/* Splits list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Allocate Amount</h3>
              <Badge variant="secondary" className="text-xs">
                {splits.length} split{splits.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {splits.map((split, index) => (
              <SplitRow
                key={split.id}
                split={split}
                buckets={buckets}
                unit={unit}
                onUpdate={(updated) => handleUpdateSplit(index, updated)}
                onDelete={() => handleDeleteSplit(index)}
              />
            ))}

            {/* Add split button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddSplit}
              disabled={!hasAllocation}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Split
            </Button>
          </div>

          <Separator />

          {/* Remaining / validation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Remaining to allocate:</span>
              <span className="text-sm">
                {formatUsd(remainingUsd)}
                <span className="text-xs text-muted-foreground ml-2">({formatSats(remainingSats)})</span>
              </span>
            </div>

            {splitsValidation.isValid ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  ✓ Splits allocated correctly!
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {splitsValidation.message}
                </span>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              <strong>💡 Tip:</strong> All split amounts must add up to the transaction total. The "Add Split" button will enable once you've allocated everything.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!splitsValidation.isValid}
          >
            Save Splits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
