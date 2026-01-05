import { useState, useRef, useEffect } from 'react';
import { Trash2, GripVertical, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateSpentForLineItem } from '@/lib/budgetTypes';
import type { LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { MerchantIndicator } from './MerchantIndicator';
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

  const spent = calculateSpentForLineItem(lineItem.id, transactions);
  const remaining = lineItem.plannedAmount - spent;
  const percentSpent = lineItem.plannedAmount > 0
    ? Math.min((spent / lineItem.plannedAmount) * 100, 100)
    : 0;
  const isOverBudget = remaining < 0;

  // Format amount based on currency
  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  // Get editable amount value
  const getEditableAmount = () => {
    if (currency === 'usd' && priceData) {
      return satsToUsd(lineItem.plannedAmount, priceData.usdPerBtc).toFixed(2);
    }
    return lineItem.plannedAmount.toString();
  };

  // Parse input amount to sats
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
    const newAmount = parseAmountToSats(editAmount);
    onUpdate(bucketId, lineItem.id, {
      name: editName.trim() || lineItem.name,
      plannedAmount: newAmount >= 0 ? newAmount : 0,
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

  return (
    <div
      className={cn(
        'group flex items-center gap-3 py-3 px-4 rounded-lg transition-colors',
        'hover:bg-muted/50',
        isEditing && 'bg-muted/50'
      )}
    >
      {/* Drag handle */}
      <div className="opacity-0 group-hover:opacity-50 cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            ref={nameInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
            placeholder="Item name"
          />
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartEdit}
              className="text-left text-sm font-medium truncate hover:text-primary transition-colors"
            >
              {lineItem.name}
            </button>
            {/* Bitcoin merchant indicator */}
            {!isIncome && merchants.length > 0 && (
              <MerchantIndicator
                lineItemName={lineItem.name}
                merchants={merchants}
              />
            )}
          </div>
        )}

        {/* Progress bar for expenses */}
        {!isIncome && lineItem.plannedAmount > 0 && !isEditing && (
          <div className="mt-1.5 flex items-center gap-2">
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
              'text-xs tabular-nums whitespace-nowrap',
              isOverBudget ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {formatAmount(spent)} spent
            </span>
          </div>
        )}
      </div>

      {/* Planned amount */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-28 text-right text-sm tabular-nums"
              placeholder="0"
              min="0"
              step={currency === 'usd' ? '0.01' : '1'}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
              <Check className="h-4 w-4 text-success" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <button
              onClick={handleAmountClick}
              className={cn(
                'text-right font-semibold tabular-nums min-w-[100px] hover:text-primary transition-colors',
                isIncome && 'text-success'
              )}
            >
              {formatAmount(lineItem.plannedAmount)}
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleStartEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(bucketId, lineItem.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
