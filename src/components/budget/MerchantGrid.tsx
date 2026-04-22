import { useState, useMemo } from 'react';
import {
  MapPin,
  Zap,
  Bitcoin,
  ExternalLink,
  Coffee,
  Utensils,
  ShoppingBag,
  Fuel,
  Building,
  Store,
  Heart,
  Truck,
  Dumbbell,
  BookOpen,
  Wifi,
  PawPrint,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useBTCMap,
  getMerchantName,
  getMerchantCategory,
  acceptsLightning,
  acceptsOnchain,
  formatDistance,
  type BTCMapElement,
} from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

// Icon mapping for individual categories
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'restaurant': Utensils,
  'cafe': Coffee,
  'fast_food': Utensils,
  'bar': Wifi,
  'pub': Wifi,
  'bakery': Coffee,
  'pizza': Utensils,
  'burger': Utensils,
  'sandwich': Utensils,
  'sushi': Utensils,
  'bbq': Utensils,
  'mexican': Utensils,
  'chinese': Utensils,
  'indian': Utensils,
  'thai': Utensils,
  'vietnamese': Utensils,
  'korean': Utensils,
  'middle_eastern': Utensils,
  'ice_cream': Coffee,
  'diner': Utensils,
  'supermarket': ShoppingBag,
  'convenience': ShoppingBag,
  'clothes': ShoppingBag,
  'electronics': ShoppingBag,
  'beauty': Heart,
  'hardware': Building,
  'books': BookOpen,
  'gift': ShoppingBag,
  'fuel': Fuel,
  'car_repair': Truck,
  'car_rental': Truck,
  'taxi': Truck,
  'parking': Truck,
  'hotel': Building,
  'hostel': Building,
  'apartment': Building,
  'pharmacy': Heart,
  'gym': Dumbbell,
  'fitness_center': Dumbbell,
  'dentist': Heart,
  'doctor': Heart,
  'spa': Heart,
  'atm': Wifi,
  'bank': Wifi,
  'coworking': Wifi,
  'laundry': Wifi,
  'hairdresser': Heart,
  'cinema': Dumbbell,
  'theatre': Dumbbell,
  'music': Dumbbell,
  'sports': Dumbbell,
  'school': BookOpen,
  'university': BookOpen,
  'veterinary': PawPrint,
  'pet_shop': PawPrint,
};

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  const categoryLower = category.toLowerCase();
  return CATEGORY_ICONS[categoryLower] || Store;
}

interface MerchantCardProps {
  merchant: BTCMapElement & { distance: number };
  onClick: () => void;
}

function MerchantCard({ merchant, onClick }: MerchantCardProps) {
  const CategoryIcon = getCategoryIcon(merchant.tags.category || 'other');
  const hasLightning = acceptsLightning(merchant);
  const hasOnchain = acceptsOnchain(merchant);

  return (
    <button
      onClick={onClick}
      className="flex flex-col p-4 rounded-xl border bg-card hover:bg-accent/50 active:bg-accent transition-all text-left group"
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CategoryIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {getMerchantName(merchant)}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {getMerchantCategory(merchant)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {formatDistance(merchant.distance)}
        </span>
        <div className="flex gap-1">
          {hasLightning && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Zap className="h-2.5 w-2.5" />
            </Badge>
          )}
          {hasOnchain && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Bitcoin className="h-2.5 w-2.5" />
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

interface MerchantDetailDialogProps {
  merchant: (BTCMapElement & { distance: number }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MerchantDetailDialog({ merchant, open, onOpenChange }: MerchantDetailDialogProps) {
  if (!merchant) return null;

  const CategoryIcon = getCategoryIcon(merchant.tags.category || 'other');
  const hasLightning = acceptsLightning(merchant);
  const hasOnchain = acceptsOnchain(merchant);
  const tags = merchant.osm_json.tags;

  const openInMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${merchant.osm_json.lat},${merchant.osm_json.lon}`;
    window.open(url, '_blank');
  };

  const openBTCMap = () => {
    const url = `https://btcmap.org/merchant/${merchant.id}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CategoryIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-left truncate">{getMerchantName(merchant)}</DialogTitle>
              <DialogDescription className="text-left">
                {getMerchantCategory(merchant)} • {formatDistance(merchant.distance)} away
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment methods */}
          <div className="flex gap-2">
            {hasLightning && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">
                <Zap className="h-3 w-3 mr-1" />
                Lightning
              </Badge>
            )}
            {hasOnchain && (
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100">
                <Bitcoin className="h-3 w-3 mr-1" />
                On-chain
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            {tags['addr:street'] && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="break-words">
                  {tags['addr:street']}
                  {tags['addr:city'] && `, ${tags['addr:city']}`}
                  {tags['addr:state'] && `, ${tags['addr:state']}`}
                </span>
              </div>
            )}
            {tags.phone && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">📞</span>
                <a href={`tel:${tags.phone}`} className="text-primary hover:underline">
                  {tags.phone}
                </a>
              </div>
            )}
            {tags.website && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground flex-shrink-0">🌐</span>
                <a
                  href={tags.website.startsWith('http') ? tags.website : `https://${tags.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {tags.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {tags.opening_hours && !tags.opening_hours.startsWith('http') && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground flex-shrink-0">🕐</span>
                <span className="text-muted-foreground break-words">{tags.opening_hours}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={openInMaps}>
              <MapPin className="h-4 w-4 mr-2" />
              Directions
            </Button>
            <Button variant="outline" className="flex-1" onClick={openBTCMap}>
              <ExternalLink className="h-4 w-4 mr-2" />
              BTCMap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MerchantGrid() {
  const { merchants } = useBTCMap();
  const [selectedMerchant, setSelectedMerchant] = useState<(BTCMapElement & { distance: number }) | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleMerchantClick = (merchant: BTCMapElement & { distance: number }) => {
    setSelectedMerchant(merchant);
    setShowDetailDialog(true);
  };

  // Dynamically discover unique categories and sort by count
  const availableCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    merchants.forEach(merchant => {
      const category = merchant.tags.category?.toLowerCase() || 'other';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Convert to array and sort by count (descending)
    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    return categories;
  }, [merchants]);

  // Group merchants by category
  const groupedMerchants = useMemo(() => {
    const grouped: Record<string, (BTCMapElement & { distance: number })[]> = {};

    merchants.forEach(merchant => {
      const category = merchant.tags.category?.toLowerCase() || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(merchant);
    });

    // Sort merchants within each category by distance
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.distance - b.distance);
    });

    return grouped;
  }, [merchants]);

  // Filter merchants by search query
  const filteredMerchants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return groupedMerchants;

    const filtered: Record<string, (BTCMapElement & { distance: number })[]> = {};

    Object.entries(groupedMerchants).forEach(([category, items]) => {
      const filteredItems = items.filter(merchant => {
        const name = getMerchantName(merchant).toLowerCase();
        const merchantCategory = getMerchantCategory(merchant).toLowerCase();
        return name.includes(query) || merchantCategory.includes(query);
      });

      if (filteredItems.length > 0) {
        filtered[category] = filteredItems;
      }
    });

    return filtered;
  }, [groupedMerchants, searchQuery]);

  // Get merchants for current tab
  const currentCategoryMerchants = selectedCategory === 'all'
    ? Object.values(filteredMerchants).flat().sort((a, b) => a.distance - b.distance)
    : filteredMerchants[selectedCategory] || [];

  // Count merchants per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: merchants.length };
    Object.entries(filteredMerchants).forEach(([category, items]) => {
      counts[category] = items.length;
    });
    return counts;
  }, [filteredMerchants, merchants.length]);

  return (
    <>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search merchants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Tabs - Dynamic based on available merchants */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="w-full h-auto p-1 gap-1 flex-wrap justify-start">
            {/* All button */}
            <TabsTrigger value="all" className="text-xs py-2">
              All
              <Badge variant="secondary" className="ml-1 text-[10px] py-0">
                {categoryCounts.all}
              </Badge>
            </TabsTrigger>

            {/* Dynamic category buttons */}
            {availableCategories.map(({ category, count }) => {
              const CategoryIcon = getCategoryIcon(category);
              const displayName = getMerchantCategory({ tags: { category } } as any);

              return (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="text-xs py-2"
                >
                  <CategoryIcon className="h-3.5 w-3.5 mr-1" />
                  <span className="truncate max-w-[100px]">{displayName}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px] py-0">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Content for "All" tab */}
          <TabsContent value="all" className="mt-4">
            <div className="space-y-6">
              {availableCategories.map(({ category }) => {
                const items = filteredMerchants[category];
                if (!items || items.length === 0) return null;

                const displayName = getMerchantCategory({ tags: { category } } as any);
                const CategoryIcon = getCategoryIcon(category);

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <CategoryIcon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-sm">{displayName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {items.map(merchant => (
                        <MerchantCard
                          key={merchant.id}
                          merchant={merchant}
                          onClick={() => handleMerchantClick(merchant)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Individual category tabs */}
          {availableCategories.map(({ category }) => (
            <TabsContent key={category} value={category} className="mt-4">
              {filteredMerchants[category]?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredMerchants[category].map(merchant => (
                    <MerchantCard
                      key={merchant.id}
                      merchant={merchant}
                      onClick={() => handleMerchantClick(merchant)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No merchants found in this category.</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Empty state */}
        {merchants.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No merchants found. Expand your search radius in settings.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Merchant detail dialog */}
      <MerchantDetailDialog
        merchant={selectedMerchant}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </>
  );
}
