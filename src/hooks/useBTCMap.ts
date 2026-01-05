import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export interface BTCMapElement {
  id: string;
  osm_json: {
    type: string;
    id: number;
    lat: number;
    lon: number;
    tags: {
      name?: string;
      'name:en'?: string;
      amenity?: string;
      shop?: string;
      tourism?: string;
      leisure?: string;
      office?: string;
      cuisine?: string;
      website?: string;
      phone?: string;
      'payment:lightning'?: string;
      'payment:onchain'?: string;
      'opening_hours'?: string;
      'addr:street'?: string;
      'addr:city'?: string;
      [key: string]: string | undefined;
    };
  };
  tags: {
    category: string;
    'icon:android'?: string;
    issues?: Array<{
      type: string;
      severity: number;
      description: string;
    }>;
  };
}

export interface UserLocation {
  lat: number;
  lon: number;
}

// Category mappings from BTCMap categories to our budget line items
export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  // Food & Drink
  'restaurant': ['restaurants', 'restaurant', 'dining', 'food', 'eating out', 'dinner', 'lunch', 'meals'],
  'cafe': ['coffee', 'cafe', 'coffee shop', 'starbucks', 'breakfast', 'tea', 'espresso'],
  'bar': ['bar', 'drinks', 'alcohol', 'nightlife', 'entertainment', 'beer', 'wine'],
  'fast_food': ['fast food', 'takeout', 'quick meals', 'food', 'burger', 'pizza'],
  'pub': ['bar', 'pub', 'drinks', 'entertainment', 'beer'],
  'bakery': ['bakery', 'bread', 'pastries', 'food', 'breakfast'],

  // Shopping
  'supermarket': ['groceries', 'grocery', 'food', 'shopping', 'market'],
  'convenience': ['groceries', 'convenience', 'shopping', 'snacks'],
  'clothes': ['clothing', 'clothes', 'shopping', 'apparel', 'fashion'],
  'electronics': ['electronics', 'tech', 'gadgets', 'shopping', 'computer', 'phone'],
  'beauty': ['personal care', 'beauty', 'self care', 'shopping', 'cosmetics', 'salon'],
  'hardware': ['hardware', 'tools', 'home improvement', 'shopping'],
  'books': ['books', 'reading', 'education', 'shopping'],
  'gift': ['gifts', 'gift', 'presents', 'shopping'],

  // Transportation
  'fuel': ['gas', 'fuel', 'car', 'transportation', 'petrol'],
  'car_repair': ['car repair', 'auto', 'car maintenance', 'transportation', 'mechanic'],
  'car_rental': ['car rental', 'rental', 'transportation'],
  'taxi': ['taxi', 'uber', 'lyft', 'transportation', 'ride'],
  'parking': ['parking', 'car', 'transportation'],

  // Accommodation
  'hotel': ['hotel', 'lodging', 'travel', 'vacation', 'accommodation', 'stay'],
  'hostel': ['hostel', 'lodging', 'travel', 'accommodation', 'backpacking'],
  'apartment': ['apartment', 'rental', 'accommodation', 'airbnb'],

  // Health & Fitness
  'pharmacy': ['pharmacy', 'medicine', 'health', 'medical', 'drugs', 'prescriptions'],
  'gym': ['gym', 'fitness', 'health', 'exercise', 'workout'],
  'fitness_center': ['gym', 'fitness', 'health', 'exercise', 'yoga'],
  'dentist': ['dentist', 'dental', 'health', 'medical'],
  'doctor': ['doctor', 'medical', 'health', 'healthcare'],
  'spa': ['spa', 'wellness', 'self care', 'massage', 'relaxation'],

  // Services
  'atm': ['banking', 'cash', 'atm', 'money'],
  'bank': ['banking', 'bank', 'financial'],
  'coworking': ['office', 'work', 'coworking', 'workspace'],
  'laundry': ['laundry', 'cleaning', 'dry cleaning'],
  'hairdresser': ['haircut', 'barber', 'salon', 'personal care', 'grooming'],

  // Entertainment
  'cinema': ['entertainment', 'movies', 'cinema', 'film', 'theater'],
  'theatre': ['entertainment', 'theatre', 'shows', 'performance'],
  'music': ['music', 'concert', 'entertainment', 'show'],
  'sports': ['sports', 'game', 'entertainment', 'tickets'],

  // Education
  'school': ['education', 'school', 'learning', 'tuition'],
  'university': ['education', 'university', 'college', 'tuition'],

  // Pets
  'veterinary': ['pets', 'vet', 'veterinary', 'animal', 'dog', 'cat'],
  'pet_shop': ['pets', 'pet supplies', 'animal', 'dog', 'cat'],

  // Other common
  'other': [],
};

// Get matching budget keywords for a merchant
export function getMerchantKeywords(element: BTCMapElement): string[] {
  const category = element.tags.category?.toLowerCase() || '';
  const osmTags = element.osm_json.tags;

  const keywords: string[] = [];

  // Add category-based keywords
  if (CATEGORY_MAPPINGS[category]) {
    keywords.push(...CATEGORY_MAPPINGS[category]);
  }

  // Add amenity-based keywords
  const amenity = osmTags.amenity?.toLowerCase();
  if (amenity && CATEGORY_MAPPINGS[amenity]) {
    keywords.push(...CATEGORY_MAPPINGS[amenity]);
  }

  // Add shop-based keywords
  const shop = osmTags.shop?.toLowerCase();
  if (shop && CATEGORY_MAPPINGS[shop]) {
    keywords.push(...CATEGORY_MAPPINGS[shop]);
  }

  // Add cuisine keywords for restaurants
  if (osmTags.cuisine) {
    keywords.push(osmTags.cuisine.toLowerCase());
  }

  return [...new Set(keywords)]; // Remove duplicates
}

// Check if a line item matches any nearby merchants
export function lineItemMatchesMerchant(lineItemName: string, merchants: BTCMapElement[]): BTCMapElement[] {
  const lowerName = lineItemName.toLowerCase();

  return merchants.filter(merchant => {
    const keywords = getMerchantKeywords(merchant);
    const merchantName = (merchant.osm_json.tags.name || merchant.osm_json.tags['name:en'] || '').toLowerCase();

    // Check if any keyword matches the line item name
    const keywordMatch = keywords.some(keyword =>
      lowerName.includes(keyword) || keyword.includes(lowerName)
    );

    // Also check merchant name
    const nameMatch = merchantName.includes(lowerName) || lowerName.includes(merchantName);

    return keywordMatch || nameMatch;
  });
}

// Calculate distance between two points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

// Fetch merchants from BTCMap API
async function fetchMerchants(bounds: { north: number; south: number; east: number; west: number }): Promise<BTCMapElement[]> {
  // BTCMap API endpoint - fetch all elements and filter client-side
  // The API doesn't support bbox filtering directly, so we fetch and filter
  const response = await fetch(
    `https://api.btcmap.org/v2/elements?updated_since=2024-01-01&limit=10000`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch BTCMap data');
  }

  const elements: BTCMapElement[] = await response.json();

  // Filter by bounds and exclude deleted
  return elements.filter(el => {
    if (el.deleted_at) return false;
    const lat = el.osm_json.lat;
    const lon = el.osm_json.lon;
    return lat >= bounds.south && lat <= bounds.north &&
           lon >= bounds.west && lon <= bounds.east;
  });
}

// Hook to get user's location
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  }, []);

  return { location, error, isLoading };
}

// Main hook for BTCMap integration
export function useBTCMap(radiusKm: number = 25) {
  const { location, error: locationError, isLoading: locationLoading } = useUserLocation();

  const query = useQuery({
    queryKey: ['btcmap-merchants', location?.lat, location?.lon, radiusKm],
    queryFn: async () => {
      if (!location) return [];

      // Calculate bounding box
      const latDelta = radiusKm / 111; // ~111km per degree latitude
      const lonDelta = radiusKm / (111 * Math.cos(location.lat * Math.PI / 180));

      const bounds = {
        north: location.lat + latDelta,
        south: location.lat - latDelta,
        east: location.lon + lonDelta,
        west: location.lon - lonDelta,
      };

      const merchants = await fetchMerchants(bounds);

      // Add distance to each merchant and sort by distance
      return merchants
        .map(merchant => ({
          ...merchant,
          distance: calculateDistance(
            location.lat,
            location.lon,
            merchant.osm_json.lat,
            merchant.osm_json.lon
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
    },
    enabled: !!location,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  return {
    merchants: query.data || [],
    isLoading: locationLoading || query.isLoading,
    error: locationError || (query.error instanceof Error ? query.error.message : null),
    location,
    refetch: query.refetch,
  };
}

// Get merchant display name
export function getMerchantName(element: BTCMapElement): string {
  return element.osm_json.tags['name:en'] || element.osm_json.tags.name || 'Bitcoin Merchant';
}

// Get merchant category display name
export function getMerchantCategory(element: BTCMapElement): string {
  const category = element.tags.category;
  if (!category) return 'Other';

  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Check if merchant accepts Lightning
export function acceptsLightning(element: BTCMapElement): boolean {
  return element.osm_json.tags['payment:lightning'] === 'yes';
}

// Check if merchant accepts on-chain
export function acceptsOnchain(element: BTCMapElement): boolean {
  return element.osm_json.tags['payment:onchain'] === 'yes';
}
