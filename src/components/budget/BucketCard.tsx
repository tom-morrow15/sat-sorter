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
import { AddTransactionDialog } from './AddTransactionDialog';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateBucketTotal, calculateBucketTotalSats, calculateBucketTotalUsd } from '@/lib/budgetTypes';
import { lineItemSpentUsd } from '@/lib/budgetSelectors';
import type { Bucket, LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  car: Car,
  utensils: Utensils,
  heart: Heart,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  'shopping-bag': ShoppingBag,
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  plane: Plane,
  gift: Gift,
  music: Music,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  stethoscope: Stethoscope,
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
     date: string;
     description: string;
     amount: number;
     isIncome: boolean;
     bucketId: string | null;
     lineItemId: string | null;
   }) => void;
  onViewTransactions?: (lineItemId: string) => void;
  paymentMethods?: string[];
}

const BUCKET_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#14b8a6', // teal
];

export function BucketCard({
  bucket,
  buckets,
  transactions,
  currency,
  merchants = [],
  onUpdateBucket,
  onDeleteBucket,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onAddTransaction,
  onViewTransactions,
  paymentMethods,
}: BucketCardProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isOpen, setIsOpen] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bucket.name);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const Icon = iconMap[bucket.icon] || Wallet;
   
   // Calculate total in display currency
    const total = currency === 'usd' && priceData
      ? calculateBucketTotalUsd(bucket, priceData.usdPerBtc)
      : (priceData
        ? calculateBucketTotalSats(bucket, priceData.usdPerBtc)
        : calculateBucketTotal(bucket));
    
    // Calculate spent — always USD-anchored, then convert to display currency
    // This ensures spent amounts never shift with the BTC price (the USD amount
    // the user entered is the source of truth).
    let spent: number;
    if (priceData) {
      // Sum each line item's USD-anchored spent amount
      const spentUsd = bucket.lineItems.reduce(
        (sum, item) => sum + lineItemSpentUsd(item.id, transactions, priceData.usdPerBtc),
        0
      );
      if (currency === 'usd') {
        spent = spentUsd;
      } else {
        // Sats mode: convert the USD-anchored spent to sats at current price
        spent = usdToSats(spentUsd, priceData.usdPerBtc);
      }
    } else {
      // No price data: fall back to raw sats
      spent = bucket.lineItems.reduce(
        (sum, item) => sum + item.plannedAmount,
        0
      );
    }

    const formatAmount = (amount: number, compact = false) => {
       if (currency === 'usd') {
         // In USD mode, always display USD format (never use compact notation like M/K)
         return formatUsd(amount);
       }
       const sats = Math.round(amount);
       if (compact && sats >= 1_000_000) {
         return `${(sats / 1_000_000).toFixed(1)}M`;
       }
       if (compact && sats >= 10_000) {
         return `${(sats / 1_000).toFixed(0)}K`;
       }
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

  const handleColorChange = (color: string) => {
    onUpdateBucket(bucket.id, { color });
  };

  const handleDeleteConfirmed = () => {
    onDeleteBucket(bucket.id);
    setShowDeleteConfirm(false);
  };

   return (
     <Card
        className={cn(
          'overflow-hidden card-interactive press-feedback border-0 shadow-sm hover:shadow-md transition-all duration-300',
          'bg-gradient-to-br from-white to-neutral-50',
          'dark:from-neutral-900/50 dark:to-neutral-950/50',
          'dark:border-neutral-800/50',
          bucket.isIncome && 'ring-1 ring-success/20'
        )}
     >
       <Collapsible open={isOpen} onOpenChange={setIsOpen}>
         <CardHeader className="pb-3 pt-6 px-6">
           <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Icon with refined styling — clicking opens the menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-105 cursor-pointer"
                      style={{ 
                        backgroundColor: `${bucket.color}15`,
                        border: `2px solid ${bucket.color}30`
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: bucket.color }} />
                    </div>
                  </DropdownMenuTrigger>
                  {!bucket.isIncome && (
                    <DropdownMenuContent align="start">
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
                                  'h-5 w-5 rounded-full transition-transform hover:scale-110',
                                  bucket.color === color && 'ring-2 ring-offset-2 ring-primary'
                                )}
                                style={{ backgroundColor: color }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleColorChange(color);
                                }}
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

                {/* Bucket name and info */}
                {isEditingName ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setEditName(bucket.name);
                        setIsEditingName(false);
                      }
                    }}
                    className="h-9 px-3 font-semibold"
                    autoFocus
                  />
                 ) : (
                   <div className="min-w-0 flex-1">
                     <h3 className="font-semibold text-base sm:text-lg text-foreground break-words leading-tight">{bucket.name}</h3>
                     <p className="text-xs sm:text-sm text-muted-foreground">
                       {bucket.lineItems.length} item{bucket.lineItems.length !== 1 ? 's' : ''} • ${(total || 0).toFixed(2)}
                     </p>
                   </div>
                 )}
              </div>

               <div className="flex items-center gap-2 flex-shrink-0">
                 {/* Total - right aligned, prominent, never truncated */}
                 <div className="text-right min-w-0">
                   <p
                     className={cn(
                       'font-bold tabular-nums text-lg sm:text-2xl leading-tight whitespace-nowrap',
                       bucket.isIncome ? 'text-success' : 'text-foreground'
                     )}
                   >
                     {formatAmount(total, true)}
                   </p>
                    <p className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      spent > total * 0.8 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                    )}>
                      {spent > total ? '⚠ Over' : `${Math.round((spent / total) * 100)}% used`}
                    </p>
                 </div>

               {/* Collapse toggle — moved to the rightmost position */}
               <CollapsibleTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-8 w-8">
                   {isOpen ? (
                     <ChevronUp className="h-4 w-4" />
                   ) : (
                     <ChevronDown className="h-4 w-4" />
                   )}
                 </Button>
               </CollapsibleTrigger>
             </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {/* Progress bar for expenses */}
            {!bucket.isIncome && total > 0 && (
              <div className="mb-4 pb-4 border-b">
                <SpendingProgressBar spent={spent} budget={total} showLabel={true} />
              </div>
            )}

            {/* Line items */}
            <div className="space-y-1">
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

             {/* Add new item / transaction buttons */}
             {isAddingItem ? (
               <div className="flex items-center gap-2 mt-3 px-4">
                 <Input
                   value={newItemName}
                   onChange={(e) => setNewItemName(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handleAddItem();
                     if (e.key === 'Escape') {
                       setNewItemName('');
                       setIsAddingItem(false);
                     }
                   }}
                   placeholder="Line item name..."
                   className="h-8 flex-1"
                   autoFocus
                 />
                 <Button size="sm" onClick={handleAddItem}>
                   Add
                 </Button>
                 <Button
                   size="sm"
                   variant="ghost"
                   onClick={() => {
                     setNewItemName('');
                     setIsAddingItem(false);
                   }}
                 >
                   Cancel
                 </Button>
               </div>
              ) : (
                <div className="flex gap-2 mt-3 px-4 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIsAddingItem(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line Item
                  </Button>
                </div>
              )}

              {/* Add Transaction — prominent primary action */}
              {!isAddingItem && (
                <div className="px-4 pb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center border-dashed hover:border-solid hover:bg-primary/5 hover:text-primary transition-all press-feedback"
                    onClick={() => setShowTransactionDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Transaction
                  </Button>
                </div>
              )}

               {/* Add Transaction Dialog */}
               <AddTransactionDialog
                 open={showTransactionDialog}
                 onOpenChange={setShowTransactionDialog}
                 buckets={buckets || []}
                 defaultBucketId={bucket.id}
                 currency={currency}
                 isIncome={bucket.isIncome}
                 onSave={(transaction) => onAddTransaction?.(transaction)}
                 paymentMethods={paymentMethods}
               />
            </CardContent>
         </CollapsibleContent>
       </Collapsible>

       {/* Deletion confirmation dialog */}
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
