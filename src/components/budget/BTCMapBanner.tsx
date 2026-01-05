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
  Info,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import {
  useBTCMap,
  useLocationSettings,
  getMerchantName,
  getMerchantCategory,
  getMerchantLocation,
  acceptsLightning,
  acceptsOnchain,
  formatDistance,
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

// Popular US cities for quick selection
const POPULAR_LOCATIONS = [
  { name: 'New York, NY', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  { name: 'Miami, FL', lat: 25.7617, lon: -80.1918 },
  { name: 'Austin, TX', lat: 30.2672, lon: -97.7431 },
  { name: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  { name: 'Portland, OR', lat: 45.5152, lon: -122.6784 },
  { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 },
  { name: 'Nashville, TN', lat: 36.1627, lon: -86.7816 },
];

interface LocationSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocationName?: string;
  initialRadius?: number;
  initialLat?: number;
  initialLon?: number;
}

function LocationSetupDialog({ 
  open, 
  onOpenChange,
  initialLocationName = '',
  initialRadius = 25,
  initialLat,
  initialLon,
}: LocationSetupDialogProps) {
  const [radius, setRadius] = useState(initialRadius.toString());
  const [locationName, setLocationName] = useState(initialLocationName);
  const [lat, setLat] = useState(initialLat?.toString() || '');
  const [lon, setLon] = useState(initialLon?.toString() || '');
  
  const { updateLocation } = useLocationSettings();
  const { toast } = useToast();

  const handleQuickSelect = (location: typeof POPULAR_LOCATIONS[0]) => {
    setLocationName(location.name);
    setLat(location.lat.toString());
    setLon(location.lon.toString());
  };

  const handleSubmit = () => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      toast({
        title: 'Invalid coordinates',
        description: 'Please enter valid latitude and longitude values.',
        variant: 'destructive',
      });
      return;
    }

    if (latNum < -90 || latNum > 90) {
      toast({
        title: 'Invalid latitude',
        description: 'Latitude must be between -90 and 90.',
        variant: 'destructive',
      });
      return;
    }

    if (lonNum < -180 || lonNum > 180) {
      toast({
        title: 'Invalid longitude',
        description: 'Longitude must be between -180 and 180.',
        variant: 'destructive',
      });
      return;
    }

    updateLocation(latNum, lonNum, parseInt(radius), locationName.trim() || `${lat}, ${lon}`);
    toast({
      title: 'Location set',
      description: `Finding Bitcoin merchants within ${radius} miles`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Find Bitcoin Merchants
          </DialogTitle>
          <DialogDescription>
            Choose your location to discover businesses that accept Bitcoin.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Select</TabsTrigger>
            <TabsTrigger value="custom">Custom Location</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4 pt-4">
            {/* Popular locations */}
            <div className="space-y-2">
              <Label>Select a city</Label>
              <div className="grid grid-cols-2 gap-2">
                {POPULAR_LOCATIONS.map((location) => (
                  <Button
                    key={location.name}
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleQuickSelect(location)}
                  >
                    <MapPin className="h-3 w-3 mr-2" />
                    {location.name}
                  </Button>
                ))}
              </div>
            </div>

            {locationName && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Selected: <span className="font-medium">{locationName}</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Radius */}
            <div className="space-y-2">
              <Label htmlFor="radius-quick">Search Radius</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger id="radius-quick">
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
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 pt-4">
            {/* Location name (optional) */}
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name (Optional)</Label>
              <Input
                id="location-name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Jacksonville, FL"
              />
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="30.091"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lon">Longitude</Label>
                <Input
                  id="lon"
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="-81.853"
                />
              </div>
            </div>

            {/* Help text */}
            <p className="text-xs text-muted-foreground">
              Tip: You can find coordinates by right-clicking on{' '}
              <a
                href="https://www.google.com/maps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Maps
              </a>
            </p>

            {/* Radius */}
            <div className="space-y-2">
              <Label htmlFor="radius-custom">Search Radius</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger id="radius-custom">
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
            </div>
          </TabsContent>
        </Tabs>

        {/* Privacy note */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
            🔒 Privacy First
          </p>
          <p className="text-xs text-muted-foreground">
            Your location is stored locally on your device and never shared with anyone.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!lat || !lon}>
            <Search className="h-4 w-4 mr-2" />
            Find Merchants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BTCMapBanner() {
  const { merchants, isLoading, hasLocation, settings, totalMerchants } = useBTCMap();
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
                    Discover {totalMerchants.toLocaleString()}+ Bitcoin-accepting businesses worldwide
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
            <span className="text-sm">Loading Bitcoin merchants...</span>
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
                    Within <span className="font-medium text-foreground">{settings.radiusMiles} miles</span> of <span className="font-medium text-foreground">{settings.locationName || 'your location'}</span>
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
          initialLocationName={settings.locationName}
          initialRadius={settings.radiusMiles}
          initialLat={settings.lat || undefined}
          initialLon={settings.lon || undefined}
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
                  📍 <span className="font-medium text-foreground">{settings.locationName || 'Your location'}</span>
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
        initialLocationName={settings.locationName}
        initialRadius={settings.radiusMiles}
        initialLat={settings.lat || undefined}
        initialLon={settings.lon || undefined}
      />
    </>
  );
}
