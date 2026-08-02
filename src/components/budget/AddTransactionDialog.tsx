import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, Scissors } from 'lucide-react';
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
import { useBitcoinPrice, satsToUsd, usdToSats, formatSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { useToast } from '@/hooks/useToast';
import { createSplit, getTotalFromSplits } from '@/lib/splitUtils';
import type { Bucket, Transaction, TransactionSplit } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

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
    splits?: TransactionSplit[];
    isSplit?: boolean;
    paymentMethod?: string;
  }) => void;
  paymentMethods?: string[];
}

/**
 * Unified Add Transaction dialog with built-in split assignment.
 *
 * Flow:
 * 1. Enter amount + description (top section)
 * 2. Assign to budget categories (bottom section)
 *    - One category = simple transaction
 *    - Multiple categories = split transaction (automatic, no separate mode)
 * 3. Save when fully assigned (remaining = $0)
 *
 * This replaces the old flow where "Split" was a separate button that opened
 * a second dialog. Now splitting is just adding more than one assignment row.
 */
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

  // --- Step 1 fields: amount + description ---
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  // --- Step 2 fields: category assignments ---
  // Each assignment row has: bucketId, lineItemId, amountUsd
  const [assignments, setAssignments] = useState<Array<{
    id: string;
    bucketId: string;
    lineItemId: string;
    amountInput: string;
  }>>([]);

  const paymentMethods = passedPaymentMethods || [];
  const filteredBuckets = buckets.filter(b => b.isIncome === isIncome);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('');
      setAmountInput('');
      setSelectedPaymentMethod('');
      // Start with one empty assignment row, pre-filled with the default bucket
      setAssignments([{
        id: crypto.randomUUID(),
        bucketId: defaultBucketId || '',
        lineItemId: '',
        amountInput: '',
      }]);
    }
  }, [open, defaultBucketId]);

  // Compute the total amount in USD (source of truth)
  const totalUsd = useMemo(() => {
    const num = parseFloat(amountInput) || 0;
    if (currency === 'usd' && priceData) {
      return num;
    }
    // Sats mode: convert to USD for internal calculations
    return priceData ? satsToUsd(Math.round(num), priceData.usdPerBtc) : 0;
  }, [amountInput, currency, priceData]);

  // Total sats (for storage)
  const totalSats = useMemo(() => {
    const num = parseFloat(amountInput) || 0;
    if (currency === 'usd' && priceData) {
      return usdToSats(num, priceData.usdPerBtc);
    }
    return Math.round(num);
  }, [amountInput, currency, priceData]);

  // Live conversion display
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

  // Sum of all assignment amounts
  const assignedTotal = useMemo(() => {
    return assignments.reduce((sum, a) => sum + (parseFloat(a.amountInput) || 0), 0);
  }, [assignments]);

  const remaining = totalUsd - assignedTotal;
  const isFullyAssigned = Math.abs(remaining) < 0.01;
  const hasAmount = totalUsd > 0;
  const hasDescription = description.trim().length > 0;

  // Auto-fill the first assignment's amount when there's only one row
  // and the user has entered a total amount (reduces taps for the common case)
  useEffect(() => {
    if (assignments.length === 1 && hasAmount && !assignments[0].amountInput) {
      const singleAmount = currency === 'usd'
        ? amountInput
        : priceData ? satsToUsd(totalSats, priceData.usdPerBtc).toFixed(2) : '';
      setAssignments(prev => prev.map((a, i) =>
        i === 0 ? { ...a, amountInput: singleAmount } : a
      ));
    }
  }, [amountInput, assignments.length, hasAmount, currency, priceData, totalSats]);

  const getLineItems = (bucketId: string) => {
    const bucket = buckets.find(b => b.id === bucketId);
    return bucket?.lineItems || [];
  };

  // Auto-select the first (and only) line item when a bucket is chosen
  useEffect(() => {
    setAssignments(prev => prev.map(a => {
      if (a.bucketId && !a.lineItemId) {
        const items = getLineItems(a.bucketId);
        if (items.length === 1) {
          return { ...a, lineItemId: items[0].id };
        }
      }
      return a;
    }));
  }, [assignments.map(a => a.bucketId).join(',')]);

  const handleAssignmentChange = (id: string, updates: Partial<typeof assignments[0]>) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const handleAddAssignment = () => {
    // Clear the auto-filled amount on the first row when adding a second
    // so the user can split the total across both
    setAssignments(prev => {
      const newAssignments = [...prev];
      // If there's only one row and its amount equals the total, clear it
      if (newAssignments.length === 1 && newAssignments[0].amountInput === amountInput) {
        newAssignments[0] = { ...newAssignments[0], amountInput: '' };
      }
      newAssignments.push({
        id: crypto.randomUUID(),
        bucketId: defaultBucketId || '',
        lineItemId: '',
        amountInput: '',
      });
      return newAssignments;
    });
  };

  const handleRemoveAssignment = (id: string) => {
    setAssignments(prev => {
      if (prev.length <= 1) return prev; // Keep at least one row
      const filtered = prev.filter(a => a.id !== id);
      // If only one row remains and we have a total, auto-fill its amount
      if (filtered.length === 1 && hasAmount) {
        const singleAmount = currency === 'usd'
          ? amountInput
          : priceData ? satsToUsd(totalSats, priceData.usdPerBtc).toFixed(2) : '';
        filtered[0] = { ...filtered[0], amountInput: singleAmount };
      }
      return filtered;
    });
  };

  const canSave = hasDescription && hasAmount && isFullyAssigned
    && assignments.every(a => a.bucketId && a.lineItemId && (parseFloat(a.amountInput) || 0) > 0);

  const handleSave = () => {
    if (!canSave) return;

    // Build the transaction — single or split depending on assignment count
    const validAssignments = assignments.filter(
      a => a.bucketId && a.lineItemId && (parseFloat(a.amountInput) || 0) > 0
    );

    const isSplit = validAssignments.length > 1;

    const transaction: any = {
      date: new Date().toISOString(),
      description: description.trim(),
      amount: totalSats,
      isIncome,
      source: 'manual',
      paymentMethod: selectedPaymentMethod && selectedPaymentMethod !== 'none' ? selectedPaymentMethod : undefined,
    };

    // Store USD amount as source of truth
    if (currency === 'usd' && priceData) {
      transaction.amountUsd = parseFloat(amountInput);
      transaction.btcPriceAtEntry = priceData.usdPerBtc;
    } else if (priceData) {
      // Sats mode: store the USD equivalent for anchoring
      transaction.amountUsd = satsToUsd(totalSats, priceData.usdPerBtc);
      transaction.btcPriceAtEntry = priceData.usdPerBtc;
    }

    if (isSplit) {
      // Split transaction — create TransactionSplit array
      const splits: TransactionSplit[] = validAssignments.map(a => {
        const usdAmount = parseFloat(a.amountInput) || 0;
        const satsAmount = priceData ? usdToSats(usdAmount, priceData.usdPerBtc) : 0;
        return {
          id: a.id,
          bucketId: a.bucketId,
          lineItemId: a.lineItemId,
          amount: satsAmount,
          amountUsd: usdAmount,
        };
      });
      transaction.splits = splits;
      transaction.isSplit = true;
      transaction.bucketId = null;
      transaction.lineItemId = null;
    } else {
      // Single assignment — use legacy format for simplicity
      const single = validAssignments[0];
      transaction.bucketId = single.bucketId;
      transaction.lineItemId = single.lineItemId;
    }

    onSave(transaction);

    toast({
      title: 'Transaction added',
      description: isSplit
        ? `${description.trim()} — split across ${validAssignments.length} categories`
        : `${description.trim()}`,
    });

    onOpenChange(false);
  };

  // Allow Cmd/Ctrl+Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSave) handleSave();
    }
  };

  const formatAmount = (amount: number) => {
    if (currency === 'usd') return formatUsd(amount);
    return formatSats(Math.round(amount));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90dvh] flex flex-col" onKeyDown={handleKeyDown}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{isIncome ? 'Add Income' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            {isIncome ? 'Record a new income source' : 'Record a new expense'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
          {/* Amount — large, prominent */}
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="e.g., Target run, Weekly groceries..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Assignment section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>
                {assignments.length > 1 ? 'Split into categories' : 'Assign to category'}
              </Label>
              {hasAmount && (
                <span className={cn(
                  'text-xs font-medium tabular-nums',
                  isFullyAssigned ? 'text-green-600 dark:text-green-400'
                    : remaining > 0 ? 'text-muted-foreground'
                    : 'text-destructive'
                )}>
                  {isFullyAssigned ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Fully assigned
                    </span>
                  ) : remaining > 0 ? (
                    `${formatAmount(remaining)} remaining`
                  ) : (
                    `${formatAmount(Math.abs(remaining))} over`
                  )}
                </span>
              )}
            </div>

            {/* Assignment rows */}
            <div className="space-y-2">
              {assignments.map((assignment, index) => {
                const lineItems = getLineItems(assignment.bucketId);
                return (
                  <div
                    key={assignment.id}
                    className={cn(
                      'p-3 rounded-xl border space-y-2 transition-colors',
                      assignment.bucketId && assignment.lineItemId
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    {/* Category + line item row */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={assignment.bucketId}
                          onValueChange={(val) => handleAssignmentChange(assignment.id, {
                            bucketId: val,
                            lineItemId: '',
                          })}
                        >
                          <SelectTrigger className="h-9">
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

                        {assignment.bucketId && lineItems.length > 0 && (
                          <Select
                            value={assignment.lineItemId}
                            onValueChange={(val) => handleAssignmentChange(assignment.id, {
                              lineItemId: val,
                            })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Line item" />
                            </SelectTrigger>
                            <SelectContent>
                              {lineItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Amount input */}
                      <div className="w-24 shrink-0">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={assignment.amountInput}
                          onChange={(e) => handleAssignmentChange(assignment.id, {
                            amountInput: e.target.value,
                          })}
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00"
                          className="h-9 text-right tabular-nums"
                        />
                      </div>

                      {/* Remove button (only if more than one row) */}
                      {assignments.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add another category (split) button */}
            {hasAmount && !isFullyAssigned && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={handleAddAssignment}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {assignments.length === 1 ? 'Split across categories' : 'Add another'}
              </Button>
            )}

            {/* Quick-fill remaining to the last assignment */}
            {hasAmount && remaining > 0.01 && assignments.length > 1 && (
              <button
                className="text-xs text-primary hover:underline w-full text-center"
                onClick={() => {
                  const last = assignments[assignments.length - 1];
                  if (last) {
                    handleAssignmentChange(last.id, {
                      amountInput: (parseFloat(last.amountInput) || 0 + remaining).toFixed(2),
                    });
                  }
                }}
              >
                + Assign remaining {formatAmount(remaining)} to last row
              </button>
            )}
          </div>

          {/* Payment method (optional, collapsed at bottom) */}
          {paymentMethods.length > 0 && (
            <div className="space-y-2 pt-2">
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
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t pt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="btn-interactive"
          >
            {assignments.length > 1 ? `Save Split (${assignments.length})` : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
