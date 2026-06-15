import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { TransactionSplit, Bucket } from '@/lib/budgetTypes';
import { useBitcoinPrice, usdToSats, formatSats, satsToUsd } from '@/hooks/useBitcoinPrice';

interface SplitRowProps {
  split: TransactionSplit;
  buckets: Bucket[];
  onUpdate: (updatedSplit: TransactionSplit) => void;
  onDelete: () => void;
}

export function SplitRow({
  split,
  buckets,
  onUpdate,
  onDelete,
}: SplitRowProps) {
  const { data: priceData } = useBitcoinPrice();
  const [selectedBucketId, setSelectedBucketId] = useState(split.bucketId);
  const [selectedLineItemId, setSelectedLineItemId] = useState(split.lineItemId);
  
  // Use the global currency setting (assume 'usd' for simplicity in this component, 
  // or pass the global currency as a prop if needed)
  const unit = 'usd'; 
  const [amountInput, setAmountInput] = useState(
    (split.amountUsd ?? 0).toString()
  );

  const selectedBucket = buckets.find((b) => b.id === selectedBucketId);
  const lineItems = selectedBucket?.lineItems ?? [];

  const handleBucketChange = (bucketId: string) => {
    setSelectedBucketId(bucketId);
    setSelectedLineItemId('');
  };

  const handleLineItemChange = (lineItemId: string) => {
    setSelectedLineItemId(lineItemId);
  };

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    // Live update so the parent can immediately recalc "Remaining to allocate"
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && selectedBucketId && selectedLineItemId) {
      const amountSats = priceData ? usdToSats(num, priceData.usdPerBtc) : 0;
      onUpdate({
        ...split,
        bucketId: selectedBucketId,
        lineItemId: selectedLineItemId,
        amount: amountSats,
        amountUsd: num,
      });
    }
  };

  // Auto-clear leading zero when user focuses an amount that starts at 0
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amountInput === '0' || amountInput === '0.00') {
      e.target.select();
    }
  };

  return (
    <div className="p-4 border rounded-xl bg-muted/50 space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-xs font-medium">Category</Label>
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-6 w-6">
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      <Select value={selectedBucketId} onValueChange={handleBucketChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {buckets.map((bucket) => (
            <SelectItem key={bucket.id} value={bucket.id}>
              {bucket.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="text-xs font-medium">Line Item</Label>
      <Select value={selectedLineItemId} onValueChange={handleLineItemChange} disabled={!selectedBucketId}>
        <SelectTrigger>
          <SelectValue placeholder="Select line item" />
        </SelectTrigger>
        <SelectContent>
          {lineItems.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Label className="text-xs font-medium">Amount (USD)</Label>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={amountInput}
        onChange={(e) => handleAmountChange(e.target.value)}
        onFocus={handleAmountFocus}
        placeholder="0.00"
      />
    </div>
  );
}
