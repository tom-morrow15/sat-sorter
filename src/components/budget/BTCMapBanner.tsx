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
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useBTCMap,
  useLocationSettings,
  getMerchantName,
  getMerchantCategory,
  acceptsLightning,
  acceptsOnchain,
  formatDistance,
  COUNTRY_OPTIONS,
  type BTCMapElement,
} from '@/hooks/useBTCMap';
import { useToast } from '@/hooks/useToast';
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

// Radius options in miles
const RADIUS_OPTIONS = [
  { value: '5', label: '5 miles' },
  { value: '10', label: '10 miles' },
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
  { value: '100', label: '100 miles' },
];

interface LocationSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialZipCode?: string;
  initialRadius?: number;
  initialCountry?: string;
}

function LocationSetupDialog({
  open,
  onOpenChange,
  initialZipCode = '',
  initialRadius = 25,
  initialCountry = 'us',
}: LocationSetupDialogProps) {
  const [zipCode, setZipCode] = useState(initialZipCode);
  const [radius, setRadius] = useState(initialRadius.toString());
  const [country, setCountry] = useState(initialCountry);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { updateLocation } = useLocationSettings();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!zipCode.trim()) {
      setError('Please enter a zip/postal code');
      return;
    }

    setIsLoading(true);
    setError(null);

    const success = await updateLocation(zipCode.trim(), parseInt(radius), country);

    setIsLoading(false);

    if (success) {
      toast({
        title: 'Location set',
        description: `Finding Bitcoin merchants within ${radius} miles of ${zipCode}`,
      });
      onOpenChange(false);
    } else {
      setError('Could not find that location. Please check your zip/postal code and country.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Find Bitcoin Merchants
          </DialogTitle>
          <DialogDescription>
            Enter your location to discover businesses near you that accept Bitcoin.
            Your location is stored locally and never shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Country selector */}
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zip/postal code */}
          <div className="space-y-2">
            <Label htmlFor="zip-code">Zip / Postal Code</Label>
            <Input
              id="zip-code"
              value={zipCode}
              onChange={(e) => {
                setZipCode(e.target.value);
                setError(null);
              }}
              placeholder={country === 'us' ? 'e.g., 32068' : 'e.g., A1A 1A1'}
              className={cn(error && 'border-destructive')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <Label htmlFor="radius">Search Radius</Label>
            <Select value={radius} onValueChange={setRadius}>
              <SelectTrigger id="radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How far are you willing to travel to spend sats?
            </p>
          </div>

          {/* Privacy note */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
              🔒 Privacy First
            </p>
            <p className="text-xs text-muted-foreground">
              Your location is only used to find nearby merchants and is stored
              locally on your device. We never track or share your location.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Merchants
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BTCMapBanner() {
  const { merchants, isLoading, hasLocation, settings } = useBTCMap();
  const { clearLocation } = useLocationSettings();
  const [selectedMerchant, setSelectedMerchant] = useState<(BTCMapElement & { distance: number }) | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);

  const handleMerchantClick = (merchant: BTCMapElement & { distance: number }) => {
    setSelectedMerchant(merchant);
    setShowDetailDialog(true);
  };

  // No location set - show setup prompt
  if (!hasLocation) {
    return (
      <>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="font-semibold">Spend Sats Locally</h3>
                  <p className="text-sm text-muted-foreground">
                    Discover Bitcoin-accepting businesses in your area
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowLocationDialog(true)} className="gap-2">
                <Search className="h-4 w-4" />
                Set Your Location
              </Button>
            </div>
          </CardContent>
        </Card>

        <LocationSetupDialog
          open={showLocationDialog}
          onOpenChange={setShowLocationDialog}
        />
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
            <span className="text-sm">Finding Bitcoin merchants near {settings.zipCode}...</span>
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
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    No Bitcoin merchants found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Searching within <span className="font-medium text-foreground">{settings.radiusMiles} miles</span> of <span className="font-medium text-foreground">{settings.zipCode}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowLocationDialog(true)}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Change Location
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('https://btcmap.org/add-location', '_blank')}
                >
                  Add Merchant
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <LocationSetupDialog
          open={showLocationDialog}
          onOpenChange={setShowLocationDialog}
          initialZipCode={settings.zipCode}
          initialRadius={settings.radiusMiles}
          initialCountry={settings.countryCode}
        />
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
        <CardContent className="py-4 px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Spend Sats Locally
                  <Badge variant="secondary" className="text-xs font-normal bg-success/10 text-success border-success/20">
                    {merchants.length} found
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  📍 <span className="font-medium text-foreground">{settings.zipCode}</span>
                  {' · '}
                  <span className="font-medium text-foreground">{settings.radiusMiles} mile</span> radius
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowLocationDialog(true)}
              >
                <Settings2 className="h-3 w-3 mr-1" />
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => window.open('https://btcmap.org', '_blank')}
              >
                View Map
                <ChevronRight className="h-3 w-3 ml-1" />
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

      {/* Location setup dialog */}
      <LocationSetupDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        initialZipCode={settings.zipCode}
        initialRadius={settings.radiusMiles}
        initialCountry={settings.countryCode}
      />
    </>
  );
}
