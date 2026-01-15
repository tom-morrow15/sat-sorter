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
  Church,
  Maximize2,
  AlertCircle,
  CreditCard,
  Zap,
  Smartphone,
  Wifi,
  MapPin,
  Ticket,
  Gamepad2,
  BookOpen,
  Leaf,
  Droplet,
  Flame,
  Wrench,
  TreePine,
  Eye,
  TrendingUp,
  TrendingDown,
  PawPrint,
  Trophy,
  Target,
  Watch,
  Headphones,
  Sun,
  Cloud,
  Sparkles,
  Lock,
  Coffee,
  Wine,
  Pizza,
  Apple,
  Bike,
} from 'lucide-react';
import { SpendingProgressBar } from './SpendingProgressBar';
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
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import { calculateBucketTotal, calculateSpentForBucket, calculateBucketTotalForDisplay } from '@/lib/budgetTypes';
import type { Bucket, LineItem, Transaction } from '@/lib/budgetTypes';
import type { BTCMapElement } from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

// Complete icon map matching all icons available in AddBucketDialog
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Housing & Utilities
  home: Home,
  maximize: Maximize2,
  zap: Zap,
  droplet: Droplet,
  wifi: Wifi,
  wrench: Wrench,
  flame: Flame,

  // Transportation
  car: Car,
  bike: Bike,
  'map-pin': MapPin,
  ticket: Ticket,

  // Food & Dining
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  apple: Apple,
  wine: Wine,

  // Shopping
  'shopping-bag': ShoppingBag,
  palette: Palette,
  watch: Watch,

  // Technology & Electronics
  smartphone: Smartphone,
  headphones: Headphones,
  eye: Eye,

  // Financial
  wallet: Wallet,
  'credit-card': CreditCard,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'piggy-bank': PiggyBank,

  // Entertainment
  music: Music,
  gamepad: Gamepad2,
  film: Ticket,
  sparkles: Sparkles,

  // Health & Wellness
  stethoscope: Stethoscope,
  heart: Heart,
  dumbbell: Dumbbell,

  // Education
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  scroll: Leaf, // Using Leaf as fallback since Scroll might not be available

  // Travel & Vacation
  plane: Plane,
  'tree-pine': TreePine,
  sun: Sun,

  // Personal Services
  lock: Lock,
  briefcase: Briefcase,

  // Family & Kids
  baby: Baby,
  'paw-print': PawPrint,
  dog: Dog,

  // Giving & Donations
  church: Church,
  gift: Gift,

  // Subscriptions & Services
  cloud: Cloud,
  alert: AlertCircle,
  lightning: Zap,

  // Goals & Tracking
  target: Target,
  trophy: Trophy,
};

interface BucketCardProps {
  bucket: Bucket;
  transactions: Transaction[];
  currency: 'sats' | 'usd';
  merchants?: (BTCMapElement & { distance: number })[];
  onUpdateBucket: (bucketId: string, updates: Partial<Bucket>) => void;
  onDeleteBucket: (bucketId: string) => void;
  onAddLineItem: (bucketId: string, name: string) => void;
  onUpdateLineItem: (bucketId: string, lineItemId: string, updates: Partial<LineItem>) => void;
  onDeleteLineItem: (bucketId: string, lineItemId: string) => void;
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
  transactions,
  currency,
  merchants = [],
  onUpdateBucket,
  onDeleteBucket,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
}: BucketCardProps) {
  const { data: priceData } = useBitcoinPrice();
  const [isOpen, setIsOpen] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bucket.name);

  const Icon = iconMap[bucket.icon] || Wallet;
  const total = calculateBucketTotal(bucket);
  const spent = calculateSpentForBucket(bucket, transactions);

  // Get display totals that respect stored USD amounts
  const displayTotals = priceData ? calculateBucketTotalForDisplay(bucket, priceData.usdPerBtc, currency) : { sats: total, usd: 0 };

  const formatAmount = (sats: number, compact = false, lineItem?: LineItem) => {
    if (currency === 'usd' && priceData) {
      // Use stored USD amount if available (preserves original USD input)
      if (lineItem?.usdAmount !== undefined) {
        return formatUsd(lineItem.usdAmount);
      }
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
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

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200 hover-lift',
        bucket.isIncome && 'ring-2 ring-success/30'
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Icon with color - smaller on mobile */}
              <div
                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${bucket.color}20` }}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: bucket.color }} />
              </div>

              {/* Bucket name */}
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
                  className="h-8 w-40 font-semibold"
                  autoFocus
                />
              ) : (
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">{bucket.name}</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {bucket.lineItems.length} item{bucket.lineItems.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Total - compact on mobile */}
              <div className="text-right">
                <p
                  className={cn(
                    'font-bold tabular-nums text-sm sm:text-base',
                    bucket.isIncome && 'text-success'
                  )}
                >
                  {currency === 'usd' && priceData ? (
                    <>
                      <span className="sm:hidden">{formatUsd(displayTotals.usd)}</span>
                      <span className="hidden sm:inline">{formatUsd(displayTotals.usd)}</span>
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">{formatAmount(total, true)}</span>
                      <span className="hidden sm:inline">{formatAmount(total)}</span>
                    </>
                  )}
                </p>
                {!bucket.isIncome && total > 0 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
                    <span className="sm:hidden">{formatAmount(spent, true)} spent</span>
                    <span className="hidden sm:inline">{formatAmount(spent)} spent</span>
                  </p>
                )}
              </div>

              {/* Actions menu */}
              {!bucket.isIncome && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
                      onClick={() => onDeleteBucket(bucket.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Bucket
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Collapse toggle */}
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
                  />
                ))}
            </div>

            {/* Add new item */}
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
                  placeholder="Item name..."
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 ml-4 text-muted-foreground hover:text-foreground"
                onClick={() => setIsAddingItem(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
