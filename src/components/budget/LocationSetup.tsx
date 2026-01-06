import { useState } from 'react';
import { MapPin, X, Shield, Check, AlertCircle, ChevronDown } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { useLocationSettings } from '@/hooks/useBTCMap';
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

  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedRadius, setSelectedRadius] = useState(settings.radiusMiles || 25);
  const [error, setError] = useState<string | null>(null);

  const countries = getCountries();
  const states = selectedCountry ? getStatesByCountry(selectedCountry) : [];
  const cities = selectedCountry && selectedState ? getCitiesByCountryAndState(selectedCountry, selectedState) : [];

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedState('');
    setSelectedCity('');
    setError(null);
  };

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedCity('');
    setError(null);
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setError(null);
  };

  const handleSetLocation = () => {
    if (!selectedCountry || !selectedCity) {
      setError('Please select a country and city');
      return;
    }

    const coords = getLocationCoordinates(selectedCountry, selectedState, selectedCity);
    if (!coords) {
      setError('Could not find coordinates for this location');
      return;
    }

    const displayName = getLocationDisplayName(selectedCountry, selectedState, selectedCity);
    updateLocation(coords.lat, coords.lon, selectedRadius, displayName);

    toast({
      title: 'Location set!',
      description: `Finding Bitcoin merchants within ${selectedRadius} miles`,
    });

    onClose();
  };

  const handleClear = () => {
    clearLocation();
    setSelectedCountry('');
    setSelectedState('');
    setSelectedCity('');
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

      {/* Location Selection Dropdowns */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="country-select">Country</Label>
          <Select value={selectedCountry} onValueChange={handleCountryChange}>
            <SelectTrigger id="country-select">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCountry && states.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="state-select">State / Region</Label>
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger id="state-select">
                <SelectValue placeholder="Select a state or region" />
              </SelectTrigger>
              <SelectContent>
                {states.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedCountry && selectedState && cities.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="city-select">City</Label>
            <Select value={selectedCity} onValueChange={handleCityChange}>
              <SelectTrigger id="city-select">
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Radius selector */}
      {selectedCity && (
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
      )}

      {/* Set location button */}
      {selectedCity && (
        <Button
          onClick={handleSetLocation}
          className="w-full"
          size="lg"
        >
          Set Location to {getLocationDisplayName(selectedCountry, selectedState, selectedCity)}
        </Button>
      )}
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
              Select your location to discover nearby Bitcoin-friendly businesses
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
