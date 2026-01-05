import { useQuery } from '@tanstack/react-query';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface LocationSettings {
  zipCode: string;
  radiusMiles: number;
  lat: number | null;
  lon: number | null;
  lastUpdated: number;
}

const DEFAULT_LOCATION_SETTINGS: LocationSettings = {
  zipCode: '',
  radiusMiles: 25,
  lat: null,
  lon: null,
  lastUpdated: 0,
};

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
  const lowerName = lineItemName.toLowerCase().trim();

  // Common words to ignore in matching
  const ignoreWords = ['the', 'a', 'an', 'and', 'or', 'my', 'our'];

  // Split line item name into searchable words
  const lineItemWords = lowerName
    .split(/[\s\/\-&]+/)
    .filter(word => word.length > 2 && !ignoreWords.includes(word));

  return merchants.filter(merchant => {
    const keywords = getMerchantKeywords(merchant);
    const merchantName = (merchant.osm_json.tags.name || merchant.osm_json.tags['name:en'] || '').toLowerCase();
    const category = merchant.tags.category?.toLowerCase() || '';

    // Check if any keyword matches the line item name or its words
    const keywordMatch = keywords.some(keyword => {
      // Direct inclusion match
      if (lowerName.includes(keyword) || keyword.includes(lowerName)) {
        return true;
      }
      // Word-by-word match
      return lineItemWords.some(word =>
        keyword.includes(word) || word.includes(keyword)
      );
    });

    // Check merchant name
    const nameMatch = lineItemWords.some(word =>
      merchantName.includes(word) || word.includes(merchantName)
    ) || merchantName.includes(lowerName) || lowerName.includes(merchantName);

    // Check category directly
    const categoryMatch = lineItemWords.some(word =>
      category.includes(word) || word.includes(category)
    );

    return keywordMatch || nameMatch || categoryMatch;
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

// Convert miles to km
function milesToKm(miles: number): number {
  return miles * 1.60934;
}

// Format distance for display
export function formatDistance(km: number): string {
  const miles = km / 1.60934;
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

// Geocode a zip code to lat/lon using Nominatim (OpenStreetMap)
export async function geocodeZipCode(zipCode: string): Promise<{ lat: number; lon: number } | null> {
  try {
    // Use OpenStreetMap Nominatim for geocoding (free, no API key needed)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zipCode)}&format=json&limit=1`,
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'SatSorter/1.0 (Bitcoin Budget App)',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const results = await response.json();

    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Fetch merchants from BTCMap API
async function fetchMerchants(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<(BTCMapElement & { distance: number })[]> {
  // Calculate bounding box
  const latDelta = radiusKm / 111; // ~111km per degree latitude
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  const bounds = {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    west: lon - lonDelta,
  };

  // BTCMap API endpoint
  const response = await fetch(
    `https://api.btcmap.org/v2/elements?updated_since=2024-01-01&limit=10000`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch BTCMap data');
  }

  const elements: BTCMapElement[] = await response.json();

  // Filter by bounds, exclude deleted, and add distance
  // Note: deleted_at is "" for active merchants, so check for truthy non-empty string
  return elements
    .filter(el => {
      if (el.deleted_at && el.deleted_at !== '') return false;
      const elLat = el.osm_json.lat;
      const elLon = el.osm_json.lon;
      return elLat >= bounds.south && elLat <= bounds.north &&
             elLon >= bounds.west && elLon <= bounds.east;
    })
    .map(merchant => ({
      ...merchant,
      distance: calculateDistance(lat, lon, merchant.osm_json.lat, merchant.osm_json.lon),
    }))
    .filter(merchant => merchant.distance <= radiusKm) // Double-check within radius
    .sort((a, b) => a.distance - b.distance);
}

// Hook to manage location settings
export function useLocationSettings() {
  const [settings, setSettings] = useLocalStorage<LocationSettings>(
    'sat-sorter-location',
    DEFAULT_LOCATION_SETTINGS
  );

  const updateLocation = async (zipCode: string, radiusMiles: number): Promise<boolean> => {
    const coords = await geocodeZipCode(zipCode);

    if (coords) {
      setSettings({
        zipCode,
        radiusMiles,
        lat: coords.lat,
        lon: coords.lon,
        lastUpdated: Date.now(),
      });
      return true;
    }

    return false;
  };

  const updateRadius = (radiusMiles: number) => {
    setSettings(prev => ({ ...prev, radiusMiles }));
  };

  const clearLocation = () => {
    setSettings(DEFAULT_LOCATION_SETTINGS);
  };

  const hasLocation = settings.lat !== null && settings.lon !== null;

  return {
    settings,
    hasLocation,
    updateLocation,
    updateRadius,
    clearLocation,
  };
}

// Main hook for BTCMap integration
export function useBTCMap() {
  const { settings, hasLocation } = useLocationSettings();

  const query = useQuery({
    queryKey: ['btcmap-merchants', settings.lat, settings.lon, settings.radiusMiles],
    queryFn: async () => {
      if (!settings.lat || !settings.lon) return [];

      const radiusKm = milesToKm(settings.radiusMiles);
      return fetchMerchants(settings.lat, settings.lon, radiusKm);
    },
    enabled: hasLocation,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });

  return {
    merchants: query.data || [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    hasLocation,
    settings,
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
