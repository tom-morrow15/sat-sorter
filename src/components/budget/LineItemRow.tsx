import { useState, useRef, useEffect } from 'react';
import { Trash2, GripVertical, Edit2, Check, X, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateSpentForLineItem, getLineItemUsdAmount } from '@/lib/budgetTypes';
import { lineItemSpentUsd, percentUsed as percentUsedSafe } from '@/lib/budgetSelectors';
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
  lineItem, bucketId, bucketColor, transactions, currency, isIncome,
  merchants = [], onUpdate, onDelete, onViewTransactions,
}: LineItemRowProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lineItem.name);
  const [editAmount, setEditAmount] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const spentSats = calculateSpentForLineItem(lineItem.id, transactions);

  let spent = 0, remaining = 0, percentSpent = 0, isOverBudget = false;

  if (currency === 'usd' && priceData) {
    const plannedAmountUsd = getLineItemUsdAmount(lineItem, priceData.usdPerBtc);
    const spentUsd = lineItemSpentUsd(lineItem.id, transactions, priceData.usdPerBtc);
    spent = spentUsd;
    remaining = plannedAmountUsd - spentUsd;
    percentSpent = Math.min(percentUsedSafe(spentUsd, plannedAmountUsd), 100);
    isOverBudget = remaining < 0;
  } else {
    spent = spentSats;
    remaining = lineItem.plannedAmount - spentSats;
    percentSpent = lineItem.plannedAmount > 0
      ? Math.min((spentSats / lineItem.plannedAmount) * 100, 100) : 0;
    isOverBudget = remaining < 0;
  }

  const formatAmount = (lineItemData = lineItem, compact = false) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(getLineItemUsdAmount(lineItemData, priceData.usdPerBtc));
    }
    const sats = lineItemData.plannedAmount || 0;
    if (compact && sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
    if (compact && sats >= 10_000) return `${(sats / 1_000).toFixed(0)}K`;
    return `${formatSats(sats)}`;
  };

  const formatDisplayAmount = (amount: number, compact = false) => {
    if (currency === 'usd') return formatUsd(amount);
    const sats = Math.round(amount);
    if (compact && sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
    if (compact && sats >= 10_000) return `${(sats / 1_000).toFixed(0)}K`;
    return `${formatSats(sats)}`;
  };

  const getEditableAmount = () => {
    if (currency === 'usd') {
      if (lineItem.plannedAmountUsd && lineItem.plannedAmountUsd > 0) return lineItem.plannedAmountUsd.toFixed(2);
      if (lineItem.plannedAmount === 0) return '';
      if (priceData) return satsToUsd(lineItem.plannedAmount, priceData.usdPerBtc).toFixed(2);
      return '';
    }
    if (lineItem.plannedAmount === 0) return '';
    return lineItem.plannedAmount.toString();
  };

  const parseAmountToSats = (value: string): number => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) return usdToSats(num, priceData.usdPerBtc);
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
    if (currency === 'usd') {
      const usdAmount = parseFloat(editAmount) || 0;
      updates.plannedAmountUsd = usdAmount >= 0 ? usdAmount : 0;
      if (priceData) updates.btcPriceAtBudget = priceData.usdPerBtc;
    }
    onUpdate(bucketId, lineItem.id, updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(lineItem.name);
    setEditAmount(getEditableAmount());
    setIsEditing(false);
    setShowDeleteConfirm(false);
  };

  const handleDeleteConfirmed = () => {
    onDelete(bucketId, lineItem.id);
    setShowDeleteConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  };

  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  // ===== EDIT MODE =====
  if (isEditing) {
    return (
      <>
        <div className="py-3 px-1 rounded-xl bg-muted/30 space-y-3 animate-list-item">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              ref={nameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 text-sm flex-1"
              placeholder="e.g., Groceries, Gas, Rent"
            />
            <div className="relative h-10 w-full sm:w-36">
              <Input
                ref={inputRef}
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-10 w-full text-right text-sm tabular-nums"
                min="0"
                step={currency === 'usd' ? '0.01' : '1'}
                placeholder=" "
              />
              {!editAmount && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none text-sm tabular-nums">
                  {currency === 'usd' ? '$0.00' : '0'}
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              size="sm" variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 touch-target-sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleCancel} className="touch-target-sm">
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="touch-target-sm">
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </div>
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

  // ===== DISPLAY MODE =====
  return (
    <>
      <div className="group py-2.5 px-1 -mx-1 rounded-xl transition-colors hover:bg-muted/30 animate-list-item">
        {/* Main row */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Drag handle — desktop only */}
          <div className="hidden sm:flex opacity-0 group-hover:opacity-30 cursor-grab items-center w-4">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Name + merchant badge */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{lineItem.name}</span>
            {!isIncome && merchants.length > 0 && (
              <div className="flex-shrink-0">
                <MerchantBadge lineItemName={lineItem.name} merchants={merchants} />
              </div>
            )}
          </div>

          {/* Amount */}
          <div className={cn(
            'text-right font-serif-display tabular-nums text-sm sm:text-base flex-shrink-0',
            isIncome && 'text-success'
          )}>
            <span className="sm:hidden">{formatAmount(lineItem, true)}</span>
            <span className="hidden sm:inline">
              {formatAmount(lineItem)}{currency === 'sats' && ' sats'}
            </span>
          </div>

          {/* Edit button */}
          <Button
            size="icon" variant="ghost"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground touch-target-sm sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={() => handleStartEdit()}
            title="Edit line item"
          >
            <Edit2 className="h-4 w-4" />
          </Button>

          {/* Receipt button */}
          {onViewTransactions && spent > 0 && (
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8 text-primary flex-shrink-0 touch-target-sm"
              onClick={(e) => { e.stopPropagation(); onViewTransactions(lineItem.id); }}
              title="View transactions"
            >
              <Receipt className="h-4 w-4" />
            </Button>
          )}

          {/* Delete — desktop only */}
          <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon" variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar for expenses */}
        {!isIncome && lineItem.plannedAmount > 0 && (
          <div className="mt-2 space-y-1 pl-0 sm:pl-7">
            <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  isOverBudget
                    ? 'bg-gradient-to-r from-red-500 to-destructive'
                    : percentSpent >= 90
                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                    : percentSpent >= 75
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                )}
                style={{
                  width: `${percentSpent}%`,
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              <span className={cn(
                'whitespace-nowrap',
                isOverBudget ? 'text-destructive font-medium' : 'text-muted-foreground'
              )}>
                <span className="sm:hidden">{formatDisplayAmount(spent, true)}</span>
                <span className="hidden sm:inline">{formatDisplayAmount(spent)} spent</span>
              </span>
              <span className={cn(
                'whitespace-nowrap',
                isOverBudget ? 'text-destructive font-medium'
                  : percentSpent >= 90 ? 'text-orange-600 dark:text-orange-400 font-medium'
                  : 'text-muted-foreground'
              )}>
                {isOverBudget ? (
                  <>
                    <span className="sm:hidden">{formatDisplayAmount(Math.abs(remaining), true)} over</span>
                    <span className="hidden sm:inline">{formatDisplayAmount(Math.abs(remaining))} over</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">{formatDisplayAmount(remaining, true)}</span>
                    <span className="hidden sm:inline">{formatDisplayAmount(remaining)} left</span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

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
