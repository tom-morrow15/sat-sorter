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
      'addr:state'?: string;
      'addr:country'?: string;
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
  lat: number | null;
  lon: number | null;
  radiusMiles: number;
  locationName: string; // User-friendly name
}

const DEFAULT_LOCATION_SETTINGS: LocationSettings = {
  lat: null,
  lon: null,
  radiusMiles: 25,
  locationName: '',
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

// Fetch ALL merchants from BTCMap API (no date filtering)
async function fetchAllMerchants(): Promise<BTCMapElement[]> {
  const response = await fetch(
    `https://api.btcmap.org/v2/elements`,
    { signal: AbortSignal.timeout(30000) }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch BTCMap data');
  }
  
  const elements: BTCMapElement[] = await response.json();
  
  // Filter out deleted merchants
  return elements.filter(el => !el.deleted_at || el.deleted_at === '');
}

// Filter merchants by location and radius
function filterMerchantsByLocation(
  merchants: BTCMapElement[],
  lat: number,
  lon: number,
  radiusKm: number
): (BTCMapElement & { distance: number })[] {
  return merchants
    .map(merchant => ({
      ...merchant,
      distance: calculateDistance(lat, lon, merchant.osm_json.lat, merchant.osm_json.lon),
    }))
    .filter(merchant => merchant.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

// Hook to manage location settings
export function useLocationSettings() {
  const [settings, setSettings] = useLocalStorage<LocationSettings>(
    'sat-sorter-location',
    DEFAULT_LOCATION_SETTINGS
  );

  const updateLocation = (lat: number, lon: number, radiusMiles: number, locationName: string) => {
    setSettings({
      lat,
      lon,
      radiusMiles,
      locationName,
    });
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

  // Fetch all merchants once and cache
  const allMerchantsQuery = useQuery({
    queryKey: ['btcmap-all-merchants'],
    queryFn: fetchAllMerchants,
    staleTime: 1800000, // 30 minutes
    gcTime: 3600000, // 1 hour
  });

  // Filter by user's location
  const merchants = allMerchantsQuery.data && hasLocation && settings.lat && settings.lon
    ? filterMerchantsByLocation(
        allMerchantsQuery.data,
        settings.lat,
        settings.lon,
        milesToKm(settings.radiusMiles)
      )
    : [];

  return {
    merchants,
    isLoading: allMerchantsQuery.isLoading,
    error: allMerchantsQuery.error instanceof Error ? allMerchantsQuery.error.message : null,
    hasLocation,
    settings,
    totalMerchants: allMerchantsQuery.data?.length || 0,
    refetch: allMerchantsQuery.refetch,
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

// Get merchant location info for display
export function getMerchantLocation(element: BTCMapElement): string {
  const tags = element.osm_json.tags;
  const parts = [];
  
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:state']) parts.push(tags['addr:state']);
  if (tags['addr:country']) parts.push(tags['addr:country']);
  
  return parts.join(', ') || 'Unknown location';
}
