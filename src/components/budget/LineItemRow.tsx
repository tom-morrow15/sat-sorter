import { useState, useRef, useEffect } from 'react';
import { Trash2, GripVertical, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateSpentForLineItem, calculateSpentForLineItemUsd } from '@/lib/budgetTypes';
import type { LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { MerchantBadge } from './MerchantIndicator';
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
}: LineItemRowProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lineItem.name);
  const [editAmount, setEditAmount] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Calculate spent amounts - use USD-aware version when in USD mode
  const spentSats = calculateSpentForLineItem(lineItem.id, transactions);
  const spentUsd = priceData ? calculateSpentForLineItemUsd(lineItem.id, transactions, priceData.usdPerBtc) : 0;

  // For planned amount in USD
  const plannedUsd = lineItem.usdAmount !== undefined
    ? lineItem.usdAmount
    : (priceData ? satsToUsd(lineItem.plannedAmount, priceData.usdPerBtc) : 0);

  // Use appropriate values based on currency mode
  const spent = currency === 'usd' ? spentUsd : spentSats;
  const planned = currency === 'usd' ? plannedUsd : lineItem.plannedAmount;

  // CRITICAL: For over-budget detection, always use USD comparison if BOTH have USD as source of truth
  // This prevents false over-budget warnings due to exchange rate drift between entry times
  const lineItemHasUsdSource = lineItem.usdAmount !== undefined;
  const lineItemTransactions = transactions.filter(t => t.lineItemId === lineItem.id && !t.isIncome);
  const allTransactionsHaveUsdSource = lineItemTransactions.length > 0 &&
    lineItemTransactions.every(t => t.usdAmount !== undefined);

  // Check if ANY transactions have USD source - if so, prefer USD comparison
  const anyTransactionsHaveUsdSource = lineItemTransactions.some(t => t.usdAmount !== undefined);

  // Use USD-based comparison when both planned and spent have USD as source of truth
  // Also use USD comparison when line item has USD source and at least some transactions do too
  const useUsdForComparison = priceData && lineItemHasUsdSource && anyTransactionsHaveUsdSource;

  const remaining = useUsdForComparison
    ? plannedUsd - spentUsd
    : planned - spent;

  // Use consistent values for percent calculation too
  const percentSpent = (() => {
    if (useUsdForComparison) {
      return plannedUsd > 0 ? Math.min((spentUsd / plannedUsd) * 100, 100) : 0;
    }
    return planned > 0 ? Math.min((spent / planned) * 100, 100) : 0;
  })();

  // Over-budget detection: Add small tolerance (0.1% or $0.05) for rounding errors
  // This prevents false positives due to floating point math and conversion discrepancies
  const tolerance = useUsdForComparison
    ? Math.max(0.05, plannedUsd * 0.001) // $0.05 or 0.1% of budget for USD
    : Math.max(10, planned * 0.001); // 10 sats or 0.1% of budget for sats

  const isOverBudget = remaining < -tolerance;

  // Format amount based on currency - compact for mobile
  // For planned amount, use stored USD if available to avoid conversion drift
  const formatAmount = (sats: number, compact = false, useStoredUsd = false) => {
    if (currency === 'usd') {
      // Use stored USD amount for planned amounts to avoid conversion drift
      if (useStoredUsd && lineItem.usdAmount !== undefined) {
        return formatUsd(lineItem.usdAmount);
      }
      if (priceData) {
        return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
      }
      return '$0.00';
    }
    if (compact && sats >= 1_000_000) {
      return `${(sats / 1_000_000).toFixed(1)}M`;
    }
    if (compact && sats >= 10_000) {
      return `${(sats / 1_000).toFixed(0)}K`;
    }
    return `${formatSats(sats)}`;
  };

  // Get editable amount value
  const getEditableAmount = () => {
    if (currency === 'usd') {
      // If we have a stored USD amount, use it exactly
      if (lineItem.usdAmount !== undefined) {
        return lineItem.usdAmount.toFixed(2);
      }
      // Otherwise convert from sats
      if (priceData) {
        return satsToUsd(lineItem.plannedAmount, priceData.usdPerBtc).toFixed(2);
      }
      return '0.00';
    }
    return lineItem.plannedAmount.toString();
  };

  // Parse input amount - returns sats, USD, and exchange rate
  const parseInputAmount = (value: string): { sats: number; usdAmount?: number; usdPerBtcAtEntry?: number } => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      // Store the exact USD amount, exchange rate, and convert to sats
      return {
        sats: Math.round(usdToSats(num, priceData.usdPerBtc)),
        usdAmount: num,
        usdPerBtcAtEntry: priceData.usdPerBtc,
      };
    }
    // When entering sats, clear the USD amount so sats becomes the source of truth
    return {
      sats: Math.round(num),
      usdAmount: undefined,
      usdPerBtcAtEntry: undefined,
    };
  };

  const handleStartEdit = () => {
    setEditName(lineItem.name);
    setEditAmount(getEditableAmount());
    setIsEditing(true);
  };

  const handleSave = () => {
    const { sats, usdAmount, usdPerBtcAtEntry } = parseInputAmount(editAmount);
    onUpdate(bucketId, lineItem.id, {
      name: editName.trim() || lineItem.name,
      plannedAmount: sats >= 0 ? sats : 0,
      usdAmount: usdAmount,
      usdPerBtcAtEntry: usdPerBtcAtEntry,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(lineItem.name);
    setEditAmount(getEditableAmount());
    setIsEditing(false);
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
      <div className="py-2.5 px-3 sm:px-4 rounded-lg bg-muted/50 space-y-2">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hidden spacer for alignment with non-edit mode */}
          <div className="hidden sm:block w-4" />

          {/* Inline editing - same row layout */}
          <Input
            ref={nameInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm flex-1 min-w-0"
            placeholder="Item name"
            onClick={(e) => e.stopPropagation()}
          />
          <Input
            ref={inputRef}
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 w-24 sm:w-28 text-right text-sm tabular-nums"
            placeholder="0"
            min="0"
            step={currency === 'usd' ? '0.01' : '1'}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex justify-between gap-2 pl-0 sm:pl-7">
          {/* Delete button - visible in edit mode for mobile access */}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(bucketId, lineItem.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button size="sm" className="h-8 px-2" onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
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
          <span className="sm:hidden">{formatAmount(lineItem.plannedAmount, true, true)}</span>
          <span className="hidden sm:inline">{formatAmount(lineItem.plannedAmount, false, true)}{currency === 'sats' ? ' sats' : ''}</span>
        </div>

        {/* Action buttons - only on hover/desktop */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              onDelete(bucketId, lineItem.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar for expenses - separate row */}
      {!isIncome && lineItem.plannedAmount > 0 && (
        <div className="mt-2 flex items-center gap-2 pl-0 sm:pl-7">
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
          <span className={cn(
            'text-xs tabular-nums whitespace-nowrap flex-shrink-0',
            isOverBudget ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {currency === 'usd' ? (
              <>
                <span className="sm:hidden">{formatUsd(spentUsd)}</span>
                <span className="hidden sm:inline">{formatUsd(spentUsd)} spent</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{formatAmount(spentSats, true)}</span>
                <span className="hidden sm:inline">{formatAmount(spentSats)} spent</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
