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
  unit: 'usd' | 'sats';
  onUpdate: (updatedSplit: TransactionSplit) => void;
  onDelete: () => void;
}

export function SplitRow({
  split,
  buckets,
  unit,
  onUpdate,
  onDelete,
}: SplitRowProps) {
  const { data: priceData } = useBitcoinPrice();
  const [selectedBucketId, setSelectedBucketId] = useState(split.bucketId);
  const [selectedLineItemId, setSelectedLineItemId] = useState(split.lineItemId);
  const [amountInput, setAmountInput] = useState(
    unit === 'usd' ? (split.amountUsd ?? 0).toString() : formatSats(split.amount)
  );

  const selectedBucket = buckets.find((b) => b.id === selectedBucketId);
  const lineItems = selectedBucket?.lineItems ?? [];

  const handleBucketChange = (bucketId: string) => {
    setSelectedBucketId(bucketId);
    // Reset line item selection when bucket changes
    setSelectedLineItemId('');
  };

  const handleLineItemChange = (lineItemId: string) => {
    setSelectedLineItemId(lineItemId);
  };

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
  };

  const handleSave = () => {
    if (!selectedBucketId || !selectedLineItemId || !amountInput.trim()) return;

    const num = parseFloat(amountInput);
    if (num <= 0) return;

    let amountSats = 0;
    let amountUsd = 0;

    if (unit === 'usd') {
      amountUsd = num;
      amountSats = priceData ? usdToSats(num, priceData.usdPerBtc) : 0;
    } else {
      amountSats = Math.round(num);
      amountUsd = priceData ? satsToUsd(amountSats, priceData.usdPerBtc) : 0;
    }

    onUpdate({
      ...split,
      bucketId: selectedBucketId,
      lineItemId: selectedLineItemId,
      amount: amountSats,
      amountUsd,
    });
  };

  const displayAmount = unit === 'usd' ? split.amountUsd ?? 0 : split.amount;
  const conversionLabel = unit === 'usd' 
    ? `≈ ${formatSats(split.amount)} sats`
    : priceData ? `≈ $${(split.amount / 100_000_000 * priceData.usdPerBtc).toFixed(2)}` : '';

  return (
    <div className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-muted/50">
      {/* Bucket select */}
      <div className="col-span-3">
        <Label className="text-xs">Category</Label>
        <Select value={selectedBucketId} onValueChange={handleBucketChange}>
          <SelectTrigger className="h-9">
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
      </div>

      {/* Line item select */}
      <div className="col-span-3">
        <Label className="text-xs">Line Item</Label>
        <Select value={selectedLineItemId} onValueChange={handleLineItemChange} disabled={!selectedBucketId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {lineItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount input */}
      <div className="col-span-4">
        <Label className="text-xs">{unit === 'usd' ? 'USD' : 'Sats'}</Label>
        <div>
          <Input
            type="number"
            inputMode="decimal"
            step={unit === 'usd' ? '0.01' : '1'}
            min="0"
            value={amountInput}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className="h-9"
          />
          {conversionLabel && (
            <p className="text-xs text-muted-foreground mt-1">{conversionLabel}</p>
          )}
        </div>
      </div>

      {/* Delete button */}
      <div className="col-span-2 flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-9 w-9 p-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Auto-save on blur */}
      <div 
        className="col-span-12"
        onBlur={handleSave}
      />
    </div>
  );
}
