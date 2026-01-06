import { useState } from 'react';
import { Plus, X } from 'lucide-react';
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
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { cn } from '@/lib/utils';

interface QuickAddFABProps {
  onAddTransaction: (transaction: {
    date: string;
    description: string;
    amount: number;
    isIncome: boolean;
    bucketId: string | null;
    lineItemId: string | null;
  }) => void;
  currency: 'sats' | 'usd';
}

export function QuickAddFAB({ onAddTransaction, currency }: QuickAddFABProps) {
  const { data: priceData } = useBitcoinPrice();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);

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
      bucketId: null,
      lineItemId: null,
    });

    // Reset form
    setDescription('');
    setAmount('');
    setIsIncome(false);
    setOpen(false);
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
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40',
          'sm:bottom-6 sm:right-6',
          'h-14 w-14 rounded-full shadow-lg hover:shadow-xl',
          'flex items-center justify-center transition-all duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'active:scale-95'
        )}
        style={{
          bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          right: 'max(1.5rem, env(safe-area-inset-right))',
        }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Add Transaction</DialogTitle>
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
                  onClick={() => setIsIncome(false)}
                >
                  Expense
                </Button>
                <Button
                  variant={isIncome ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsIncome(true)}
                >
                  Income
                </Button>
              </div>
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
            <Button
              onClick={handleAddTransaction}
              disabled={!description.trim() || !amount.trim()}
              className="w-full"
            >
              Add Transaction
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              💡 Tip: Press Ctrl+Enter to add quickly
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
