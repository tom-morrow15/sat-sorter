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
  { id: 'home', Icon: Home, label: 'Home' },
  { id: 'car', Icon: Car, label: 'Car' },
  { id: 'utensils', Icon: Utensils, label: 'Food' },
  { id: 'heart', Icon: Heart, label: 'Lifestyle' },
  { id: 'piggy-bank', Icon: PiggyBank, label: 'Savings' },
  { id: 'wallet', Icon: Wallet, label: 'General' },
  { id: 'shopping-bag', Icon: ShoppingBag, label: 'Shopping' },
  { id: 'briefcase', Icon: Briefcase, label: 'Work' },
  { id: 'graduation-cap', Icon: GraduationCap, label: 'Education' },
  { id: 'plane', Icon: Plane, label: 'Travel' },
  { id: 'gift', Icon: Gift, label: 'Gifts' },
  { id: 'music', Icon: Music, label: 'Entertainment' },
  { id: 'dumbbell', Icon: Dumbbell, label: 'Fitness' },
  { id: 'baby', Icon: Baby, label: 'Kids' },
  { id: 'dog', Icon: Dog, label: 'Pets' },
  { id: 'stethoscope', Icon: Stethoscope, label: 'Health' },
];

const COLORS = [
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
            <div className="grid grid-cols-8 gap-2">
              {ICONS.map(({ id, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedIcon(id)}
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center transition-all',
                    selectedIcon === id
                      ? 'ring-2 ring-primary ring-offset-2'
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

          {/* Color selection */}
          <div className="space-y-2">
            <Label>Color</Label>
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
                />
              ))}
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
