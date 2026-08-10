import { useState } from 'react';
import {
  Home, Car, Utensils, Heart, PiggyBank, Wallet, Plus, ChevronDown, ChevronUp,
  Trash2, Edit2, Palette, ShoppingBag, Briefcase, GraduationCap, Plane, Gift,
  Music, Dumbbell, Baby, Dog, Stethoscope, Zap,
} from 'lucide-react';
import { SpendingProgressBar } from './SpendingProgressBar';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import { UpgradeDialog } from './UpgradeDialog';
import { GuestLimitDialog } from './GuestLimitDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSubscription } from '@/hooks/useSubscription';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LineItemRow } from './LineItemRow';
import { useBitcoinPrice, formatSats, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateBucketTotal, calculateBucketTotalSats, calculateBucketTotalUsd } from '@/lib/budgetTypes';
import { lineItemSpentUsd } from '@/lib/budgetSelectors';
import type { Bucket, LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';
import { CATEGORY_PALETTE } from '@/lib/categoryPalette';

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
  isGuest?: boolean;
  onLoginNeeded?: () => void;
}

export function BucketCard({
  bucket, buckets, transactions, currency, merchants = [],
  onUpdateBucket, onDeleteBucket, onAddLineItem, onUpdateLineItem, onDeleteLineItem,
  onViewTransactions,
  isGuest = false,
  onLoginNeeded,
}: BucketCardProps) {
  const { data: priceData } = useBitcoinPrice();
  const { data: subscription } = useSubscription();
  const [isOpen, setIsOpen] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bucket.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Free tier limits
  const MAX_BUCKETS_FREE = 5;
  const MAX_ITEMS_PER_BUCKET_FREE = 4;
  const UNLIMITED_SENTINEL = 999999;
  
  // Get limits from subscription (or defaults for guests)
  const maxBucketsAvailable = isGuest ? MAX_BUCKETS_FREE : (subscription?.buckets ?? MAX_BUCKETS_FREE);
  const maxItemsPerBucket = isGuest ? MAX_ITEMS_PER_BUCKET_FREE : (subscription?.items_per_bucket ?? MAX_ITEMS_PER_BUCKET_FREE);
  const isUnlimitedItems = maxItemsPerBucket >= UNLIMITED_SENTINEL;

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
    return `${formatSats(sats)}`;
  };

  const hasReachedItemLimit = !isUnlimitedItems && bucket.lineItems.length >= maxItemsPerBucket;

  const handleAddItem = () => {
    // Check item limit for this bucket
    if (hasReachedItemLimit) {
      if (isGuest) {
        setShowLoginPrompt(true);
      } else {
        setShowUpgradeDialog(true);
      }
      setIsAddingItem(false);
      setNewItemName('');
      return;
    }

    if (newItemName.trim()) {
      onAddLineItem(bucket.id, newItemName.trim());
      setNewItemName('');
      setIsAddingItem(false);
    }
  };

  const handleSaveName = () => {
    if (editName.trim() && editName !== bucket.name) onUpdateBucket(bucket.id, { name: editName.trim() });
    setIsEditingName(false);
  };

  const handleDeleteConfirmed = () => {
    onDeleteBucket(bucket.id);
    setShowDeleteConfirm(false);
  };

  const usedPct = total > 0 ? Math.round((spent / total) * 100) : 0;
  const overBudget = !bucket.isIncome && spent > total && total > 0;

  return (
    <div className="bh-card bh-tap overflow-hidden flex">
      {/* Left-edge color bar */}
      <div
        className="w-1.5 shrink-0"
        style={{ backgroundColor: bucket.isIncome ? 'hsl(var(--success))' : bucket.color }}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 px-3.5 sm:px-4 pt-3.5 pb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Square icon badge */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0 cursor-pointer touch-target-sm border"
                    style={{
                      backgroundColor: `${bucket.isIncome ? '#7C8F6B' : bucket.color}1f`,
                      borderColor: `${bucket.isIncome ? '#7C8F6B' : bucket.color}55`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: bucket.isIncome ? '#7C8F6B' : bucket.color }} />
                  </div>
                </DropdownMenuTrigger>
                {!bucket.isIncome && (
                  <DropdownMenuContent align="start" className="rounded-md">
                    <DropdownMenuItem onClick={() => setIsEditingName(true)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <div className="flex flex-col gap-2 p-2">
                        <span className="flex items-center text-sm"><Palette className="h-4 w-4 mr-2" /> Color</span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {CATEGORY_PALETTE.map((c) => (
                            <button
                              key={c.value}
                              title={c.name}
                              className={cn('h-6 w-6 rounded-sm transition-transform hover:scale-110', bucket.color === c.value && 'ring-2 ring-offset-1 ring-foreground')}
                              style={{ backgroundColor: c.value }}
                              onClick={(e) => { e.preventDefault(); onUpdateBucket(bucket.id, { color: c.value }); }}
                            />
                          ))}
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Category
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                )}
              </DropdownMenu>

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
                  <h3 className="font-serif text-base sm:text-lg text-foreground break-words leading-tight">{bucket.name}</h3>
                  <p className="bh-caption text-muted-foreground mt-1">
                    {bucket.lineItems.length} {bucket.lineItems.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="text-right">
                <p className={cn(
                  'font-mono text-lg sm:text-xl leading-none whitespace-nowrap',
                  bucket.isIncome ? 'text-[hsl(var(--success))]' : 'text-foreground'
                )}>
                  {currency === 'usd' ? formatAmount(total, true) : `${formatAmount(total, true)}`}
                </p>
                {!bucket.isIncome && total > 0 && (
                  <p className={cn(
                    'bh-caption whitespace-nowrap mt-1',
                    overBudget ? 'text-destructive' : usedPct >= 80 ? 'text-mustard' : 'text-muted-foreground'
                  )}>
                    {overBudget ? 'Over' : `${usedPct}% used`}
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

          <CollapsibleContent>
            <div className="px-3.5 sm:px-4 pb-3.5">
              {!bucket.isIncome && total > 0 && (
                <div className="mb-3 pb-3 divider-soft">
                  <SpendingProgressBar spent={spent} budget={total} showLabel accentColor={bucket.color} />
                </div>
              )}

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

              {isAddingItem ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddItem();
                      if (e.key === 'Escape') { setNewItemName(''); setIsAddingItem(false); }
                    }}
                    placeholder="Line item name…"
                    className="h-10 flex-1"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddItem} className="touch-target-sm">Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setNewItemName(''); setIsAddingItem(false); }} className="touch-target-sm">Cancel</Button>
                </div>
              ) : (
                <button
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 h-10 mt-1 rounded-md border border-dashed text-sm transition-colors touch-target-sm",
                    hasReachedItemLimit
                      ? "border-amber-300 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
                      : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                  )}
                  onClick={() => {
                    if (hasReachedItemLimit) {
                      if (isGuest) {
                        setShowLoginPrompt(true);
                      } else {
                        setShowUpgradeDialog(true);
                      }
                    } else {
                      setIsAddingItem(true);
                    }
                  }}
                >
                  {hasReachedItemLimit ? (
                    <>
                      <Zap className="h-4 w-4" />
                      {isGuest ? 'Sign in to add more items' : `Upgrade for more items (${maxItemsPerBucket}/${maxItemsPerBucket})`}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Add Line Item
                    </>
                  )}
                </button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DeletionConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemType="bucket"
        itemName={bucket.name}
        onConfirm={handleDeleteConfirmed}
      />

      {!isGuest && (
        <UpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          bucketCount={buckets.length}
          maxBucketsForFreeTier={MAX_BUCKETS_FREE}
        />
      )}

      <GuestLimitDialog
        open={showLoginPrompt && isGuest}
        onOpenChange={setShowLoginPrompt}
      />
    </div>
  );
}
