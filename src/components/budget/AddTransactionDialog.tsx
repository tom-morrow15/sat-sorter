import { useState, useMemo, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBitcoinPrice, satsToUsd, usdToSats, formatSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { useToast } from '@/hooks/useToast';
import { SplitEditor } from './SplitEditor';
import type { Bucket, Transaction, TransactionSplit } from '@/lib/budgetTypes';

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: Bucket[];
  defaultBucketId?: string;
  currency: 'sats' | 'usd';
  isIncome: boolean;
  onSave: (transaction: {
    date: string;
    description: string;
    amount: number;
    amountUsd?: number;
    btcPriceAtEntry?: number;
    isIncome: boolean;
    bucketId: string | null;
    lineItemId: string | null;
    paymentMethod?: string;
  }) => void;
  paymentMethods?: string[];
  onAddPaymentMethod?: (method: string) => void;
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  buckets,
  defaultBucketId,
  currency,
  isIncome,
  onSave,
  paymentMethods: passedPaymentMethods,
}: AddTransactionDialogProps) {
  const { data: priceData } = useBitcoinPrice();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState(defaultBucketId || '');
  const [selectedLineItemId, setSelectedLineItemId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [tempTxForSplit, setTempTxForSplit] = useState<Transaction | null>(null);

  const paymentMethods = passedPaymentMethods || [];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('');
      setAmountInput('');
      setSelectedBucketId(defaultBucketId || '');
      setSelectedLineItemId('');
      setSelectedPaymentMethod('');
    }
  }, [open, defaultBucketId]);

  const filteredBuckets = buckets.filter(b => b.isIncome === isIncome);

  const totalSats = useMemo(() => {
    const num = parseFloat(amountInput) || 0;
    if (currency === 'usd' && priceData) {
      return Math.round(usdToSats(num, priceData.usdPerBtc));
    }
    return Math.round(num);
  }, [amountInput, currency, priceData]);

  // Live conversion display (show the other currency)
  const conversionDisplay = useMemo(() => {
    if (!amountInput || !priceData) return null;
    const num = parseFloat(amountInput) || 0;
    if (num <= 0) return null;
    if (currency === 'usd') {
      const sats = usdToSats(num, priceData.usdPerBtc);
      return `≈ ${formatSats(sats)} sats`;
    }
    const usd = satsToUsd(num, priceData.usdPerBtc);
    return `≈ ${formatUsd(usd)}`;
  }, [amountInput, currency, priceData]);

  const getLineItems = (bucketId: string) => {
    const bucket = buckets.find(b => b.id === bucketId);
    return bucket?.lineItems || [];
  };

  // Auto-select the first (and only) line item when a bucket is chosen
  // and it has exactly one line item — reduces taps for the common case
  useEffect(() => {
    if (selectedBucketId) {
      const items = getLineItems(selectedBucketId);
      if (items.length === 1 && !selectedLineItemId) {
        setSelectedLineItemId(items[0].id);
      }
    }
  }, [selectedBucketId]);

  const handleSave = () => {
    if (!description.trim() || totalSats <= 0 || !selectedLineItemId || !selectedBucketId) return;

    const transaction: any = {
      date: new Date().toISOString(),
      description: description.trim(),
      amount: totalSats,
      isIncome,
      bucketId: selectedBucketId,
      lineItemId: selectedLineItemId,
      source: 'manual',
      paymentMethod: selectedPaymentMethod && selectedPaymentMethod !== 'none' ? selectedPaymentMethod : undefined,
    };

    if (currency === 'usd' && priceData) {
      const usdAmount = parseFloat(amountInput) || 0;
      transaction.amountUsd = usdAmount;
      transaction.btcPriceAtEntry = priceData.usdPerBtc;
    }

    onSave(transaction);

    toast({
      title: 'Transaction added',
      description: `${isIncome ? 'Income' : 'Expense'} recorded: ${description.trim()}`,
    });

    onOpenChange(false);
  };

  const handleOpenSplit = () => {
    if (!description.trim() || totalSats <= 0) return;

    const tx: Transaction = {
      id: `temp-${Date.now()}`,
      amount: totalSats,
      amountUsd: currency === 'usd' && priceData ? parseFloat(amountInput) || 0 : undefined,
      btcPriceAtEntry: currency === 'usd' && priceData ? priceData.usdPerBtc : undefined,
      description: description.trim(),
      date: new Date().toISOString(),
      lineItemId: null,
      bucketId: null,
      isIncome,
    };

    setTempTxForSplit(tx);
    setShowSplitEditor(true);
  };

  const handleSaveSplit = (splits: TransactionSplit[]) => {
    const tx = tempTxForSplit;
    if (!tx) return;

    const finalTx: any = {
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      isIncome: tx.isIncome,
      bucketId: null,
      lineItemId: null,
      source: 'manual',
      splits,
      isSplit: true,
    };

    if (tx.amountUsd && tx.btcPriceAtEntry) {
      finalTx.amountUsd = tx.amountUsd;
      finalTx.btcPriceAtEntry = tx.btcPriceAtEntry;
    }

    onSave(finalTx);

    toast({
      title: 'Transaction added',
      description: `${isIncome ? 'Income' : 'Expense'} recorded (split)`,
    });

    setTempTxForSplit(null);
    setShowSplitEditor(false);
    onOpenChange(false);
  };

  // Allow Enter key to save when all required fields are filled
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSave) handleSave();
    }
  };

  const canSave = description.trim() && totalSats > 0 && selectedLineItemId !== '' && selectedBucketId !== '';
  const lineItems = selectedBucketId ? getLineItems(selectedBucketId) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{isIncome ? 'Add Income' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            {isIncome ? 'Record a new income source' : 'Record a new expense'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount — FIRST, most important field, large and prominent */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount {currency === 'usd' ? '(USD)' : '(sats)'}
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground pointer-events-none">
                {currency === 'usd' ? '$' : '⚡'}
              </span>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                step={currency === 'usd' ? '0.01' : '1'}
                min="0"
                placeholder={currency === 'usd' ? '0.00' : '0'}
                className="h-14 pl-10 text-2xl font-bold tabular-nums"
                autoFocus
              />
            </div>
            {conversionDisplay && (
              <p className="text-xs text-muted-foreground tabular-nums animate-count-up">
                {conversionDisplay}
              </p>
            )}
          </div>

          {/* Description — SECOND, quick to fill */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., Weekly groceries, Monthly salary..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category + Line Item — THIRD, cascading selectors */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={selectedBucketId} onValueChange={(val) => {
              setSelectedBucketId(val);
              setSelectedLineItemId('');
            }}>
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

          {selectedBucketId && lineItems.length > 0 && (
            <div className="space-y-2">
              <Label>Line Item</Label>
              <Select value={selectedLineItemId} onValueChange={setSelectedLineItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a line item..." />
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
          )}

          {/* Payment Method — optional, collapsed at bottom */}
          {paymentMethods.length > 0 && (
            <div className="space-y-2">
              <Label>Payment Method <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No payment method</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={handleOpenSplit}
              disabled={!description.trim() || totalSats <= 0}
              className="gap-2"
            >
              <Scissors className="h-4 w-4" />
              Split
            </Button>
            <Button onClick={handleSave} disabled={!canSave} className="btn-interactive">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>

      {tempTxForSplit && (
        <SplitEditor
          open={showSplitEditor}
          onOpenChange={(open) => {
            setShowSplitEditor(open);
            if (!open) setTempTxForSplit(null);
          }}
          transaction={tempTxForSplit}
          buckets={buckets.filter((b) => b.isIncome === isIncome)}
          onSave={handleSaveSplit}
        />
      )}
    </Dialog>
  );
}
