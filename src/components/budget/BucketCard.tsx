import { useState } from 'react';
import {
  Home,
  Car,
  Utensils,
  Heart,
  PiggyBank,
  Wallet,
  Plus,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  Edit2,
  Palette,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Plane,
  Gift,
  Music,
  Dumbbell,
  Baby,
  Dog,
  Stethoscope,
} from 'lucide-react';
import { SpendingProgressBar } from './SpendingProgressBar';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { LineItemRow } from './LineItemRow';
import { useAddTransaction } from './AddTransactionProvider';
import { useBitcoinPrice, formatSats, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateBucketTotal, calculateBucketTotalSats, calculateBucketTotalUsd } from '@/lib/budgetTypes';
import { lineItemSpentUsd } from '@/lib/budgetSelectors';
import type { Bucket, LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home, car: Car, utensils: Utensils, heart: Heart, 'piggy-bank': PiggyBank,
  wallet: Wallet, 'shopping-bag': ShoppingBag, briefcase: Briefcase,
  'graduation-cap': GraduationCap, plane: Plane, gift: Gift, music: Music,
  dumbbell: Dumbbell, baby: Baby, dog: Dog, stethoscope: Stethoscope,
};

interface BucketCardProps {
  bucket: Bucket;
  buckets: Bucket[];
  transactions: Transaction[];
  currency: 'sats' | 'usd';
  merchants?: (BTCMapElement & { distance: number })[];
  onUpdateBucket: (bucketId: string, updates: Partial<Bucket>) => void;
  onDeleteBucket: (bucketId: string) => void;
  onAddLineItem: (bucketId: string, name: string) => void;
  onUpdateLineItem: (bucketId: string, lineItemId: string, updates: Partial<LineItem>) => void;
  onDeleteLineItem: (bucketId: string, lineItemId: string) => void;
  onAddTransaction?: (transaction: {
    date: string; description: string; amount: number; isIncome: boolean;
    bucketId: string | null; lineItemId: string | null;
  }) => void;
  onViewTransactions?: (lineItemId: string) => void;
  paymentMethods?: string[];
}

const BUCKET_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4',
  '#f97316', '#6366f1', '#84cc16', '#14b8a6',
];

export function BucketCard({
  bucket, buckets, transactions, currency, merchants = [],
  onUpdateBucket, onDeleteBucket, onAddLineItem, onUpdateLineItem, onDeleteLineItem,
  onAddTransaction, onViewTransactions, paymentMethods,
}: BucketCardProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isOpen, setIsOpen] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bucket.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const Icon = iconMap[bucket.icon] || Wallet;

  const total = currency === 'usd' && priceData
    ? calculateBucketTotalUsd(bucket, priceData.usdPerBtc)
    : (priceData ? calculateBucketTotalSats(bucket, priceData.usdPerBtc) : calculateBucketTotal(bucket));

  let spent: number;
  if (priceData) {
    const spentUsd = bucket.lineItems.reduce(
      (sum, item) => sum + lineItemSpentUsd(item.id, transactions, priceData.usdPerBtc), 0
    );
    spent = currency === 'usd' ? spentUsd : usdToSats(spentUsd, priceData.usdPerBtc);
  } else {
    spent = bucket.lineItems.reduce((sum, item) => sum + item.plannedAmount, 0);
  }

  const formatAmount = (amount: number, compact = false) => {
    if (currency === 'usd') return formatUsd(amount);
    const sats = Math.round(amount);
    if (compact && sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
    if (compact && sats >= 10_000) return `${(sats / 1_000).toFixed(0)}K`;
    return `${formatSats(sats)} sats`;
  };

  const handleAddItem = () => {
    if (newItemName.trim()) {
      onAddLineItem(bucket.id, newItemName.trim());
      setNewItemName('');
      setIsAddingItem(false);
    }
  };

  const handleSaveName = () => {
    if (editName.trim() && editName !== bucket.name) {
      onUpdateBucket(bucket.id, { name: editName.trim() });
    }
    setIsEditingName(false);
  };

  const handleDeleteConfirmed = () => {
    onDeleteBucket(bucket.id);
    setShowDeleteConfirm(false);
  };

  return (
    <Card className={cn(
      'overflow-hidden card-interactive press-feedback border-border/40',
      bucket.isIncome && 'ring-1 ring-success/15'
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Icon — opens settings menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 cursor-pointer touch-target-sm"
                    style={{
                      backgroundColor: `${bucket.color}10`,
                      border: `1.5px solid ${bucket.color}25`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: bucket.color }} />
                  </div>
                </DropdownMenuTrigger>
                {!bucket.isIncome && (
                  <DropdownMenuContent align="start" className="rounded-2xl">
                    <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <div className="flex flex-col gap-2 p-2">
                        <span className="flex items-center text-sm">
                          <Palette className="h-4 w-4 mr-2" />
                          Color
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {BUCKET_COLORS.map((color) => (
                            <button
                              key={color}
                              className={cn(
                                'h-5 w-5 rounded-full transition-transform hover:scale-110 touch-target-sm',
                                bucket.color === color && 'ring-2 ring-offset-2 ring-primary'
                              )}
                              style={{ backgroundColor: color }}
                              onClick={(e) => { e.preventDefault(); onUpdateBucket(bucket.id, { color }); }}
                            />
                          ))}
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Bucket
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>

              {/* Name + info */}
              {isEditingName ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') { setEditName(bucket.name); setIsEditingName(false); }
                  }}
                  className="h-9 px-3"
                  autoFocus
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif-display text-base sm:text-lg text-foreground break-words leading-tight">
                    {bucket.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bucket.lineItems.length} item{bucket.lineItems.length !== 1 ? 's' : ''}
                    {total > 0 && ` · ${formatAmount(total, true)}`}
                  </p>
                </div>
              )}
            </div>

            {/* Total + collapse */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right">
                <p className={cn(
                  'font-serif-display tabular-nums text-base sm:text-xl leading-tight whitespace-nowrap',
                  bucket.isIncome ? 'text-success' : 'text-foreground'
                )}>
                  {formatAmount(total, true)}
                </p>
                {!bucket.isIncome && total > 0 && (
                  <p className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    spent > total ? 'text-destructive' : spent > total * 0.8 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                  )}>
                    {spent > total ? '⚠ Over' : `${Math.round((spent / total) * 100)}% used`}
                  </p>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 touch-target-sm text-muted-foreground">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 sm:px-5">
            {/* Progress bar */}
            {!bucket.isIncome && total > 0 && (
              <div className="mb-3 pb-3 border-b border-border/30">
                <SpendingProgressBar spent={spent} budget={total} showLabel={true} />
              </div>
            )}

            {/* Line items — flush list */}
            <div className="space-y-0">
              {bucket.lineItems
                .sort((a, b) => a.order - b.order)
                .map((lineItem) => (
                  <LineItemRow
                    key={lineItem.id}
                    lineItem={lineItem}
                    bucketId={bucket.id}
                    bucketColor={bucket.color}
                    transactions={transactions}
                    currency={currency}
                    isIncome={bucket.isIncome}
                    merchants={merchants}
                    onUpdate={onUpdateLineItem}
                    onDelete={onDeleteLineItem}
                    onViewTransactions={onViewTransactions}
                  />
                ))}
            </div>

            {/* Add line item */}
            {isAddingItem ? (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem();
                    if (e.key === 'Escape') { setNewItemName(''); setIsAddingItem(false); }
                  }}
                  placeholder="Line item name..."
                  className="h-10 flex-1"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddItem} className="touch-target-sm">Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNewItemName(''); setIsAddingItem(false); }} className="touch-target-sm">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all press-feedback touch-target-sm mt-1"
                onClick={() => setIsAddingItem(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Line Item
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <DeletionConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemType="bucket"
        itemName={bucket.name}
        onConfirm={handleDeleteConfirmed}
      />
    </Card>
  );
}
