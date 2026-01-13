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
  Church,
  Maximize2,
  AlertCircle,
  CreditCard,
  Zap,
  Volume2,
  Smartphone,
  Wifi,
  MapPin,
  Plane as Flight,
  Ticket,
  Gamepad2,
  BookOpen,
  Leaf,
  Droplet,
  Flame,
  Wrench,
  Palette,
  Scroll,
  TreePine,
  Bike,
  Zap as Lightning,
  Eye,
  TrendingUp,
  TrendingDown,
  PawPrint,
  LogOut,
  Trophy,
  Target,
  Smartphone as Phone,
  Watch,
  Headphones,
  Sun,
  Cloud,
  Sparkles,
  Lock,
  Unlock,
  Coffee,
  Wine,
  Pizza,
  Apple,
  Bike as Bicycle,
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

const ICONS = [
  // Housing & Utilities
  { id: 'home', Icon: Home, label: 'Home' },
  { id: 'maximize', Icon: Maximize2, label: 'Rent/Mortgage' },
  { id: 'zap', Icon: Zap, label: 'Electricity' },
  { id: 'droplet', Icon: Droplet, label: 'Water' },
  { id: 'wifi', Icon: Wifi, label: 'Internet/Telecom' },
  { id: 'wrench', Icon: Wrench, label: 'Maintenance' },
  { id: 'flame', Icon: Flame, label: 'Gas/Heat' },

  // Transportation
  { id: 'car', Icon: Car, label: 'Car/Gas' },
  { id: 'bike', Icon: Bicycle, label: 'Cycling' },
  { id: 'map-pin', Icon: MapPin, label: 'Ride Share' },
  { id: 'ticket', Icon: Ticket, label: 'Public Transport' },

  // Food & Dining
  { id: 'utensils', Icon: Utensils, label: 'Restaurants' },
  { id: 'coffee', Icon: Coffee, label: 'Coffee/Cafe' },
  { id: 'pizza', Icon: Pizza, label: 'Groceries' },
  { id: 'apple', Icon: Apple, label: 'Produce' },
  { id: 'wine', Icon: Wine, label: 'Beverages' },

  // Shopping
  { id: 'shopping-bag', Icon: ShoppingBag, label: 'Shopping' },
  { id: 'palette', Icon: Palette, label: 'Clothing' },
  { id: 'watch', Icon: Watch, label: 'Accessories' },

  // Technology & Electronics
  { id: 'smartphone', Icon: Smartphone, label: 'Phone/Tech' },
  { id: 'headphones', Icon: Headphones, label: 'Audio/Headphones' },
  { id: 'eye', Icon: Eye, label: 'Displays/Screens' },

  // Financial
  { id: 'wallet', Icon: Wallet, label: 'General Spending' },
  { id: 'credit-card', Icon: CreditCard, label: 'Payments/Credit' },
  { id: 'trending-up', Icon: TrendingUp, label: 'Investments' },
  { id: 'trending-down', Icon: TrendingDown, label: 'Losses' },
  { id: 'piggy-bank', Icon: PiggyBank, label: 'Savings' },

  // Entertainment
  { id: 'music', Icon: Music, label: 'Music/Streaming' },
  { id: 'gamepad', Icon: Gamepad2, label: 'Gaming' },
  { id: 'film', Icon: Ticket, label: 'Movies/Film' },
  { id: 'sparkles', Icon: Sparkles, label: 'Entertainment' },

  // Health & Wellness
  { id: 'stethoscope', Icon: Stethoscope, label: 'Medical/Doctor' },
  { id: 'heart', Icon: Heart, label: 'Health/Wellness' },
  { id: 'dumbbell', Icon: Dumbbell, label: 'Fitness/Gym' },

  // Education
  { id: 'graduation-cap', Icon: GraduationCap, label: 'Education' },
  { id: 'book-open', Icon: BookOpen, label: 'Books/Learning' },
  { id: 'scroll', Icon: Scroll, label: 'Courses' },

  // Travel & Vacation
  { id: 'plane', Icon: Flight, label: 'Flights/Travel' },
  { id: 'tree-pine', Icon: TreePine, label: 'Vacation/Hotels' },
  { id: 'sun', Icon: Sun, label: 'Recreation' },

  // Personal Services
  { id: 'lock', Icon: Lock, label: 'Insurance' },
  { id: 'briefcase', Icon: Briefcase, label: 'Work/Business' },

  // Family & Kids
  { id: 'baby', Icon: Baby, label: 'Kids/Daycare' },
  { id: 'paw-print', Icon: PawPrint, label: 'Pets' },

  // Giving & Donations
  { id: 'church', Icon: Church, label: 'Charity/Donations' },
  { id: 'gift', Icon: Gift, label: 'Gifts/Giving' },

  // Subscriptions & Services
  { id: 'cloud', Icon: Cloud, label: 'Cloud Services' },
  { id: 'alert', Icon: AlertCircle, label: 'Subscriptions' },
  { id: 'lightning', Icon: Lightning, label: 'Utilities' },

  // Goals & Tracking
  { id: 'target', Icon: Target, label: 'Goals' },
  { id: 'trophy', Icon: Trophy, label: 'Achievements' },
];

const COLORS = [
  // Greens
  '#22c55e', // emerald
  '#10b981', // emerald-600
  '#059669', // emerald-700
  '#84cc16', // lime
  '#65a30d', // lime-600
  '#16a34a', // green-600
  '#15803d', // green-700
  '#14b8a6', // teal
  '#0d9488', // teal-600

  // Blues
  '#3b82f6', // blue
  '#2563eb', // blue-600
  '#1d4ed8', // blue-700
  '#06b6d4', // cyan
  '#0891b2', // cyan-600
  '#0369a1', // sky-600
  '#0ea5e9', // sky
  '#1e40af', // indigo-800

  // Purples & Violets
  '#8b5cf6', // violet
  '#7c3aed', // violet-600
  '#6d28d9', // violet-700
  '#a855f7', // fuchsia
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#db2777', // pink-600
  '#be185d', // pink-700

  // Reds & Oranges
  '#ef4444', // red
  '#dc2626', // red-600
  '#b91c1c', // red-700
  '#f97316', // orange
  '#ea580c', // orange-600
  '#c2410c', // orange-700
  '#f87171', // red-400
  '#fb923c', // orange-400

  // Yellows & Ambers
  '#f59e0b', // amber
  '#d97706', // amber-600
  '#b45309', // amber-700
  '#fbbf24', // amber-400
  '#fcd34d', // amber-300
  '#eab308', // yellow
  '#ca8a04', // yellow-600

  // Neutrals & Grays
  '#64748b', // slate
  '#475569', // slate-600
  '#1e293b', // slate-800
  '#6b7280', // gray-500
  '#374151', // gray-700
  '#9ca3af', // gray-400

  // Additional vibrants for diversity
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#e11d48', // rose-600
  '#be123c', // rose-700
];

export function AddBucketDialog({
  open,
  onOpenChange,
  onAdd,
}: AddBucketDialogProps) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('wallet');
  const [selectedColor, setSelectedColor] = useState(COLORS[1]);

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), selectedColor, selectedIcon);
      setName('');
      setSelectedIcon('wallet');
      setSelectedColor(COLORS[1]);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedIcon('wallet');
    setSelectedColor(COLORS[1]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Budget Category</DialogTitle>
          <DialogDescription>
            Create a new category to organize your expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Category Name</Label>
            <Input
              id="bucket-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Entertainment, Insurance..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              autoFocus
            />
          </div>

          {/* Icon selection */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-2 bg-muted/20">
              <div className="grid grid-cols-10 gap-1">
                {ICONS.map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    title={label}
                    className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center transition-all',
                      selectedIcon === id
                        ? 'ring-2 ring-primary ring-offset-1'
                        : 'hover:bg-muted'
                    )}
                    style={{
                      backgroundColor:
                        selectedIcon === id ? `${selectedColor}20` : undefined,
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color: selectedIcon === id ? selectedColor : undefined,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color selection */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-muted/20">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      'h-8 w-8 rounded-full transition-transform hover:scale-110',
                      selectedColor === color && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedColor}20` }}
              >
                {(() => {
                  const IconComponent = ICONS.find(i => i.id === selectedIcon)?.Icon || Wallet;
                  return <IconComponent className="h-5 w-5" style={{ color: selectedColor }} />;
                })()}
              </div>
              <div>
                <p className="font-semibold">{name || 'Category Name'}</p>
                <p className="text-xs text-muted-foreground">0 items</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            Add Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
