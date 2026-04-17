import { useState, useMemo } from 'react';
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
import type { Bucket } from '@/lib/budgetTypes';

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
  }) => void;
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
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState(defaultBucketId || '');
  const [selectedLineItemId, setSelectedLineItemId] = useState('');

  const filteredBuckets = buckets.filter(b => b.isIncome === isIncome);

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
    };

    // When in USD mode, store the USD amount as source of truth
    if (currency === 'usd' && priceData) {
      const usdAmount = parseFloat(amountInput) || 0;
      transaction.amountUsd = usdAmount;
      transaction.btcPriceAtEntry = priceData.usdPerBtc;
    }

    onSave(transaction);

    // Show success toast
    toast({
      title: 'Transaction added',
      description: `${isIncome ? 'Income' : 'Expense'} recorded: ${description.trim()}`,
    });

    // Reset form
    setDescription('');
    setAmountInput('');
    setSelectedBucketId(defaultBucketId || '');
    setSelectedLineItemId('');
    onOpenChange(false);
  };

   const canSave = description.trim() && totalSats > 0 && selectedLineItemId !== '' && selectedBucketId !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isIncome ? 'Add Income' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            Add a new {isIncome ? 'income' : 'expense'} transaction
          </DialogDescription>
        </DialogHeader>

         <div className="space-y-4 py-4">
           <div className="space-y-2">
             <Label htmlFor="description">Description</Label>
             <Textarea
               id="description"
               placeholder="e.g., Weekly groceries, Monthly salary..."
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               rows={3}
               className="resize-none"
               autoFocus
             />
             <p className="text-xs text-muted-foreground">
               Add details to help you remember this transaction.
             </p>
           </div>

           <div className="space-y-2">
             <Label htmlFor="amount">Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
             <Input
               id="amount"
               type="number"
               value={amountInput}
               onChange={(e) => setAmountInput(e.target.value)}
               step={currency === 'usd' ? '0.01' : '1'}
               min="0"
               placeholder={currency === 'usd' ? '0.00' : '0'}
             />
           </div>

           <div className="space-y-2">
             <div className="flex items-center gap-2">
               <Label>Category *</Label>
               {!selectedBucketId && <span className="text-xs text-destructive">Required</span>}
             </div>
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

           {selectedBucketId && (
             <div className="space-y-2">
               <div className="flex items-center gap-2">
                 <Label>Line Item *</Label>
                 {!selectedLineItemId && <span className="text-xs text-destructive">Required</span>}
               </div>
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

         <div className="space-y-2">
           {!canSave && (
             <p className="text-xs text-destructive">
               Please fill in all required fields: description, amount, category, and line item.
             </p>
           )}
           <div className="flex justify-end gap-2">
             <Button variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button onClick={handleSave} disabled={!canSave}>
               Save Transaction
             </Button>
           </div>
         </div>
      </DialogContent>
    </Dialog>
  );
}
