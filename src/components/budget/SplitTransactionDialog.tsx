import { useState, useMemo, useEffect } from 'react';
import { Split, Plus, Trash2, ArrowUpRight, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import type { Transaction, Bucket, SplitAllocation } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface SplitTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  buckets: Bucket[];
  currency: 'sats' | 'usd';
  onSplit: (originalTransactionId: string, splits: SplitAllocation[]) => void;
}

interface SplitRow {
  id: string;
  bucketId: string;
  lineItemId: string;
  amount: string;
  description: string;
}

export function SplitTransactionDialog({
  open,
  onOpenChange,
  transaction,
  buckets,
  currency,
  onSplit,
}: SplitTransactionDialogProps) {
  const { data: priceData } = useBitcoinPrice();
  const [splits, setSplits] = useState<SplitRow[]>([]);

  // Get expense buckets only
  const expenseBuckets = useMemo(() => buckets.filter(b => !b.isIncome), [buckets]);

  // Initialize with two empty split rows when dialog opens
  useEffect(() => {
    if (open && transaction) {
      setSplits([
        { id: '1', bucketId: '', lineItemId: '', amount: '', description: '' },
        { id: '2', bucketId: '', lineItemId: '', amount: '', description: '' },
      ]);
    }
  }, [open, transaction]);

  const formatTransactionAmount = (tx: Transaction) => {
    if (currency === 'usd' && tx.usdAmount !== undefined) {
      return formatUsd(tx.usdAmount);
    }
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(tx.amount, priceData.usdPerBtc));
    }
    return `${formatSats(tx.amount)} sats`;
  };

  // Get original amount in the current display currency
  const getOriginalAmount = () => {
    if (!transaction) return 0;
    if (currency === 'usd' && transaction.usdAmount !== undefined) {
      return transaction.usdAmount;
    }
    if (currency === 'usd' && priceData) {
      return satsToUsd(transaction.amount, priceData.usdPerBtc);
    }
    return transaction.amount;
  };

  // Calculate total allocated
  const totalAllocated = useMemo(() => {
    return splits.reduce((sum, split) => {
      const num = parseFloat(split.amount) || 0;
      return sum + num;
    }, 0);
  }, [splits]);

  const originalAmount = getOriginalAmount();
  const remaining = originalAmount - totalAllocated;
  const isBalanced = Math.abs(remaining) < 0.01;

  // Update a split row
  const updateSplit = (id: string, updates: Partial<SplitRow>) => {
    setSplits(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  // Add a new split row
  const addSplit = () => {
    setSplits(prev => [
      ...prev,
      { id: Date.now().toString(), bucketId: '', lineItemId: '', amount: '', description: '' },
    ]);
  };

  // Remove a split row
  const removeSplit = (id: string) => {
    if (splits.length <= 2) return; // Keep at least 2 splits
    setSplits(prev => prev.filter(s => s.id !== id));
  };

  // Auto-fill remaining amount in last empty split
  const autoFillRemaining = () => {
    const lastEmptySplit = [...splits].reverse().find(s => !s.amount);
    if (lastEmptySplit && remaining > 0) {
      updateSplit(lastEmptySplit.id, { 
        amount: currency === 'usd' ? remaining.toFixed(2) : Math.round(remaining).toString() 
      });
    }
  };

  // Validate and submit
  const handleSubmit = () => {
    if (!transaction || !isBalanced) return;

    const validSplits = splits.filter(s => 
      s.bucketId && s.lineItemId && parseFloat(s.amount) > 0
    );

    if (validSplits.length < 2) return;

    const allocations: SplitAllocation[] = validSplits.map(s => {
      const amount = parseFloat(s.amount);
      return {
        bucketId: s.bucketId,
        lineItemId: s.lineItemId,
        amount: currency === 'usd' && priceData 
          ? Math.round(usdToSats(amount, priceData.usdPerBtc))
          : Math.round(amount),
        usdAmount: currency === 'usd' ? amount : undefined,
        description: s.description || undefined,
      };
    });

    onSplit(transaction.id, allocations);
    onOpenChange(false);
  };

  // Check if form is valid
  const isValid = useMemo(() => {
    if (!isBalanced) return false;
    const validSplits = splits.filter(s => 
      s.bucketId && s.lineItemId && parseFloat(s.amount) > 0
    );
    return validSplits.length >= 2;
  }, [isBalanced, splits]);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Split Transaction
          </DialogTitle>
          <DialogDescription>
            Divide this transaction across multiple categories
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Summary */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">{transaction.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(transaction.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <p className="font-bold text-lg">
              {formatTransactionAmount(transaction)}
            </p>
          </div>
        </div>

        {/* Split Rows */}
        <ScrollArea className="flex-1 max-h-[350px] pr-4">
          <div className="space-y-4 py-2">
            {splits.map((split, index) => {
              const selectedBucket = expenseBuckets.find(b => b.id === split.bucketId);
              
              return (
                <div 
                  key={split.id} 
                  className="p-4 border rounded-lg space-y-3 bg-background"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      Split {index + 1}
                    </Badge>
                    {splits.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeSplit(split.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Category */}
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select 
                        value={split.bucketId} 
                        onValueChange={(value) => {
                          updateSplit(split.id, { bucketId: value, lineItemId: '' });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseBuckets.map((bucket) => (
                            <SelectItem key={bucket.id} value={bucket.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: bucket.color }}
                                />
                                {bucket.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Line Item */}
                    <div className="space-y-1">
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={split.lineItemId}
                        onValueChange={(value) => updateSplit(split.id, { lineItemId: value })}
                        disabled={!selectedBucket}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedBucket?.lineItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Amount */}
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Amount ({currency === 'usd' ? 'USD' : 'sats'})
                      </Label>
                      <Input
                        type="number"
                        value={split.amount}
                        onChange={(e) => updateSplit(split.id, { amount: e.target.value })}
                        placeholder="0"
                        className="h-9"
                        min="0"
                        step={currency === 'usd' ? '0.01' : '1'}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <Label className="text-xs">Note (optional)</Label>
                      <Input
                        value={split.description}
                        onChange={(e) => updateSplit(split.id, { description: e.target.value })}
                        placeholder="e.g., Pet food"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Add Split Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={addSplit}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Split
        </Button>

        {/* Balance Summary */}
        <div className={cn(
          "p-3 rounded-lg border-2 transition-colors",
          isBalanced 
            ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
            : remaining < 0 
              ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isBalanced && <AlertCircle className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {isBalanced 
                  ? "✓ Perfectly balanced!" 
                  : remaining > 0 
                    ? "Remaining to allocate"
                    : "Over-allocated"
                }
              </span>
            </div>
            <div className="text-right">
              <p className={cn(
                "font-bold tabular-nums",
                isBalanced ? "text-green-700 dark:text-green-400" : ""
              )}>
                {currency === 'usd' 
                  ? formatUsd(Math.abs(remaining))
                  : `${formatSats(Math.abs(remaining))} sats`
                }
              </p>
              {!isBalanced && remaining > 0 && (
                <button
                  onClick={autoFillRemaining}
                  className="text-xs text-primary hover:underline"
                >
                  Auto-fill remaining
                </button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Split className="h-4 w-4 mr-2" />
            Split Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
