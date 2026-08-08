import { useState } from 'react';
import { Plus, X, Scissors } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { useBudget } from '@/hooks/useBudget';
import { cn } from '@/lib/utils';
import { SplitEditor } from './SplitEditor';
import type { Transaction, TransactionSplit } from '@/lib/budgetTypes';

interface QuickAddFABProps {
  onAddTransaction: (transaction: {
    date: string;
    description: string;
    amount: number;
    amountUsd?: number;
    btcPriceAtEntry?: number;
    isIncome: boolean;
    bucketId: string | null;
    lineItemId: string | null;
    splits?: TransactionSplit[];
    isSplit?: boolean;
  }) => void;
  currency: 'sats' | 'usd';
}

export function QuickAddFAB({ onAddTransaction, currency }: QuickAddFABProps) {
  const { data: priceData } = useBitcoinPrice();
  const { currentBudget } = useBudget();
  const [open, setOpen] = useState(false);
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [tempTransactionId, setTempTransactionId] = useState<string | null>(null);

  const handleAddTransaction = () => {
    if (!description.trim() || !amount.trim()) {
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const satsAmount =
      currency === 'usd' && priceData
        ? usdToSats(numAmount, priceData.usdPerBtc)
        : numAmount;

    if (satsAmount <= 0) {
      return;
    }

    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      description: description.trim(),
      amount: Math.round(satsAmount),
      isIncome,
      bucketId: selectedBucketId,
      lineItemId: selectedLineItemId,
    });

    // Reset form
    setDescription('');
    setAmount('');
    setIsIncome(false);
    setSelectedLineItemId(null);
    setSelectedBucketId(null);
    setOpen(false);
  };

  const handleOpenSplit = () => {
    if (!description.trim() || !amount.trim()) {
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const satsAmount =
      currency === 'usd' && priceData
        ? usdToSats(numAmount, priceData.usdPerBtc)
        : numAmount;

    if (satsAmount <= 0) {
      return;
    }

    // Create a temporary transaction object for the split editor
    const tempTx: Transaction = {
      id: `temp-${Date.now()}`,
      description: description.trim(),
      amount: Math.round(satsAmount),
      amountUsd: currency === 'usd' ? numAmount : undefined,
      btcPriceAtEntry: priceData?.usdPerBtc,
      date: new Date().toISOString().split('T')[0],
      isIncome,
      lineItemId: selectedLineItemId,
      bucketId: selectedBucketId,
    };

    setTempTransactionId(tempTx.id);
    setOpen(false);
    setShowSplitEditor(true);
  };

  const handleSaveSplit = (splits: TransactionSplit[]) => {
    if (!description.trim() || !amount.trim()) {
      return;
    }

    const numAmount = parseFloat(amount) || 0;
    const satsAmount =
      currency === 'usd' && priceData
        ? usdToSats(numAmount, priceData.usdPerBtc)
        : numAmount;

    if (satsAmount <= 0) {
      return;
    }

    // Add the transaction WITH splits in a single atomic call.
    // The bucketId/lineItemId are left null since the splits define the assignments.
    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      description: description.trim(),
      amount: Math.round(satsAmount),
      amountUsd: currency === 'usd' ? numAmount : undefined,
      btcPriceAtEntry: priceData?.usdPerBtc,
      isIncome,
      bucketId: null,
      lineItemId: null,
      splits,
      isSplit: true,
    });

    // Reset form
    setDescription('');
    setAmount('');
    setIsIncome(false);
    setSelectedLineItemId(null);
    setSelectedBucketId(null);
    setShowSplitEditor(false);
    setTempTransactionId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleAddTransaction();
    }
  };

  // Quick amount buttons for common amounts
  const quickAmounts = [
    { label: '$5', sats: priceData ? usdToSats(5, priceData.usdPerBtc) : 500 },
    { label: '$10', sats: priceData ? usdToSats(10, priceData.usdPerBtc) : 1000 },
    { label: '$20', sats: priceData ? usdToSats(20, priceData.usdPerBtc) : 2000 },
    { label: '$50', sats: priceData ? usdToSats(50, priceData.usdPerBtc) : 5000 },
  ];

  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  return (
    <>
      {/* Floating Action Button - positioned above nav bar */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed right-6 z-50',
          'sm:right-6',
          'h-14 w-14 rounded-full shadow-lg hover:shadow-xl',
          'flex items-center justify-center transition-all duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'active:scale-95 touch-target'
        )}
        style={{
          bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 76px)',
          right: 'max(1.5rem, env(safe-area-inset-right))',
        }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Quick Add Transaction</DialogTitle>
            <DialogDescription>
              Add a transaction quickly. Assign to categories later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">What did you spend on?</Label>
              <Input
                id="description"
                placeholder="e.g., Starbucks, Groceries, Gas"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                step="0.01"
                min="0"
              />
            </div>

            {/* Quick amounts for USD */}
            {currency === 'usd' && (
              <div className="space-y-2">
                <Label className="text-xs">Quick amounts:</Label>
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((qa) => (
                    <Badge
                      key={qa.label}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setAmount(qa.label.substring(1))}
                    >
                      {qa.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Income/Expense toggle */}
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={!isIncome ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setIsIncome(false);
                    setSelectedLineItemId(null);
                    setSelectedBucketId(null);
                  }}
                >
                  Expense
                </Button>
                <Button
                  variant={isIncome ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setIsIncome(true);
                    setSelectedLineItemId(null);
                    setSelectedBucketId(null);
                  }}
                >
                  Income
                </Button>
              </div>
            </div>

            {/* Line Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="line-item">Assign to (optional)</Label>
              <Select value={selectedLineItemId || ''} onValueChange={(value) => {
                if (!value) {
                  setSelectedLineItemId(null);
                  setSelectedBucketId(null);
                  return;
                }
                // value is "bucketId:lineItemId"
                const [bucketId, lineItemId] = value.split(':');
                setSelectedBucketId(bucketId);
                setSelectedLineItemId(lineItemId);
              }}>
                <SelectTrigger id="line-item">
                  <SelectValue placeholder="Select a line item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None - Assign later</SelectItem>
                  {currentBudget.buckets
                    .filter(b => b.isIncome === isIncome)
                    .map((bucket) => (
                      <optgroup key={bucket.id} label={bucket.name}>
                        {bucket.lineItems.map((item) => (
                          <SelectItem key={item.id} value={`${bucket.id}:${item.id}`}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </optgroup>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {description && amount && (
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{description}</span>
                  <span className={cn('font-semibold', isIncome ? 'text-green-600' : 'text-red-600')}>
                    {isIncome ? '+' : '-'}{formatAmount(Math.round(parseFloat(amount) || 0))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Today • {isIncome ? 'Income' : 'Expense'}
                </p>
              </div>
            )}

            {/* Add button */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleOpenSplit}
                disabled={!description.trim() || !amount.trim()}
                className="gap-2"
              >
                <Scissors className="h-4 w-4" />
                Split
              </Button>
              <Button
                onClick={handleAddTransaction}
                disabled={!description.trim() || !amount.trim()}
                className="flex-1"
              >
                Add Transaction
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              💡 Tip: Press Ctrl+Enter to add quickly
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Editor */}
      {tempTransactionId && (
        <SplitEditor
          open={showSplitEditor}
          onOpenChange={setShowSplitEditor}
          transaction={{
            id: tempTransactionId,
            description,
            amount: currency === 'usd' && priceData ? usdToSats(parseFloat(amount) || 0, priceData.usdPerBtc) : Math.round(parseFloat(amount) || 0),
            amountUsd: currency === 'usd' ? parseFloat(amount) || 0 : undefined,
            date: new Date().toISOString().split('T')[0],
            isIncome,
            lineItemId: selectedLineItemId,
            bucketId: selectedBucketId,
          }}
          buckets={currentBudget.buckets.filter(b => b.isIncome === isIncome)}
          onSave={handleSaveSplit}
        />
      )}
    </>
  );
}
