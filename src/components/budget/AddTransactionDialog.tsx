import { useState } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
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
  amount: number;
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
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState(defaultBucketId || '');
  const [selectedLineItemId, setSelectedLineItemId] = useState('');
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitItem[]>([]);

  const filteredBuckets = buckets.filter(b => b.isIncome === isIncome);

  const getLineItems = (bucketId: string) => {
    const bucket = buckets.find(b => b.id === bucketId);
    return bucket?.lineItems || [];
  };

  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  const parseAmountToSats = (value: string): number => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      return Math.round(usdToSats(num, priceData.usdPerBtc));
    }
    return Math.round(num);
  };

  const handleBucketChange = (bucketId: string) => {
    setSelectedBucketId(bucketId);
    setSelectedLineItemId('');
    // Update splits that don't have valid bucket/lineItem anymore
    if (isSplitMode) {
      setSplits(splits.filter(s => {
        const bucket = buckets.find(b => b.id === s.bucketId);
        return bucket && bucket.lineItems.some(li => li.id === s.lineItemId);
      }));
    }
  };

  const addSplit = () => {
    if (!totalAmount) return;
    
    const totalSats = parseAmountToSats(totalAmount);
    const remaining = totalSats - splits.reduce((sum, s) => sum + s.amount, 0);
    
    const newSplit: SplitItem = {
      id: Date.now().toString(),
      bucketId: selectedBucketId || filteredBuckets[0]?.id || '',
      lineItemId: '',
      amount: remaining > 0 ? remaining : 0,
      description: splits.length === 0 ? description : `${description} (part ${splits.length + 1})`,
    };
    setSplits([...splits, newSplit]);
  };

  const updateSplit = (id: string, updates: Partial<SplitItem>) => {
    setSplits(splits.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSplit = (id: string) => {
    setSplits(splits.filter(s => s.id !== id));
  };

  const getRemainingAmount = () => {
    const totalSats = parseAmountToSats(totalAmount);
    const used = splits.reduce((sum, s) => sum + s.amount, 0);
    return totalSats - used;
  };

  const handleSave = () => {
    const totalSats = parseAmountToSats(totalAmount);
    if (!description.trim() || totalSats <= 0) return;

    if (isSplitMode && splits.length > 0) {
      // Save split transactions
      const transactions = splits
        .filter(s => s.lineItemId && s.amount > 0)
        .map(s => ({
          date: new Date().toISOString().split('T')[0],
          description: s.description,
          amount: s.amount,
          isIncome,
          bucketId: s.bucketId,
          lineItemId: s.lineItemId,
        }));
      onSave(transactions);
    } else if (selectedLineItemId) {
      // Save single transaction
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
    setTotalAmount('');
    setSelectedLineItemId('');
    setSplits([]);
    setIsSplitMode(false);
    onOpenChange(false);
  };

  const canSave = () => {
    const totalSats = parseAmountToSats(totalAmount);
    if (!description.trim() || totalSats <= 0) return false;

    if (isSplitMode) {
      return splits.length > 0 && 
             splits.every(s => s.lineItemId && s.amount > 0) &&
             getRemainingAmount() === 0;
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
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
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
                if (!isSplitMode && totalAmount) {
                  // Initialize first split when enabling split mode
                  const totalSats = parseAmountToSats(totalAmount);
                  const newSplit: SplitItem = {
                    id: Date.now().toString(),
                    bucketId: selectedBucketId || filteredBuckets[0]?.id || '',
                    lineItemId: '',
                    amount: totalSats,
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
                <Label>Category (Bucket)</Label>
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
              {splits.map((split, index) => (
                <div key={split.id} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label>Part {index + 1}</Label>
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

                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Amount:</Label>
                    <Input
                      type="number"
                      className="w-32"
                      value={split.amount}
                      onChange={(e) => updateSplit(split.id, { amount: parseFloat(e.target.value) || 0 })}
                      step="1"
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
                disabled={getRemainingAmount() <= 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Part
              </Button>

              {/* Remaining Amount Display */}
              {totalAmount && (
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg text-sm">
                  <span className="text-muted-foreground">Remaining to Allocate:</span>
                  <span className={getRemainingAmount() === 0 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                    {formatAmount(Math.abs(getRemainingAmount()))}
                    {getRemainingAmount() !== 0 && ` ${getRemainingAmount() > 0 ? 'unallocated' : 'overallocated'}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave()}>
            Save Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
