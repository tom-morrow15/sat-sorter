import { useState, useRef, useEffect } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Trash2, GripVertical, Edit2, Check, X, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateSpentForLineItem, getLineItemUsdAmount } from '@/lib/budgetTypes';
import type { LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { MerchantBadge } from './MerchantIndicator';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import { cn } from '@/lib/utils';

interface LineItemRowProps {
  lineItem: LineItem;
  bucketId: string;
  bucketColor: string;
  transactions: Transaction[];
  currency: 'sats' | 'usd';
  isIncome: boolean;
  merchants?: (BTCMapElement & { distance: number })[];
  onUpdate: (bucketId: string, lineItemId: string, updates: Partial<LineItem>) => void;
  onDelete: (bucketId: string, lineItemId: string) => void;
  onViewTransactions?: (lineItemId: string) => void;
}

export function LineItemRow({
  lineItem,
  bucketId,
  bucketColor,
  transactions,
  currency,
  isIncome,
  merchants = [],
  onUpdate,
  onDelete,
  onViewTransactions,
}: LineItemRowProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lineItem.name);
  const [editAmount, setEditAmount] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

   const spent = calculateSpentForLineItem(lineItem.id, transactions);
   const remaining = lineItem.plannedAmount - spent;
   
   // Calculate spent and remaining in USD when in USD mode
   let spentUsd = 0;
   let remainingUsd = 0;
   let plannedAmountUsd = 0;
   
   if (currency === 'usd' && priceData) {
     // Calculate total spent in USD from transactions
     spentUsd = transactions
       .filter(t => t.lineItemId === lineItem.id && !t.isIncome)
       .reduce((sum, t) => {
         const txUsd = t.amountUsd && t.amountUsd > 0 
           ? t.amountUsd 
           : (t.amount / 100_000_000) * priceData.usdPerBtc;
         return sum + txUsd;
       }, 0);
     
     // Get planned amount in USD
     plannedAmountUsd = getLineItemUsdAmount(lineItem, priceData.usdPerBtc);
     remainingUsd = plannedAmountUsd - spentUsd;
   }
   
   const percentSpent = lineItem.plannedAmount > 0
     ? Math.min((spent / lineItem.plannedAmount) * 100, 100)
     : 0;
   const isOverBudget = remaining < 0;

  // Format amount based on currency - compact for mobile
   // Format amount for display - use stored USD if available (source of truth)
   const formatAmount = (lineItemData = lineItem, compact = false) => {
     // In USD mode, use stored USD amount (source of truth)
     if (currency === 'usd' && priceData) {
       const usdAmount = getLineItemUsdAmount(lineItemData, priceData.usdPerBtc);
       return formatUsd(usdAmount);
     }

     // For sats mode, format the sats amount
     const sats = lineItemData.plannedAmount || 0;
     if (compact && sats >= 1_000_000) {
       return `${(sats / 1_000_000).toFixed(1)}M`;
     }
     if (compact && sats >= 10_000) {
       return `${(sats / 1_000).toFixed(0)}K`;
     }
     return `${formatSats(sats)}`;
   };

   // Format sats amounts for spent/remaining display
   const formatSatsAmount = (sats: number, compact = false) => {
     if (currency === 'usd' && priceData) {
       // In USD mode, convert sats to USD for display
       const usd = (sats / 100_000_000) * priceData.usdPerBtc;
       return formatUsd(usd);
     }
     if (compact && sats >= 1_000_000) {
       return `${(sats / 1_000_000).toFixed(1)}M`;
     }
     if (compact && sats >= 10_000) {
       return `${(sats / 1_000).toFixed(0)}K`;
     }
     return `${formatSats(sats)}`;
   };

  // Get editable amount value - show empty string if 0 so it looks like placeholder
  const getEditableAmount = () => {
    // When in USD mode, use the stored USD amount (source of truth)
    if (currency === 'usd') {
      if (lineItem.plannedAmountUsd && lineItem.plannedAmountUsd > 0) {
        return lineItem.plannedAmountUsd.toFixed(2);
      }
      // Fallback for legacy line items
      if (lineItem.plannedAmount === 0) {
        return '';
      }
      if (priceData) {
        return satsToUsd(lineItem.plannedAmount, priceData.usdPerBtc).toFixed(2);
      }
      return '';
    }
    // When in sats mode, use the sats amount
    if (lineItem.plannedAmount === 0) {
      return '';
    }
    return lineItem.plannedAmount.toString();
  };

  // Parse input amount and calculate corresponding sats using current price
  const parseAmountToSats = (value: string): number => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      return usdToSats(num, priceData.usdPerBtc);
    }
    return Math.round(num);
  };

  const handleStartEdit = () => {
    setEditName(lineItem.name);
    setEditAmount(getEditableAmount());
    setIsEditing(true);
  };

  const handleSave = () => {
    const newAmountSats = parseAmountToSats(editAmount);
    const updates: Partial<LineItem> = {
      name: editName.trim() || lineItem.name,
      plannedAmount: newAmountSats >= 0 ? newAmountSats : 0,
    };

    // When in USD mode, store the USD amount as source of truth
    if (currency === 'usd') {
      const usdAmount = parseFloat(editAmount) || 0;
      updates.plannedAmountUsd = usdAmount >= 0 ? usdAmount : 0;
      // Store the BTC price at the time of budget creation/update
      if (priceData) {
        updates.btcPriceAtBudget = priceData.usdPerBtc;
      }
    }

    onUpdate(bucketId, lineItem.id, updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(lineItem.name);
    setEditAmount(getEditableAmount());
    setIsEditing(false);
  };

  const handleDeleteConfirmed = () => {
    onDelete(bucketId, lineItem.id);
    setShowDeleteConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  // Handle quick amount update (click on amount)
  const handleAmountClick = () => {
    if (!isEditing) {
      setEditAmount(getEditableAmount());
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  if (isEditing) {
    return (
      <div className="py-3 px-3 sm:px-4 rounded-lg bg-muted/50 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
           <Input
             ref={nameInputRef}
             value={editName}
             onChange={(e) => setEditName(e.target.value)}
             onKeyDown={handleKeyDown}
             className="h-9 text-sm flex-1"
             placeholder="e.g., Groceries, Gas, Rent"
           />
            <Input
               ref={inputRef}
               type="number"
               value={editAmount}
               onChange={(e) => setEditAmount(e.target.value)}
               onKeyDown={handleKeyDown}
               className="h-9 w-full sm:w-32 text-right text-sm tabular-nums"
               min="0"
               step={currency === 'usd' ? '0.01' : '1'}
             />
        </div>
        <div className="flex justify-between gap-2">
          {/* Delete button - visible in edit mode for mobile access */}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'group py-2.5 px-3 sm:px-4 rounded-lg transition-colors',
          'hover:bg-muted/50 active:bg-muted/70'
        )}
        onClick={handleStartEdit}
      >
        {/* Main row - always horizontal */}
        <div className="flex items-center gap-2 sm:gap-3">
        {/* Drag handle - hidden on mobile */}
        <div className="hidden sm:block opacity-0 group-hover:opacity-50 cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Name and merchant badge */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {lineItem.name}
          </span>
          {/* Merchant indicator - smaller on mobile */}
          {!isIncome && merchants.length > 0 && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <MerchantBadge
                lineItemName={lineItem.name}
                merchants={merchants}
              />
            </div>
          )}
        </div>

        {/* Amount */}
         <div
           className={cn(
             'text-right font-semibold tabular-nums text-sm flex-shrink-0',
             isIncome && 'text-success'
           )}
         >
           {/* Show compact on very small screens */}
           <span className="sm:hidden">{formatAmount(lineItem, true)}</span>
           <span className="hidden sm:inline">
             {formatAmount(lineItem)}
             {currency === 'sats' && ' sats'}
           </span>
         </div>

        {/* Action buttons - only on hover/desktop */}
         <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           {onViewTransactions && spent > 0 && (
             <Button
               size="icon"
               variant="ghost"
               className="h-7 w-7"
               onClick={(e) => {
                 e.stopPropagation();
                 onViewTransactions(lineItem.id);
               }}
               title="View transactions for this item"
             >
               <Receipt className="h-3.5 w-3.5" />
             </Button>
           )}
           <Button
             size="icon"
             variant="ghost"
             className="h-7 w-7"
             onClick={(e) => {
               e.stopPropagation();
               handleStartEdit();
             }}
           >
             <Edit2 className="h-3.5 w-3.5" />
           </Button>
           <Button
             size="icon"
             variant="ghost"
             className="h-7 w-7 text-destructive hover:text-destructive"
             onClick={(e) => {
               e.stopPropagation();
               setShowDeleteConfirm(true);
             }}
           >
             <Trash2 className="h-3.5 w-3.5" />
           </Button>
        </div>
      </div>

       {/* Progress bar for expenses - separate row */}
       {!isIncome && lineItem.plannedAmount > 0 && (
         <div className="mt-2 space-y-1.5 pl-0 sm:pl-7">
           {/* Progress bar */}
           <div className="flex items-center gap-2">
             <div className="flex-1">
               <Progress
                 value={percentSpent}
                 className="h-1.5"
                 style={{
                   '--progress-background': isOverBudget
                     ? 'hsl(0 84% 60%)'
                     : bucketColor,
                 } as React.CSSProperties}
               />
             </div>
           </div>

           {/* Spent / Remaining info row */}
           <div className="flex items-center justify-between text-xs tabular-nums">
             <span className={cn(
               'whitespace-nowrap',
               isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'
             )}>
               <span className="sm:hidden">{formatSatsAmount(spent, true)}</span>
               <span className="hidden sm:inline">{formatSatsAmount(spent)} spent</span>
             </span>
             
             <span className={cn(
               'whitespace-nowrap',
               remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
             )}>
               <span className="sm:hidden">{formatSatsAmount(Math.max(0, remaining), true)}</span>
               <span className="hidden sm:inline">{formatSatsAmount(Math.max(0, remaining))} left</span>
             </span>
           </div>
         </div>
        )}
      </div>

      {/* Deletion confirmation dialog */}
      <DeletionConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemType="lineItem"
        itemName={lineItem.name}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
