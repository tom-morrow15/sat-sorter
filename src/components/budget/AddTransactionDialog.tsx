import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import type { Bucket } from '@/lib/budgetTypes';

interface SplitItem {
  id: string;
  bucketId: string;
  lineItemId: string;
  amountSats: number; // Always stored in sats internally
  description: string;
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: Bucket[];
  defaultBucketId?: string;
  currency: 'sats' | 'usd';
  isIncome: boolean;
  onSave: (transactions: {
    date: string;
    description: string;
    amount: number;
    isIncome: boolean;
    bucketId: string | null;
    lineItemId: string | null;
  }[]) => void;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  buckets,
  defaultBucketId,
  currency,
  isIncome,
  onSave,
}: AddTransactionDialogProps) {
  const { data: priceData } = useBitcoinPrice();
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState(defaultBucketId || '');
  const [selectedLineItemId, setSelectedLineItemId] = useState('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitItem[]>([]);

  const filteredBuckets = buckets.filter(b => b.isIncome === isIncome);

  // Convert user input to sats (all internal math is in sats)
  const totalSats = useMemo(() => {
    const num = parseFloat(amountInput) || 0;
    if (currency === 'usd' && priceData) {
      return Math.round(usdToSats(num, priceData.usdPerBtc));
    }
    return Math.round(num);
  }, [amountInput, currency, priceData]);

  const getLineItems = (bucketId: string) => {
    const bucket = buckets.find(b => b.id === bucketId);
    return bucket?.lineItems || [];
  };

  // Format sats for display in user's preferred currency
  const displayAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return `$${satsToUsd(sats, priceData.usdPerBtc).toFixed(2)}`;
    }
    return `${formatSats(sats)} sats`;
  };

  // Convert sats back to user's currency for input fields
  const satsToInputValue = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return satsToUsd(sats, priceData.usdPerBtc).toFixed(2);
    }
    return sats.toString();
  };

  // Convert user input value to sats
  const inputValueToSats = (value: string): number => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      return Math.round(usdToSats(num, priceData.usdPerBtc));
    }
    return Math.round(num);
  };

  const handleBucketChange = (bucketId: string) => {
    setSelectedBucketId(bucketId);
    setSelectedLineItemId('');
  };

  const addSplit = () => {
    if (totalSats <= 0) return;

    const allocated = splits.reduce((sum, s) => sum + s.amountSats, 0);
    const remaining = totalSats - allocated;
    
    const newSplit: SplitItem = {
      id: Date.now().toString(),
      bucketId: selectedBucketId || filteredBuckets[0]?.id || '',
      lineItemId: '',
      amountSats: remaining > 0 ? remaining : 0,
      description: splits.length === 0 ? description.trim() : `${description.trim()} (part ${splits.length + 1})`,
    };
    setSplits([...splits, newSplit]);
  };

  const updateSplit = (id: string, updates: Partial<SplitItem>) => {
    setSplits(splits.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateSplitAmount = (id: string, inputValue: string) => {
    const sats = inputValueToSats(inputValue);
    updateSplit(id, { amountSats: Math.max(0, sats) });
  };

  const removeSplit = (id: string) => {
    setSplits(splits.filter(s => s.id !== id));
  };

  const allocatedSats = useMemo(() => {
    return splits.reduce((sum, s) => sum + s.amountSats, 0);
  }, [splits]);

  const remainingSats = totalSats - allocatedSats;

  const handleSave = () => {
    if (!description.trim() || totalSats <= 0) return;

    if (isSplitMode && splits.length > 0) {
      const transactions = splits
        .filter(s => s.lineItemId && s.amountSats > 0)
        .map(s => ({
          date: new Date().toISOString().split('T')[0],
          description: s.description || description.trim(),
          amount: s.amountSats,
          isIncome,
          bucketId: s.bucketId,
          lineItemId: s.lineItemId,
        }));
      if (transactions.length > 0) onSave(transactions);
    } else if (selectedLineItemId) {
      onSave([{
        date: new Date().toISOString().split('T')[0],
        description: description.trim(),
        amount: totalSats,
        isIncome,
        bucketId: selectedBucketId,
        lineItemId: selectedLineItemId,
      }]);
    }

    // Reset form
    setDescription('');
    setAmountInput('');
    setSelectedBucketId(defaultBucketId || '');
    setSelectedLineItemId('');
    setSplits([]);
    setIsSplitMode(false);
    onOpenChange(false);
  };

  const canSave = () => {
    if (!description.trim() || totalSats <= 0) return false;

    if (isSplitMode) {
      return splits.length > 0 && 
             splits.every(s => s.lineItemId && s.amountSats > 0) &&
             remainingSats === 0;
    }
    return selectedLineItemId !== '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isIncome ? 'Add Income' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            {isSplitMode 
              ? 'Split this transaction across multiple categories'
              : `Add a new ${isIncome ? 'income' : 'expense'} transaction`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., Grocery store, Salary payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          {/* Total Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Total Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
            <Input
              id="amount"
              type="number"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              step={currency === 'usd' ? '0.01' : '1'}
              min="0"
            />
          </div>

          {/* Toggle Split Mode */}
          <div className="flex items-center justify-between">
            <Label>Split Transaction</Label>
            <Button
              variant={isSplitMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (!isSplitMode && totalSats > 0) {
                  // Initialize first split when enabling split mode
                  const newSplit: SplitItem = {
                    id: Date.now().toString(),
                    bucketId: selectedBucketId || filteredBuckets[0]?.id || '',
                    lineItemId: '',
                    amountSats: totalSats,
                    description: description.trim(),
                  };
                  setSplits([newSplit]);
                }
                setIsSplitMode(!isSplitMode);
                if (isSplitMode) {
                  setSplits([]);
                }
              }}
            >
              {isSplitMode ? 'Single Transaction' : 'Split'}
            </Button>
          </div>

          {!isSplitMode ? (
            /* Single Transaction Mode */
            <div className="space-y-4 p-4 border rounded-lg">
              {/* Bucket Selection */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedBucketId} onValueChange={handleBucketChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBuckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Line Item Selection */}
              {selectedBucketId && (
                <div className="space-y-2">
                  <Label>Line Item</Label>
                  <Select value={selectedLineItemId} onValueChange={setSelectedLineItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a line item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getLineItems(selectedBucketId).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            /* Split Mode */
            <div className="space-y-4">
              {/* Total & Allocated Summary */}
              {totalSats > 0 && (
                <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{displayAmount(totalSats)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated:</span>
                    <span className="font-medium">{displayAmount(allocatedSats)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className={remainingSats === 0 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                      {displayAmount(Math.abs(remainingSats))}
                      {remainingSats > 0 && ' unallocated'}
                      {remainingSats < 0 && ' overallocated'}
                      {remainingSats === 0 && ' ✓'}
                    </span>
                  </div>
                </div>
              )}

              {splits.map((split, index) => (
                <div key={split.id} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Part {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeSplit(split.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <Input
                    placeholder="Description for this part"
                    value={split.description}
                    onChange={(e) => updateSplit(split.id, { description: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={split.bucketId}
                      onValueChange={(val) => updateSplit(split.id, { bucketId: val, lineItemId: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredBuckets.map((bucket) => (
                          <SelectItem key={bucket.id} value={bucket.id}>
                            {bucket.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={split.lineItemId}
                      onValueChange={(val) => updateSplit(split.id, { lineItemId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Line item" />
                      </SelectTrigger>
                      <SelectContent>
                        {getLineItems(split.bucketId).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
                    <Input
                      type="number"
                      value={satsToInputValue(split.amountSats)}
                      onChange={(e) => updateSplitAmount(split.id, e.target.value)}
                      step={currency === 'usd' ? '0.01' : '1'}
                      min="0"
                    />
                  </div>
                </div>
              ))}

              {/* Add Another Split */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addSplit}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Part
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave()}>
            {isSplitMode ? 'Save Split Transaction' : 'Save Transaction'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
