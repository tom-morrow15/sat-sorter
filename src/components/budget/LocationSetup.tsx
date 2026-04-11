import { useState } from 'react';
import { MapPin, X, Shield, Check, AlertCircle, Navigation, Loader2, Search } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useLocationSettings, geocodeLocation } from '@/hooks/useBTCMap';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useToast } from '@/hooks/useToast';
import {
  getCountries,
  getStatesByCountry,
  getCitiesByCountryAndState,
  getLocationCoordinates,
  getLocationDisplayName,
} from '@/lib/locationData';

interface LocationSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LocationSetupContent({ onClose }: { onClose: () => void }) {
  const { settings, updateLocation, updateRadius, clearLocation, hasLocation } = useLocationSettings();
  const { toast } = useToast();

  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(settings.radiusMiles || 25);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build location string and search
  const handleSearch = async () => {
    if (!country.trim() || !city.trim()) {
      setError('Please enter at least country and city');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Build search query: "City, State, Country" or "City, Country"
      const searchParts = [city.trim(), state.trim(), country.trim()].filter(Boolean);
      const searchQuery = searchParts.join(', ');

      const result = await geocodeLocation(searchQuery);

      if (!result) {
        setError('Location not found. Please check your spelling and try again.');
        setIsSearching(false);
        return;
      }

      updateLocation(result.lat, result.lon, selectedRadius, result.displayName);

      toast({
        title: 'Location set!',
        description: `Finding Bitcoin merchants within ${selectedRadius} miles`,
      });

      onClose();
    } catch (err) {
      setError('Could not search location. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-detect location (with user permission)
  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      setError('Location detection is not available in your browser');
      return;
    }

    setIsDetecting(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get a friendly name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10`,
            {
              headers: { 'User-Agent': 'SatSorter/1.0' },
              signal: AbortSignal.timeout(10000),
            }
          );

          const data = await response.json();

          // Build a friendly location name (city + state/country)
          let locationName = 'Your Area';
          if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.suburb;
            const state = data.address.state;
            const country = data.address.country;

            const parts = [city, state || country].filter(Boolean);
            if (parts.length > 0) {
              locationName = parts.join(', ');
            }
          }

          updateLocation(latitude, longitude, selectedRadius, locationName);

          toast({
            title: 'Location detected!',
            description: `Finding Bitcoin merchants within ${selectedRadius} miles`,
          });

          onClose();
        } catch {
          // Even if reverse geocoding fails, we still have coords
          updateLocation(latitude, longitude, selectedRadius, 'Your Area');
          toast({
            title: 'Location set!',
            description: `Finding Bitcoin merchants within ${selectedRadius} miles`,
          });
          onClose();
        }

        setIsDetecting(false);
      },
      (err) => {
        setIsDetecting(false);

        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location access denied. Please enter your location manually below.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Could not detect location. Please enter it manually below.');
            break;
          case err.TIMEOUT:
            setError('Location detection timed out. Please try again or enter manually.');
            break;
          default:
            setError('Could not detect location. Please enter it manually below.');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 600000, // 10 minutes cache
      }
    );
  };

  const handleClear = () => {
    clearLocation();
    setCountry('');
    setState('');
    setCity('');
    toast({
      title: 'Location cleared',
      description: 'Bitcoin merchant suggestions disabled',
    });
  };

  return (
    <div className="space-y-4">
      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-900 dark:text-green-100">
            100% private
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
            Your location stays on your device. Never shared or stored anywhere.
          </p>
        </div>
      </div>

      {/* Current location display */}
      {hasLocation && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium">{settings.locationName}</p>
              <p className="text-xs text-muted-foreground">Within {settings.radiusMiles} miles</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Location input fields */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="country-input">Country</Label>
          <Input
            id="country-input"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setError(null);
            }}
            placeholder="e.g., United States"
            disabled={isSearching || isDetecting}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state-input">State / Region (optional)</Label>
          <Input
            id="state-input"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setError(null);
            }}
            placeholder="e.g., Florida"
            disabled={isSearching || isDetecting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city-input">City</Label>
          <Input
            id="city-input"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setError(null);
            }}
            placeholder="e.g., Jacksonville"
            disabled={isSearching || isDetecting}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching || isDetecting || !country.trim() || !city.trim()}
          className="w-full"
          size="lg"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Radius selector */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Search radius</label>
          <div className="text-sm font-semibold text-primary">{selectedRadius} miles</div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[5, 10, 25, 50, 100].map((radius) => (
            <Button
              key={radius}
              variant={selectedRadius === radius ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRadius(radius)}
              className="text-xs"
            >
              {radius}
            </Button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or use</span>
        </div>
      </div>

      {/* Auto-detect button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleAutoDetect}
        disabled={isDetecting || isSearching}
      >
        {isDetecting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Detecting...
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4 mr-2" />
            Use My Current Location
          </>
        )}
      </Button>
    </div>
  );
}

export function LocationSetup({ open, onOpenChange }: LocationSetupProps) {
  const isMobile = useIsMobile();

  const handleClose = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="text-center relative pb-2 flex-shrink-0">
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
            <DrawerTitle className="flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Find Bitcoin Merchants
            </DrawerTitle>
            <DrawerDescription>
              Select your location to discover nearby Bitcoin-friendly businesses
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
            <LocationSetupContent onClose={handleClose} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Find Bitcoin Merchants
          </DialogTitle>
          <DialogDescription>
            Select your location to discover nearby Bitcoin-friendly businesses
          </DialogDescription>
        </DialogHeader>
        <LocationSetupContent onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
