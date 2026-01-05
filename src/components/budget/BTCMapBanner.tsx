import { useState } from 'react';
import {
  MapPin,
  Zap,
  Bitcoin,
  ExternalLink,
  ChevronRight,
  Store,
  Coffee,
  Utensils,
  ShoppingBag,
  Fuel,
  Building,
  Loader2,
  MapPinOff,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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

// Icon mapping for categories
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  restaurant: Utensils,
  cafe: Coffee,
  bar: Coffee,
  fast_food: Utensils,
  supermarket: ShoppingBag,
  convenience: ShoppingBag,
  fuel: Fuel,
  hotel: Building,
  other: Store,
};

function getCategoryIcon(category: string) {
  return categoryIcons[category.toLowerCase()] || Store;
}

interface MerchantCardProps {
  merchant: BTCMapElement & { distance: number };
  onClick: () => void;
}

function MerchantCard({ merchant, onClick }: MerchantCardProps) {
  const Icon = getCategoryIcon(merchant.tags.category || 'other');
  const hasLightning = acceptsLightning(merchant);
  const hasOnchain = acceptsOnchain(merchant);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[200px] p-3 rounded-xl border bg-card hover:bg-accent/50 transition-all hover:shadow-md text-left group"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {getMerchantName(merchant)}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {getMerchantCategory(merchant)}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {formatDistance(merchant.distance)}
            </span>
            <div className="flex gap-1">
              {hasLightning && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Zap className="h-2.5 w-2.5" />
                </Badge>
              )}
              {hasOnchain && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Bitcoin className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>
          </div>
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

  const Icon = getCategoryIcon(merchant.tags.category || 'other');
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
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-left">{getMerchantName(merchant)}</DialogTitle>
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
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>
                  {tags['addr:street']}
                  {tags['addr:city'] && `, ${tags['addr:city']}`}
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
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">🌐</span>
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
                <span className="text-muted-foreground">🕐</span>
                <span className="text-muted-foreground">{tags.opening_hours}</span>
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

export function BTCMapBanner() {
  const { merchants, isLoading, error, location } = useBTCMap(50); // 50km radius
  const [selectedMerchant, setSelectedMerchant] = useState<(BTCMapElement & { distance: number }) | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Loading state
  if (isLoading) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-orange-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Finding Bitcoin merchants near you...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error or no location
  if (error || !location) {
    return (
      <Card className="overflow-hidden border-muted">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <MapPinOff className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">Enable location to find Bitcoin merchants</p>
                <p className="text-xs">Discover places near you that accept sats</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No merchants found
  if (merchants.length === 0) {
    return (
      <Card className="overflow-hidden border-muted">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Store className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium">No Bitcoin merchants found nearby</p>
                <p className="text-xs">
                  <a 
                    href="https://btcmap.org/add-location" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Add a merchant to BTCMap
                  </a>
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleMerchantClick = (merchant: BTCMapElement & { distance: number }) => {
    setSelectedMerchant(merchant);
    setShowDetailDialog(true);
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
        <CardContent className="py-4 px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  Spend Sats Locally
                  <Badge variant="secondary" className="text-xs font-normal">
                    {merchants.length} nearby
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bitcoin-accepting merchants from BTCMap
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => window.open('https://btcmap.org', '_blank')}
              >
                View Map
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable merchant cards */}
          <ScrollArea className="w-full">
            <div className="flex gap-3 pb-2">
              {merchants.slice(0, 20).map((merchant) => (
                <MerchantCard
                  key={merchant.id}
                  merchant={merchant}
                  onClick={() => handleMerchantClick(merchant)}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Merchant detail dialog */}
      <MerchantDetailDialog
        merchant={selectedMerchant}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </>
  );
}
