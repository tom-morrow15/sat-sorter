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
  Scissors,
  Brush,
  Palette,
  Music2,
  Image,
  Wine,
  Leaf,
  Wrench,
  Armchair,
  Zap as Zapper,
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
  getSmartMerchantCategory,
  acceptsLightning,
  acceptsOnchain,
  formatDistance,
  type BTCMapElement,
} from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

// Icon mapping for individual categories
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Food & Drink
  'restaurant': Utensils,
  'cafe': Coffee,
  'fast_food': Utensils,
  'bar': Wine,
  'pub': Wine,
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
  'lounge': Wine,
  // Shopping
  'supermarket': ShoppingBag,
  'convenience': ShoppingBag,
  'clothes': ShoppingBag,
  'shoes': ShoppingBag,
  'jewelry': ShoppingBag,
  'accessories': ShoppingBag,
  'electronics': ShoppingBag,
  'computer': ShoppingBag,
  'mobile_phone': ShoppingBag,
  'gift': ShoppingBag,
  'florist': Leaf,
  'garden_centre': Leaf,
  'vintage_shop': ShoppingBag,
  'antique_shop': ShoppingBag,
  'organic_shop': Leaf,
  'books': BookOpen,
  'music': Music2,
  'video': ShoppingBag,
  'sports_shop': ShoppingBag,
  // Personal Care & Beauty
  'beauty': Heart,
  'barber': Scissors,
  'salon': Scissors,
  'hairdresser': Scissors,
  'tattoo': Heart,
  'spa': Heart,
  'massage': Heart,
  'pharmacy': Heart,
  'dentist': Heart,
  'doctor': Heart,
  // Services
  'photography': Image,
  'photographer': Image,
  'art_gallery': Palette,
  'art': Palette,
  'music_venue': Music2,
  'hardware': Wrench,
  'tools': Wrench,
  'coworking': Wifi,
  'laundry': Wifi,
  'post_office': Wifi,
  'banking': Wifi,
  'atm': Wifi,
  'bank': Wifi,
  'professional_services': Wifi,
  // Transportation
  'fuel': Fuel,
  'car_repair': Truck,
  'car_rental': Truck,
  'taxi': Truck,
  'parking': Truck,
  'car_sales': Truck,
  'car_parts': Truck,
  'bicycle': Truck,
  'motorcycle': Truck,
  'bicycle_repair': Wrench,
  // Travel & Accommodation
  'hotel': Building,
  'hostel': Building,
  'apartment': Building,
  'tourism_info': MapPin,
  // Health & Fitness
  'gym': Dumbbell,
  'fitness_center': Dumbbell,
  'leisure_sports': Dumbbell,
  'park': Leaf,
  // Entertainment & Education
  'cinema': Music2,
  'theatre': Music2,
  'museum': Music2,
  'entertainment': Music2,
  'school': BookOpen,
  'university': BookOpen,
  'education': BookOpen,
  // Pets
  'veterinary': PawPrint,
  'pet_shop': PawPrint,
  // Wellness & Lifestyle
  'wellness': Leaf,
  'butcher': Utensils,
};

function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  const categoryLower = category.toLowerCase();
  return CATEGORY_ICONS[categoryLower] || Store;
}

function getCategoryDisplayName(category: string): string {
  const categoryLower = category.toLowerCase();
  
  // Special mappings for readability
  const displayNames: Record<string, string> = {
    'barber': 'Barber & Hair',
    'salon': 'Salon',
    'hairdresser': 'Hair Services',
    'massage': 'Massage & Wellness',
    'spa': 'Spa',
    'photography': 'Photography',
    'photographer': 'Photographer',
    'art_gallery': 'Art Gallery',
    'art': 'Art',
    'tattoo': 'Tattoo Studio',
    'fitness_center': 'Fitness & Yoga',
    'leisure_sports': 'Sports & Recreation',
    'car_repair': 'Auto Repair',
    'car_rental': 'Car Rental',
    'car_sales': 'Car Sales',
    'car_parts': 'Auto Parts',
    'vintage_shop': 'Vintage Shop',
    'antique_shop': 'Antique Shop',
    'organic_shop': 'Organic Shop',
    'garden_centre': 'Garden Center',
    'professional_services': 'Professional Services',
    'tourism_info': 'Tourism Info',
    'music_venue': 'Music Venue',
    'sports_shop': 'Sports Shop',
    'bicycle_repair': 'Bike Repair',
    'pet_shop': 'Pet Shop',
    'fast_food': 'Fast Food',
    'ice_cream': 'Ice Cream',
    'mobile_phone': 'Mobile Phone',
    'post_office': 'Post Office',
    'middle_eastern': 'Middle Eastern',
    'other': 'Other',
  };

  if (displayNames[categoryLower]) {
    return displayNames[categoryLower];
  }

  // Default: convert snake_case to Title Case
  return categoryLower
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

  // Dynamically discover unique categories and sort by count (using smart categorization)
  const availableCategories = useMemo(() => {
    const categoryMap = new Map<string, number>();

    merchants.forEach(merchant => {
      const category = getSmartMerchantCategory(merchant);
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    // Convert to array and sort by count (descending)
    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    return categories;
  }, [merchants]);

  // Group merchants by category (using smart categorization)
  const groupedMerchants = useMemo(() => {
    const grouped: Record<string, (BTCMapElement & { distance: number })[]> = {};

    merchants.forEach(merchant => {
      const category = getSmartMerchantCategory(merchant);
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
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search merchants by name or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {merchants.length === 0 ? (
          /* Empty state */
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Store className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No merchants found. Expand your search radius in settings.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Category Grid - Beautiful new layout */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground">Browse by Category</h3>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {/* All button */}
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                    selectedCategory === 'all'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/30 hover:bg-muted/50'
                  )}
                >
                  <Store className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">All</span>
                  <Badge variant="secondary" className="text-[9px] py-0">
                    {categoryCounts.all}
                  </Badge>
                </button>

                {/* Dynamic category buttons */}
                {availableCategories.map(({ category, count }) => {
                  const CategoryIcon = getCategoryIcon(category);
                  const displayName = getCategoryDisplayName(category);
                  const isSelected = selectedCategory === category;

                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/30 hover:bg-muted/50'
                      )}
                      title={displayName}
                    >
                      <CategoryIcon className="h-5 w-5 text-primary" />
                      <span className="text-xs font-medium line-clamp-2 text-center leading-tight">
                        {displayName.split(' ')[0]}
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0">
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Merchants Display */}
            {selectedCategory === 'all' ? (
              /* Show all grouped by category */
              <div className="space-y-8">
                {availableCategories.map(({ category }) => {
                  const items = filteredMerchants[category];
                  if (!items || items.length === 0) return null;

                  const displayName = getCategoryDisplayName(category);
                  const CategoryIcon = getCategoryIcon(category);

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <CategoryIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-base">{displayName}</h3>
                        </div>
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
            ) : (
              /* Show selected category */
              <div>
                {filteredMerchants[selectedCategory]?.length ? (
                  <>
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base">{getCategoryDisplayName(selectedCategory)}</h3>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {filteredMerchants[selectedCategory].length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredMerchants[selectedCategory].map(merchant => (
                        <MerchantCard
                          key={merchant.id}
                          merchant={merchant}
                          onClick={() => handleMerchantClick(merchant)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No merchants found matching your search.</p>
                  </div>
                )}
              </div>
            )}
          </>
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
