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
  Flame,
  Wind,
  Hammer,
  Palette,
  Trees,
  Lock,
  Package,
  Truck,
  Train,
  Bus,
  Bike,
  Navigation,
  MapPin,
  Hotel,
  ShoppingCart,
  Salad,
  Apple,
  Crown,
  Sparkles,
  Tv,
  Film,
  MessageCircle,
  Waves,
  Map,
  Compass,
  Luggage,
  Backpack,
  Watch,
  Eye,
  Brain,
  Ear,
  Smile,
  Flower2,
  Activity,
  CreditCard,
  Percent,
  BarChart3,
  TrendingDown,
  PieChart,
  Cloud,
  CloudRain,
  Droplet,
  Repeat,
  RefreshCw,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  HelpCircle,
  Settings,
  Search,
  Copy,
  Trash2,
  Edit,
  Plus,
  Minus,
  MapPinOff,
  Glasses,
  DollarSign as DollarSignAlt,
  Radio,
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
  // Housing & Utilities (10+ icons)
  { id: 'home', Icon: Home, label: 'Housing', category: 'Home' },
  { id: 'zap', Icon: Zap, label: 'Electricity', category: 'Home' },
  { id: 'droplets', Icon: Droplets, label: 'Water', category: 'Home' },
  { id: 'wifi', Icon: Wifi, label: 'Internet', category: 'Home' },
  { id: 'wrench', Icon: Wrench, label: 'Maintenance', category: 'Home' },
  { id: 'hammer', Icon: Hammer, label: 'Repairs', category: 'Home' },
  { id: 'palette', Icon: Palette, label: 'Renovations', category: 'Home' },
  { id: 'flame', Icon: Flame, label: 'Heating/Gas', category: 'Home' },
  { id: 'wind', Icon: Wind, label: 'HVAC', category: 'Home' },
  { id: 'lock', Icon: Lock, label: 'Security', category: 'Home' },

  // Transportation (15+ icons)
  { id: 'car', Icon: Car, label: 'Car', category: 'Transport' },
  { id: 'truck', Icon: Truck, label: 'Truck/Van', category: 'Transport' },
  { id: 'train', Icon: Train, label: 'Train', category: 'Transport' },
  { id: 'bus', Icon: Bus, label: 'Bus/Transit', category: 'Transport' },
  { id: 'bike', Icon: Bike, label: 'Bicycle', category: 'Transport' },
  { id: 'smartphone', Icon: Smartphone, label: 'Phone Bill', category: 'Transport' },
  { id: 'navigation', Icon: Navigation, label: 'GPS/Maps', category: 'Transport' },
  { id: 'fuel', Icon: Flame, label: 'Fuel/Gas', category: 'Transport' },
  { id: 'parking', Icon: MapPin, label: 'Parking', category: 'Transport' },
  { id: 'insurance-auto', Icon: AlertCircle, label: 'Auto Insurance', category: 'Transport' },
  { id: 'taxi', Icon: Car, label: 'Taxi/Uber', category: 'Transport' },
  { id: 'tolls', Icon: DollarSign, label: 'Tolls', category: 'Transport' },

  // Food & Dining (15+ icons)
  { id: 'utensils', Icon: Utensils, label: 'Food/Groceries', category: 'Food' },
  { id: 'shopping-cart', Icon: ShoppingCart, label: 'Groceries', category: 'Food' },
  { id: 'coffee', Icon: Coffee, label: 'Coffee', category: 'Food' },
  { id: 'wine', Icon: Wine, label: 'Alcohol', category: 'Food' },
  { id: 'dining', Icon: Utensils, label: 'Dining Out', category: 'Food' },
  { id: 'salad', Icon: Salad, label: 'Healthy Eating', category: 'Food' },
  { id: 'apple', Icon: Apple, label: 'Fruits & Veggies', category: 'Food' },
  { id: 'restaurant', Icon: Coffee, label: 'Restaurant', category: 'Food' },
  { id: 'fast-food', Icon: Package, label: 'Fast Food', category: 'Food' },
  { id: 'delivery', Icon: Truck, label: 'Food Delivery', category: 'Food' },
  { id: 'bakery', Icon: Coffee, label: 'Bakery', category: 'Food' },
  { id: 'snacks', Icon: Apple, label: 'Snacks', category: 'Food' },
  { id: 'meal-prep', Icon: Utensils, label: 'Meal Prep', category: 'Food' },

  // Health & Wellness (15+ icons)
  { id: 'stethoscope', Icon: Stethoscope, label: 'Healthcare', category: 'Health' },
  { id: 'pill', Icon: Pill, label: 'Medications', category: 'Health' },
  { id: 'dumbbell', Icon: Dumbbell, label: 'Fitness', category: 'Health' },
  { id: 'activity', Icon: Activity, label: 'Gym', category: 'Health' },
  { id: 'heart', Icon: Heart, label: 'Mental Health', category: 'Health' },
  { id: 'brain', Icon: Brain, label: 'Therapy', category: 'Health' },
  { id: 'eye', Icon: Eye, label: 'Vision/Optometry', category: 'Health' },
  { id: 'ear', Icon: Ear, label: 'Hearing', category: 'Health' },
  { id: 'smile', Icon: Smile, label: 'Dental', category: 'Health' },
  { id: 'flower', Icon: Flower2, label: 'Wellness', category: 'Health' },
  { id: 'apple-health', Icon: Apple, label: 'Nutrition', category: 'Health' },
  { id: 'medical-supplies', Icon: Package, label: 'Medical Supplies', category: 'Health' },

  // Entertainment & Leisure (20+ icons)
  { id: 'music', Icon: Music, label: 'Music Streaming', category: 'Entertainment' },
  { id: 'gamepad', Icon: Gamepad2, label: 'Games', category: 'Entertainment' },
  { id: 'camera', Icon: Camera, label: 'Photography', category: 'Entertainment' },
  { id: 'headphones', Icon: Headphones, label: 'Audio/Headphones', category: 'Entertainment' },
  { id: 'book', Icon: Book, label: 'Books & Learning', category: 'Entertainment' },
  { id: 'tv', Icon: Tv, label: 'TV/Video Streaming', category: 'Entertainment' },
  { id: 'film', Icon: Film, label: 'Movies', category: 'Entertainment' },
  { id: 'radio', Icon: Radio, label: 'Podcasts', category: 'Entertainment' },
  { id: 'waves', Icon: Waves, label: 'Audiobooks', category: 'Entertainment' },
  { id: 'crown', Icon: Crown, label: 'Premium Services', category: 'Entertainment' },
  { id: 'sparkles', Icon: Sparkles, label: 'Hobbies', category: 'Entertainment' },
  { id: 'event', Icon: Calendar, label: 'Events/Concerts', category: 'Entertainment' },
  { id: 'games-console', Icon: Gamepad2, label: 'Gaming Console', category: 'Entertainment' },
  { id: 'art', Icon: Palette, label: 'Art & Crafts', category: 'Entertainment' },

  // Subscriptions (12+ icons)
  { id: 'repeat', Icon: Repeat, label: 'Subscriptions', category: 'Subscriptions' },
  { id: 'refresh', Icon: RefreshCw, label: 'Memberships', category: 'Subscriptions' },
  { id: 'crown-sub', Icon: Crown, label: 'Premium Tier', category: 'Subscriptions' },
  { id: 'package-sub', Icon: Package, label: 'Package Deal', category: 'Subscriptions' },
  { id: 'calendar-sub', Icon: Calendar, label: 'Annual Plan', category: 'Subscriptions' },
  { id: 'clock-sub', Icon: Clock, label: 'Monthly Plan', category: 'Subscriptions' },
  { id: 'phone-sub', Icon: Smartphone, label: 'Phone Plan', category: 'Subscriptions' },
  { id: 'wifi-sub', Icon: Wifi, label: 'Internet Plan', category: 'Subscriptions' },
  { id: 'music-sub', Icon: Music, label: 'Music Service', category: 'Subscriptions' },
  { id: 'tv-sub', Icon: Tv, label: 'Streaming Service', category: 'Subscriptions' },
  { id: 'cloud-sub', Icon: Cloud, label: 'Cloud Storage', category: 'Subscriptions' },
  { id: 'software-sub', Icon: Settings, label: 'Software License', category: 'Subscriptions' },

  // Shopping & Clothing (15+ icons)
  { id: 'shopping-bag', Icon: ShoppingBag, label: 'Shopping', category: 'Shopping' },
  { id: 'shirt', Icon: Shirt, label: 'Clothing', category: 'Shopping' },
  { id: 'scissors', Icon: Scissors, label: 'Haircut/Salon', category: 'Shopping' },
  { id: 'watch', Icon: Watch, label: 'Accessories', category: 'Shopping' },
  { id: 'glasses', Icon: Glasses, label: 'Glasses/Contacts', category: 'Shopping' },
  { id: 'jewelry', Icon: Crown, label: 'Jewelry', category: 'Shopping' },
  { id: 'perfume', Icon: Sparkles, label: 'Beauty Products', category: 'Shopping' },
  { id: 'makeup', Icon: Smile, label: 'Cosmetics', category: 'Shopping' },
  { id: 'skincare', Icon: Flower2, label: 'Skincare', category: 'Shopping' },
  { id: 'bag', Icon: ShoppingBag, label: 'Bags/Purses', category: 'Shopping' },
  { id: 'shoes', Icon: Heart, label: 'Shoes', category: 'Shopping' },
  { id: 'sporting-goods', Icon: Dumbbell, label: 'Sports Gear', category: 'Shopping' },

  // Family & Lifestyle (15+ icons)
  { id: 'baby', Icon: Baby, label: 'Kids', category: 'Family' },
  { id: 'dog', Icon: Dog, label: 'Pets', category: 'Family' },
  { id: 'heart-family', Icon: Heart, label: 'Lifestyle', category: 'Family' },
  { id: 'gift', Icon: Gift, label: 'Gifts', category: 'Family' },
  { id: 'celebration', Icon: Sparkles, label: 'Celebrations', category: 'Family' },
  { id: 'flower-gift', Icon: Flower2, label: 'Flowers', category: 'Family' },
  { id: 'wedding', Icon: Heart, label: 'Wedding', category: 'Family' },
  { id: 'baby-products', Icon: Baby, label: 'Baby Products', category: 'Family' },
  { id: 'toys', Icon: Gamepad2, label: 'Toys', category: 'Family' },
  { id: 'childcare', Icon: GraduationCap, label: 'Childcare', category: 'Family' },
  { id: 'pet-care', Icon: Dog, label: 'Pet Care', category: 'Family' },
  { id: 'party', Icon: Gift, label: 'Party Supplies', category: 'Family' },

  // Work & Education (12+ icons)
  { id: 'briefcase', Icon: Briefcase, label: 'Work Expenses', category: 'Work' },
  { id: 'graduation-cap', Icon: GraduationCap, label: 'Education', category: 'Work' },
  { id: 'book-work', Icon: Book, label: 'Courses', category: 'Work' },
  { id: 'target-work', Icon: Target, label: 'Professional Dev', category: 'Work' },
  { id: 'laptop', Icon: AlertCircle, label: 'Tech/Software', category: 'Work' },
  { id: 'tools', Icon: Wrench, label: 'Tools', category: 'Work' },
  { id: 'training', Icon: Trophy, label: 'Training', category: 'Work' },
  { id: 'certification', Icon: CheckCircle, label: 'Certifications', category: 'Work' },
  { id: 'conference', Icon: Calendar, label: 'Conferences', category: 'Work' },
  { id: 'networking', Icon: MessageCircle, label: 'Networking', category: 'Work' },

  // Travel (15+ icons)
  { id: 'plane', Icon: Plane, label: 'Flights', category: 'Travel' },
  { id: 'hotel', Icon: Hotel, label: 'Accommodation', category: 'Travel' },
  { id: 'luggage', Icon: Luggage, label: 'Luggage', category: 'Travel' },
  { id: 'backpack', Icon: Backpack, label: 'Travel Gear', category: 'Travel' },
  { id: 'map', Icon: Map, label: 'Tours', category: 'Travel' },
  { id: 'compass', Icon: Compass, label: 'Exploration', category: 'Travel' },
  { id: 'navigation-travel', Icon: Navigation, label: 'Navigation', category: 'Travel' },
  { id: 'camera-travel', Icon: Camera, label: 'Travel Photography', category: 'Travel' },
  { id: 'passport', Icon: MapPin, label: 'Passport/Visas', category: 'Travel' },
  { id: 'travel-insurance', Icon: AlertCircle, label: 'Travel Insurance', category: 'Travel' },
  { id: 'car-rental', Icon: Car, label: 'Car Rental', category: 'Travel' },
  { id: 'activities', Icon: Activity, label: 'Activities', category: 'Travel' },
  { id: 'accommodation-alt', Icon: Home, label: 'Airbnb/Vacation', category: 'Travel' },

  // Financial (15+ icons)
  { id: 'piggy-bank', Icon: PiggyBank, label: 'Savings', category: 'Financial' },
  { id: 'trending-up', Icon: TrendingUp, label: 'Investments', category: 'Financial' },
  { id: 'dollar-sign', Icon: DollarSign, label: 'Debt Payment', category: 'Financial' },
  { id: 'credit-card', Icon: CreditCard, label: 'Credit Card', category: 'Financial' },
  { id: 'percent', Icon: Percent, label: 'Interest/APY', category: 'Financial' },
  { id: 'bar-chart', Icon: BarChart3, label: 'Financial Planning', category: 'Financial' },
  { id: 'pie-chart', Icon: PieChart, label: 'Budget Analysis', category: 'Financial' },
  { id: 'trending-down', Icon: TrendingDown, label: 'Debt Payoff', category: 'Financial' },
  { id: 'wallet-financial', Icon: Wallet, label: 'Money Management', category: 'Financial' },
  { id: 'tax', Icon: AlertCircle, label: 'Taxes', category: 'Financial' },
  { id: 'insurance', Icon: AlertCircle, label: 'Insurance', category: 'Financial' },
  { id: 'retirement', Icon: PiggyBank, label: 'Retirement', category: 'Financial' },

  // General & Catch-all (15+ icons)
  { id: 'wallet', Icon: Wallet, label: 'General', category: 'Other' },
  { id: 'target', Icon: Target, label: 'Goals', category: 'Other' },
  { id: 'lightbulb', Icon: Lightbulb, label: 'Savings Goals', category: 'Other' },
  { id: 'trophy', Icon: Trophy, label: 'Rewards', category: 'Other' },
  { id: 'leaf', Icon: Leaf, label: 'Eco & Green', category: 'Other' },
  { id: 'alert', Icon: AlertCircle, label: 'Emergency Fund', category: 'Other' },
  { id: 'trees', Icon: Trees, label: 'Environment', category: 'Other' },
  { id: 'cloud', Icon: Cloud, label: 'Misc', category: 'Other' },
  { id: 'settings', Icon: Settings, label: 'Adjustments', category: 'Other' },
  { id: 'checkmark', Icon: CheckCircle, label: 'Completed Goals', category: 'Other' },
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
  Subscriptions: '🔄',
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
    'Subscriptions',
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
              🎨 Choose Icon ({filteredIcons.length} options)
            </Label>
            <Input
              id="icon-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons... (e.g., 'food', 'home', 'health', 'subscriptions')"
              className="text-base"
            />

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {categoryOrder.map(
                category =>
                  groupedIcons[category] && (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">
                          {CATEGORY_EMOJIS[category]}
                        </span>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {category}
                        </p>
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          {groupedIcons[category].length}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="grid grid-cols-8 gap-2 mb-1">
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
