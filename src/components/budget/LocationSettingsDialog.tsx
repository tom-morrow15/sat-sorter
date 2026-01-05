import { useState, useEffect } from 'react';
import { MapPin, Search, Loader2, X, Navigation, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocationSettings } from '@/hooks/useBTCMap';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useToast } from '@/hooks/useToast';

interface LocationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common radius options in miles
const RADIUS_OPTIONS = [5, 10, 25, 50, 100, 250];

// Geocoding using Nominatim (free, no API key needed)
async function geocodeAddress(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'SatSorter/1.0',
        },
      }
    );

    if (!response.ok) throw new Error('Geocoding failed');

    const data = await response.json();
    if (data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

function LocationSettingsContent({ onClose }: { onClose: () => void }) {
  const { settings, updateLocation, updateRadius, clearLocation, hasLocation } = useLocationSettings();
  const { toast } = useToast();

  // Form state
  const [country, setCountry] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [radius, setRadius] = useState(settings.radiusMiles);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Parse existing location name to pre-fill fields
  useEffect(() => {
    if (settings.locationName) {
      // Try to parse the location name
      const parts = settings.locationName.split(', ').map(p => p.trim());
      if (parts.length >= 1) setCity(parts[0]);
      if (parts.length >= 2) setStateProvince(parts[1]);
      if (parts.length >= 3) setCountry(parts[2]);
    }
    setRadius(settings.radiusMiles);
  }, [settings]);

  const handleSearch = async () => {
    // Build search query from provided fields
    const queryParts = [postalCode, city, stateProvince, country].filter(p => p.trim());
    
    if (queryParts.length === 0) {
      setSearchError('Please enter at least a city or postal code');
      return;
    }

    const query = queryParts.join(', ');
    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await geocodeAddress(query);

      if (!result) {
        setSearchError('Location not found. Try being more specific or check spelling.');
        return;
      }

      // Build a friendly location name
      const locationName = [city, stateProvince, country]
        .filter(p => p.trim())
        .join(', ') || result.displayName.split(',').slice(0, 3).join(',');

      updateLocation(result.lat, result.lon, radius, locationName);

      toast({
        title: 'Location saved',
        description: `Finding Bitcoin merchants near ${locationName}`,
      });

      onClose();
    } catch (error) {
      setSearchError('Failed to search location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get location name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            {
              headers: {
                'User-Agent': 'SatSorter/1.0',
              },
            }
          );
          const data = await response.json();
          const locationName = data.address
            ? [data.address.city || data.address.town || data.address.village, data.address.state, data.address.country]
                .filter(Boolean)
                .join(', ')
            : 'Your Location';

          updateLocation(latitude, longitude, radius, locationName);

          toast({
            title: 'Location saved',
            description: `Finding Bitcoin merchants near ${locationName}`,
          });

          onClose();
        } catch {
          // Even if reverse geocoding fails, we have the coords
          updateLocation(latitude, longitude, radius, 'Your Location');
          onClose();
        }
        
        setIsSearching(false);
      },
      (error) => {
        setIsSearching(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setSearchError('Location permission denied. Please enter your location manually.');
            break;
          case error.POSITION_UNAVAILABLE:
            setSearchError('Location unavailable. Please enter your location manually.');
            break;
          case error.TIMEOUT:
            setSearchError('Location request timed out. Please try again or enter manually.');
            break;
          default:
            setSearchError('Could not get your location. Please enter it manually.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  const handleClear = () => {
    clearLocation();
    setCountry('');
    setStateProvince('');
    setCity('');
    setPostalCode('');
    toast({
      title: 'Location cleared',
      description: 'Bitcoin merchant suggestions have been disabled.',
    });
  };

  return (
    <div className="space-y-6 px-4 pb-4">
      {/* Current location display */}
      {hasLocation && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Location Set
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {settings.locationName || 'Custom location'} • {settings.radiusMiles} mile radius
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-green-700 hover:text-green-900 dark:text-green-300"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Error display */}
      {searchError && (
        <Alert variant="destructive">
          <AlertDescription>{searchError}</AlertDescription>
        </Alert>
      )}

      {/* Use current location button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleUseCurrentLocation}
        disabled={isSearching}
      >
        {isSearching ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Navigation className="h-4 w-4 mr-2" />
        )}
        Use My Current Location
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
        </div>
      </div>

      {/* Manual location entry */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="United States"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              placeholder="California"
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Los Angeles"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="postal">Postal / Zip Code (optional)</Label>
            <Input
              id="postal"
              placeholder="90001"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>

        {/* Radius selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Search Radius</Label>
            <span className="text-sm font-medium">{radius} miles</span>
          </div>
          <Slider
            value={[radius]}
            onValueChange={([value]) => setRadius(value)}
            min={1}
            max={250}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 mi</span>
            <span>250 mi</span>
          </div>
          {/* Quick radius buttons */}
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <Button
                key={r}
                variant={radius === r ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRadius(r)}
                className="text-xs"
              >
                {r} mi
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Search button */}
      <Button
        className="w-full"
        onClick={handleSearch}
        disabled={isSearching || (!city && !postalCode && !stateProvince && !country)}
      >
        {isSearching ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Find Bitcoin Merchants
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Your location is stored locally in your browser and never sent to our servers.
      </p>
    </div>
  );
}

export function LocationSettingsDialog({ open, onOpenChange }: LocationSettingsDialogProps) {
  const isMobile = useIsMobile();

  const handleClose = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center relative">
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
            <DrawerTitle className="flex items-center justify-center gap-2 pt-2">
              <MapPin className="h-5 w-5" />
              Find Bitcoin Merchants
            </DrawerTitle>
            <DrawerDescription>
              Set your location to discover nearby places that accept Bitcoin
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto">
            <LocationSettingsContent onClose={handleClose} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Find Bitcoin Merchants
          </DialogTitle>
          <DialogDescription>
            Set your location to discover nearby places that accept Bitcoin
          </DialogDescription>
        </DialogHeader>
        <LocationSettingsContent onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
