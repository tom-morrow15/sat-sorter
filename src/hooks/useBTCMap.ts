import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  showATMs: boolean; // Whether to include Bitcoin ATMs in results
}

const DEFAULT_LOCATION_SETTINGS: LocationSettings = {
  lat: null,
  lon: null,
  radiusMiles: 25,
  locationName: '',
  showATMs: false, // Default to hiding ATMs
};

// Category mappings from BTCMap categories to our budget line items
export const CATEGORY_MAPPINGS: Record<string, string[]> = {
  // Food & Drink
  'restaurant': ['restaurants', 'restaurant', 'dining', 'food', 'eating out', 'dinner', 'lunch', 'meals', 'casual dining', 'steakhouse', 'steak', 'grill'],
  'cafe': ['coffee', 'cafe', 'coffee shop', 'starbucks', 'breakfast', 'tea', 'espresso', 'coffee shop'],
  'bar': ['bar', 'drinks', 'alcohol', 'nightlife', 'entertainment', 'beer', 'wine', 'pub', 'lounge'],
  'fast_food': ['fast food', 'takeout', 'quick meals', 'food', 'burger', 'pizza', 'sandwich', 'chicken', 'tacos', 'shake', 'burgers', 'fries'],
  'pub': ['bar', 'pub', 'drinks', 'entertainment', 'beer', 'tavern'],
  'bakery': ['bakery', 'bread', 'pastries', 'food', 'breakfast', 'donut', 'donuts'],
  'ice_cream': ['ice cream', 'dessert', 'frozen', 'food'],
  'pizza': ['pizza', 'food', 'italian', 'dining', 'takeout'],
  'burger': ['burger', 'burgers', 'fast food', 'food', 'takeout'],
  'sandwich': ['sandwich', 'deli', 'fast food', 'takeout', 'food'],
  'sushi': ['sushi', 'japanese', 'restaurant', 'dining', 'food'],
  'bbq': ['bbq', 'barbecue', 'grill', 'restaurant', 'dining', 'food'],
  'mexican': ['mexican', 'taco', 'burrito', 'restaurant', 'dining', 'food'],
  'chinese': ['chinese', 'asian', 'restaurant', 'dining', 'food'],
  'indian': ['indian', 'restaurant', 'dining', 'food'],
  'thai': ['thai', 'restaurant', 'dining', 'food'],
  'vietnamese': ['vietnamese', 'restaurant', 'dining', 'food'],
  'korean': ['korean', 'restaurant', 'dining', 'food'],
  'middle_eastern': ['middle eastern', 'kebab', 'falafel', 'restaurant', 'dining', 'food'],

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

  // Additional casual/chain dining
  'diner': ['dining', 'restaurant', 'food', 'dinner', 'lunch', 'meals'],
  'burger_king': ['fast food', 'burger', 'food', 'takeout'],
  'mcdonalds': ['fast food', 'food', 'burger', 'takeout'],
  'wendys': ['fast food', 'burger', 'food', 'takeout'],
  'chickfila': ['fast food', 'chicken', 'food', 'takeout'],
  'popeyes': ['fast food', 'chicken', 'food', 'takeout'],
  'kfc': ['fast food', 'chicken', 'food', 'takeout'],
  'tacobell': ['fast food', 'tacos', 'food', 'takeout'],
  'subway': ['fast food', 'sandwich', 'food', 'takeout'],
  'jimmyjohns': ['fast food', 'sandwich', 'food', 'takeout'],
  'panerabread': ['cafe', 'bakery', 'sandwich', 'coffee', 'food'],
  'chipotle': ['fast food', 'mexican', 'food', 'takeout'],
  'qdoba': ['fast food', 'mexican', 'food', 'takeout'],

  // Other common
  'other': [],
};

// Get matching budget keywords for a merchant
export function getMerchantKeywords(element: BTCMapElement): string[] {
  const category = element.tags.category?.toLowerCase() || '';
  const osmTags = element.osm_json.tags;
  const merchantName = (osmTags.name || osmTags['name:en'] || '').toLowerCase();

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
    const cuisines = osmTags.cuisine.toLowerCase().split(/[;,]/);
    keywords.push(...cuisines.map(c => c.trim()).filter(c => c.length > 0));
  }

  // Extract individual words from merchant name for better matching
  // This helps match "Steak n Shake" even if the category is generic
  if (merchantName.length > 0) {
    const nameWords = merchantName
      .split(/[\s\-&\/]+/)
      .filter(word => word.length > 2 && !['the', 'and', 'or', 'in', 'at', 'by', 'for'].includes(word));
    keywords.push(...nameWords);
  }

  return [...new Set(keywords)]; // Remove duplicates
}

// Check if merchant is an ATM
function isATM(element: BTCMapElement): boolean {
  const category = element.tags.category?.toLowerCase() ?? '';
  const amenity = element.osm_json.tags.amenity?.toLowerCase() ?? '';
  const shop = element.osm_json.tags.shop?.toLowerCase() ?? '';
  const name = (element.osm_json.tags.name || element.osm_json.tags['name:en'] || '').toLowerCase();

  // Primary ATM indicators
  if (category === 'atm' || amenity === 'atm' || shop === 'atm') return true;

  // Name-based heuristics to catch Bitcoin ATMs / kiosks
  if (
    name.includes('bitcoin atm') ||
    name.includes('btc atm') ||
    name.includes('crypto atm') ||
    name.includes('bitcoin kiosk') ||
    name.includes('bitcoin teller') ||
    name.includes('coinflip bitcoin') ||
    name.includes('coinme') ||
    name.includes('coin cloud')
  ) {
    return true;
  }

  return false;
}

// Check if a line item matches any nearby merchants
export function lineItemMatchesMerchant(lineItemName: string, merchants: BTCMapElement[]): BTCMapElement[] {
  const lowerName = lineItemName.toLowerCase().trim();

  // Common words to ignore in matching
  const ignoreWords = ['the', 'a', 'an', 'and', 'or', 'my', 'our', 'in', 'at', 'to'];

  // Split line item name into searchable words
  const lineItemWords = lowerName
    .split(/[\s\/\-&]+/)
    .filter(word => word.length > 2 && !ignoreWords.includes(word));

  const matches = merchants.filter(merchant => {
    // EXCLUDE ATMs from line item matching
    if (isATM(merchant)) {
      return false;
    }

    const keywords = getMerchantKeywords(merchant);
    const merchantName = (merchant.osm_json.tags.name || merchant.osm_json.tags['name:en'] || '').toLowerCase();
    const category = merchant.tags.category?.toLowerCase() || '';
    const amenity = merchant.osm_json.tags.amenity?.toLowerCase() || '';
    const shop = merchant.osm_json.tags.shop?.toLowerCase() || '';

    // EXACT or STRONG NAME MATCH - highest priority
    // Direct merchant name match (e.g., "Steak n Shake" matches "Steak n Shake")
    if (merchantName === lowerName || merchantName.includes(lowerName)) {
      return true;
    }

    // Line item includes merchant name (e.g., "Dinner at Steak n Shake" matches "Steak n Shake")
    if (lowerName.includes(merchantName) && merchantName.length > 3) {
      return true;
    }

    // WORD-BY-WORD MATCHING - check individual words
    const lineItemWordMatches = lineItemWords.filter(word => {
      // Direct word match in merchant name (case-insensitive)
      const merchantWords = merchantName.split(/[\s\-&\/]+/);
      if (merchantWords.some(mw => mw === word || mw.includes(word))) {
        return true;
      }
      // Check if any keyword contains this word
      return keywords.some(keyword => keyword.includes(word));
    });

    // If 2+ words match or all line item words match, it's a good match
    if (lineItemWords.length > 0) {
      const matchRatio = lineItemWordMatches.length / lineItemWords.length;
      if (matchRatio >= 0.67 || lineItemWordMatches.length >= 2) {
        return true;
      }
    }

    // CATEGORY MATCHING - broader fallback
    // Check if any keyword matches the line item
    const keywordMatch = keywords.some(keyword => {
      // At least 3 chars for meaningful match
      if (keyword.length < 3) return false;

      // Check if keyword is in line item
      return lowerName.includes(keyword);
    });

    // Category or amenity direct match with keywords
    const categoryMatch = lineItemWords.some(word => {
      return category.includes(word) || amenity.includes(word) || shop.includes(word);
    });

    return keywordMatch || categoryMatch;
  });

  // Log for debugging if we found matches
  if (matches.length > 0) {
    console.log(`[BTCMap] Matched "${lineItemName}" to ${matches.length} merchant(s):`,
      matches.map(m => m.osm_json.tags.name || m.osm_json.tags['name:en']).slice(0, 3));
  }

  return matches;
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
  const activeMerchants = elements.filter(el => !el.deleted_at || el.deleted_at === '');

  // Log stats for debugging
  console.log(`[BTCMap] Fetched ${activeMerchants.length} active merchants out of ${elements.length} total`);

  return activeMerchants;
}

// Filter merchants by location and radius
function filterMerchantsByLocation(
  merchants: BTCMapElement[],
  lat: number,
  lon: number,
  radiusKm: number,
  showATMs: boolean = false
): (BTCMapElement & { distance: number })[] {
  return merchants
    .filter(merchant => showATMs || !isATM(merchant))
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
    setSettings(prev => ({
      ...prev,
      lat,
      lon,
      radiusMiles,
      locationName,
    }));
  };

  const updateRadius = (radiusMiles: number) => {
    setSettings(prev => ({ ...prev, radiusMiles }));
  };

  const toggleShowATMs = () => {
    setSettings(prev => ({ ...prev, showATMs: !prev.showATMs }));
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
    toggleShowATMs,
    clearLocation,
  };
}

// Main hook for BTCMap integration
export function useBTCMap() {
  const { settings, hasLocation, toggleShowATMs } = useLocationSettings();
  const queryClient = useQueryClient();

  // Fetch all merchants once and cache
  const allMerchantsQuery = useQuery({
    queryKey: ['btcmap-all-merchants'],
    queryFn: fetchAllMerchants,
    staleTime: 1800000, // 30 minutes - data considered fresh
    gcTime: 3600000, // 1 hour - keep in cache
    refetchOnWindowFocus: false,
  });

  // Force refetch that invalidates cache first to ensure fresh data
  const forceRefetch = useCallback(async () => {
    console.log('[BTCMap] Manual refresh triggered');
    // Invalidate the cache to force a fresh fetch
    await queryClient.invalidateQueries({ queryKey: ['btcmap-all-merchants'] });
    // Refetch returns immediately with cached data, need to get fresh
    const result = await queryClient.fetchQuery({
      queryKey: ['btcmap-all-merchants'],
      queryFn: fetchAllMerchants,
      staleTime: 0, // Force fresh fetch
    });
    console.log('[BTCMap] Refresh complete, got', result?.length, 'merchants');
    return { data: result };
  }, [queryClient]);

  // Filter by user's location
  const merchants = allMerchantsQuery.data && hasLocation && settings.lat && settings.lon
    ? filterMerchantsByLocation(
        allMerchantsQuery.data,
        settings.lat,
        settings.lon,
        milesToKm(settings.radiusMiles),
        settings.showATMs
      )
    : [];

  return {
    merchants,
    isLoading: allMerchantsQuery.isLoading || allMerchantsQuery.isFetching,
    error: allMerchantsQuery.error instanceof Error ? allMerchantsQuery.error.message : null,
    hasLocation,
    settings,
    totalMerchants: allMerchantsQuery.data?.length || 0,
    refetch: forceRefetch,
    toggleShowATMs,
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

// Geocode a location query (city, state, zip code, etc.)
export async function geocodeLocation(query: string): Promise<{ lat: number; lon: number; displayName: string } | null> {
  try {
    // Use Nominatim to search for the location
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
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
      const result = results[0];

      // Create a friendly display name from the address
      let displayName = query;
      if (result.address) {
        const parts = [];
        if (result.address.city || result.address.town || result.address.village) {
          parts.push(result.address.city || result.address.town || result.address.village);
        }
        if (result.address.state) {
          parts.push(result.address.state);
        }
        if (parts.length > 0) {
          displayName = parts.join(', ');
        }
      }

      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        displayName,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
