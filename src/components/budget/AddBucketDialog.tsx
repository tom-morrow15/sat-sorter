import { useState } from 'react';
import {
  Home,
  Car,
  Utensils,
  Heart,
  PiggyBank,
  Wallet,
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
  Zap,
  Droplets,
  Wifi,
  Smartphone,
  Coffee,
  Leaf,
  TrendingUp,
  DollarSign,
  Target,
  Trophy,
  Lightbulb,
  Wine,
  Pill,
  Gamepad2,
  Book,
  Camera,
  Headphones,
  Shirt,
  Scissors,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AddBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, color: string, icon: string) => void;
}

interface IconOption {
  id: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  category: string;
}

const ICONS: IconOption[] = [
  // Housing & Utilities
  { id: 'home', Icon: Home, label: 'Housing', category: 'Home' },
  { id: 'zap', Icon: Zap, label: 'Electricity', category: 'Home' },
  { id: 'droplets', Icon: Droplets, label: 'Water', category: 'Home' },
  { id: 'wifi', Icon: Wifi, label: 'Internet', category: 'Home' },
  { id: 'wrench', Icon: Wrench, label: 'Maintenance', category: 'Home' },
  
  // Transportation
  { id: 'car', Icon: Car, label: 'Transportation', category: 'Transport' },
  { id: 'smartphone', Icon: Smartphone, label: 'Phone Bill', category: 'Transport' },
  
  // Food & Dining
  { id: 'utensils', Icon: Utensils, label: 'Food', category: 'Food' },
  { id: 'coffee', Icon: Coffee, label: 'Coffee & Tea', category: 'Food' },
  { id: 'wine', Icon: Wine, label: 'Dining Out', category: 'Food' },
  
  // Health & Wellness
  { id: 'stethoscope', Icon: Stethoscope, label: 'Healthcare', category: 'Health' },
  { id: 'pill', Icon: Pill, label: 'Medications', category: 'Health' },
  { id: 'dumbbell', Icon: Dumbbell, label: 'Fitness', category: 'Health' },
  
  // Entertainment & Leisure
  { id: 'music', Icon: Music, label: 'Music & Streaming', category: 'Entertainment' },
  { id: 'gamepad', Icon: Gamepad2, label: 'Games', category: 'Entertainment' },
  { id: 'camera', Icon: Camera, label: 'Photography', category: 'Entertainment' },
  { id: 'headphones', Icon: Headphones, label: 'Audio', category: 'Entertainment' },
  { id: 'book', Icon: Book, label: 'Books & Learning', category: 'Entertainment' },
  
  // Shopping & Clothing
  { id: 'shopping-bag', Icon: ShoppingBag, label: 'Shopping', category: 'Shopping' },
  { id: 'shirt', Icon: Shirt, label: 'Clothing', category: 'Shopping' },
  { id: 'scissors', Icon: Scissors, label: 'Haircut', category: 'Shopping' },
  
  // Family & Lifestyle
  { id: 'baby', Icon: Baby, label: 'Kids', category: 'Family' },
  { id: 'dog', Icon: Dog, label: 'Pets', category: 'Family' },
  { id: 'heart', Icon: Heart, label: 'Lifestyle', category: 'Family' },
  { id: 'gift', Icon: Gift, label: 'Gifts', category: 'Family' },
  
  // Work & Education
  { id: 'briefcase', Icon: Briefcase, label: 'Work Expenses', category: 'Work' },
  { id: 'graduation-cap', Icon: GraduationCap, label: 'Education', category: 'Work' },
  
  // Travel
  { id: 'plane', Icon: Plane, label: 'Travel', category: 'Travel' },
  
  // Financial
  { id: 'piggy-bank', Icon: PiggyBank, label: 'Savings', category: 'Financial' },
  { id: 'trending-up', Icon: TrendingUp, label: 'Investments', category: 'Financial' },
  { id: 'dollar-sign', Icon: DollarSign, label: 'Debt Payment', category: 'Financial' },
  
  // General & Catch-all
  { id: 'wallet', Icon: Wallet, label: 'General', category: 'Other' },
  { id: 'target', Icon: Target, label: 'Goals', category: 'Other' },
  { id: 'lightbulb', Icon: Lightbulb, label: 'Savings Goal', category: 'Other' },
  { id: 'trophy', Icon: Trophy, label: 'Rewards', category: 'Other' },
  { id: 'leaf', Icon: Leaf, label: 'Eco & Green', category: 'Other' },
  { id: 'alert', Icon: AlertCircle, label: 'Emergency', category: 'Other' },
];

const COLORS = [
  // Primary palette
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  
  // Secondary palette
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#84cc16', // lime
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#d946ef', // fuchsia
  '#a855f7', // purple
  
  // Tertiary palette
  '#dc2626', // dark red
  '#ea580c', // dark orange
  '#ca8a04', // dark amber
  '#16a34a', // dark green
  '#0891b2', // dark cyan
  '#1d4ed8', // dark blue
  '#7c3aed', // dark violet
  '#be185d', // dark pink
];

const CATEGORY_EMOJIS: Record<string, string> = {
  Home: '🏠',
  Transport: '🚗',
  Food: '🍽️',
  Health: '⚕️',
  Entertainment: '🎮',
  Shopping: '🛍️',
  Family: '👨‍👩‍👧‍👦',
  Work: '💼',
  Travel: '✈️',
  Financial: '💰',
  Other: '📋',
};

export function AddBucketDialog({
  open,
  onOpenChange,
  onAdd,
}: AddBucketDialogProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('wallet');
  const [selectedColor, setSelectedColor] = useState(COLORS[5]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), selectedColor, selectedIcon);
      setName('');
      setSelectedIcon('wallet');
      setSelectedColor(COLORS[5]);
      setSearchQuery('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedIcon('wallet');
    setSelectedColor(COLORS[5]);
    setSearchQuery('');
    onOpenChange(false);
  };

  // Filter icons based on search
  const filteredIcons = ICONS.filter(
    icon =>
      icon.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group icons by category
  const groupedIcons = filteredIcons.reduce(
    (acc, icon) => {
      if (!acc[icon.category]) {
        acc[icon.category] = [];
      }
      acc[icon.category].push(icon);
      return acc;
    },
    {} as Record<string, IconOption[]>
  );

  const categoryOrder = [
    'Home',
    'Transport',
    'Food',
    'Health',
    'Entertainment',
    'Shopping',
    'Family',
    'Work',
    'Travel',
    'Financial',
    'Other',
  ];

  const selectedIconData = ICONS.find(i => i.id === selectedIcon);
  const selectedCategory = selectedIconData?.category || 'Other';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            ✨ Create Budget Category
          </DialogTitle>
          <DialogDescription>
            Give every dollar a home. Choose a name, icon, and color.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="bucket-name" className="text-base font-semibold">
              📝 Category Name
            </Label>
            <Input
              id="bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Entertainment, Insurance, Coffee..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              autoFocus
              className="text-base"
            />
          </div>

          {/* Icon selection with search */}
          <div className="space-y-3">
            <Label htmlFor="icon-search" className="text-base font-semibold">
              🎨 Choose Icon
            </Label>
            <Input
              id="icon-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons... (e.g., 'food', 'home', 'health')"
              className="text-base"
            />

            <div className="space-y-4">
              {categoryOrder.map(
                category =>
                  groupedIcons[category] && (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {CATEGORY_EMOJIS[category]}
                        </span>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {category}
                        </p>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="grid grid-cols-8 gap-2">
                        {groupedIcons[category].map(({ id, Icon, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedIcon(id)}
                            title={label}
                            className={cn(
                              'h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-200 relative group',
                              selectedIcon === id
                                ? 'ring-2 ring-offset-2 scale-110'
                                : 'hover:scale-105 hover:bg-muted'
                            )}
                            style={{
                              backgroundColor:
                                selectedIcon === id
                                  ? `${selectedColor}20`
                                  : undefined,
                              borderColor:
                                selectedIcon === id ? selectedColor : undefined,
                            }}
                          >
                            <Icon
                              className="h-5 w-5"
                              style={{
                                color:
                                  selectedIcon === id
                                    ? selectedColor
                                    : undefined,
                              }}
                            />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              {label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>
          </div>

          {/* Color selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">🎯 Choose Color</Label>
            <div className="grid grid-cols-8 gap-3">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    'h-10 w-10 rounded-full transition-all duration-200 hover:scale-110',
                    selectedColor === color && 'ring-2 ring-offset-2 scale-110'
                  )}
                  style={{
                    backgroundColor: color,
                    ringColor: selectedColor === color ? color : undefined,
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-5 rounded-lg bg-gradient-to-br from-muted/50 to-muted border-2 border-dashed">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              👀 Live Preview
            </p>
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-lg flex items-center justify-center shadow-lg transform transition-transform hover:scale-105"
                style={{ backgroundColor: `${selectedColor}20` }}
              >
                {(() => {
                  const IconComponent =
                    ICONS.find(i => i.id === selectedIcon)?.Icon || Wallet;
                  return (
                    <IconComponent
                      className="h-7 w-7"
                      style={{ color: selectedColor }}
                    />
                  );
                })()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {name || 'Your Category Name'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedIconData?.label || 'Select an icon'} • 0 items
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            ✨ Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
