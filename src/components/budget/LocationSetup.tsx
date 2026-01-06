import { useState } from 'react';
import { MapPin, Search, Loader2, X, Navigation, Shield, Check, AlertCircle } from 'lucide-react';
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
import { useLocationSettings, geocodeLocation } from '@/hooks/useBTCMap';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useToast } from '@/hooks/useToast';

interface LocationSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function LocationSetupContent({ onClose }: { onClose: () => void }) {
  const { settings, updateLocation, clearLocation, hasLocation } = useLocationSettings();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for location using the query
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a location');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await geocodeLocation(searchQuery.trim());

      if (!result) {
        setError('Location not found. Try a different search (e.g., "Miami, FL" or "London, UK")');
        setIsSearching(false);
        return;
      }

      updateLocation(result.lat, result.lon, result.displayName);

      toast({
        title: 'Location set!',
        description: `Finding Bitcoin merchants near ${result.displayName}`,
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

          updateLocation(latitude, longitude, locationName);

          toast({
            title: 'Location detected!',
            description: `Finding Bitcoin merchants near ${locationName}`,
          });

          onClose();
        } catch {
          // Even if reverse geocoding fails, we still have coords
          updateLocation(latitude, longitude, 'Your Area');
          toast({
            title: 'Location set!',
            description: 'Finding Bitcoin merchants near you',
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
    setSearchQuery('');
    toast({
      title: 'Location cleared',
      description: 'Bitcoin merchant suggestions disabled',
    });
  };

  return (
    <div className="space-y-4">
      {/* Privacy notice - always visible */}
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
              <p className="text-xs text-muted-foreground">Within 25 miles</p>
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

      {/* Search input - primary method */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="e.g., Tokyo, London, or 90210"
            disabled={isSearching || isDetecting}
            className="flex-1"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching || isDetecting || !searchQuery.trim()}
            size="lg"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Auto-detect option */}
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
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-center relative pb-2">
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
              Search your location to see nearby businesses that accept Bitcoin
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <LocationSetupContent onClose={handleClose} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Find Bitcoin Merchants
          </DialogTitle>
          <DialogDescription>
            Search your location to discover nearby Bitcoin-friendly businesses
          </DialogDescription>
        </DialogHeader>
        <LocationSetupContent onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
