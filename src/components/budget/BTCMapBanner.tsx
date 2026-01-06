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
  Settings2,
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
import { LocationSetup } from './LocationSetup';
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
      className="flex-shrink-0 w-[180px] sm:w-[200px] p-3 rounded-xl border bg-card hover:bg-accent/50 active:bg-accent transition-all text-left group"
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {getMerchantName(merchant)}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {getMerchantCategory(merchant)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {formatDistance(merchant.distance)}
            </span>
            <div className="flex gap-0.5">
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

export function BTCMapBanner() {
  const { merchants, isLoading, hasLocation, settings, totalMerchants } = useBTCMap();
  const [selectedMerchant, setSelectedMerchant] = useState<(BTCMapElement & { distance: number }) | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showLocationSetup, setShowLocationSetup] = useState(false);

  const handleMerchantClick = (merchant: BTCMapElement & { distance: number }) => {
    setSelectedMerchant(merchant);
    setShowDetailDialog(true);
  };

  // No location set - show setup prompt
  if (!hasLocation) {
    return (
      <>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
          <CardContent className="py-5 px-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="font-semibold text-sm sm:text-base">Spend Sats Locally</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Find {totalMerchants > 10000 ? `${Math.floor(totalMerchants / 1000)}K+` : totalMerchants.toLocaleString()} Bitcoin merchants worldwide
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowLocationSetup(true)} className="w-full sm:w-auto">
                Set Location
              </Button>
            </div>
          </CardContent>
        </Card>

        <LocationSetup open={showLocationSetup} onOpenChange={setShowLocationSetup} />
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 to-orange-500/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Finding Bitcoin merchants...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No merchants found
  if (merchants.length === 0) {
    return (
      <>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
          <CardContent className="py-4 px-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No merchants found nearby</p>
                  <p className="text-xs text-muted-foreground">
                    Within {settings.radiusMiles} miles of {settings.locationName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLocationSetup(true)}
                  className="flex-1 sm:flex-initial"
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('https://btcmap.org/add-location', '_blank')}
                  className="flex-1 sm:flex-initial"
                >
                  Add Merchant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <LocationSetup open={showLocationSetup} onOpenChange={setShowLocationSetup} />
      </>
    );
  }

  // Merchants found - show carousel
  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
        <CardContent className="py-3 sm:py-4 px-3 sm:px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span className="truncate">Spend Sats</span>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex-shrink-0">
                    {merchants.length}
                  </Badge>
                </h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  📍 {settings.locationName} · {settings.radiusMiles} mi
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setShowLocationSetup(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs hidden sm:flex"
                onClick={() => window.open('https://btcmap.org', '_blank')}
              >
                Map
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>

          {/* Scrollable merchant cards */}
          <ScrollArea className="w-full">
            <div className="flex gap-2 sm:gap-3 pb-2">
              {merchants.slice(0, 15).map((merchant) => (
                <MerchantCard
                  key={merchant.id}
                  merchant={merchant}
                  onClick={() => handleMerchantClick(merchant)}
                />
              ))}
              
              {/* View more card */}
              {merchants.length > 15 && (
                <button
                  onClick={() => window.open('https://btcmap.org', '_blank')}
                  className="flex-shrink-0 w-[120px] p-3 rounded-xl border border-dashed bg-card/50 hover:bg-accent/50 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <span className="text-2xl font-bold">+{merchants.length - 15}</span>
                  <span className="text-xs">View all</span>
                </button>
              )}
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

      {/* Location setup dialog */}
      <LocationSetup open={showLocationSetup} onOpenChange={setShowLocationSetup} />
    </>
  );
}
