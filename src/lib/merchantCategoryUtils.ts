/**
 * Merchant Category Utilities
 * Helps identify and organize merchants by their OSM categories
 */

import type { BTCMapElement } from '@/hooks/useBTCMap';

/**
 * Categorize a merchant into a meaningful group
 * Returns a human-readable category name
 */
export function getMerchantCategoryGroup(merchant: BTCMapElement): string {
  const category = merchant.tags.category?.toLowerCase() ?? '';
  const amenity = merchant.osm_json.tags.amenity?.toLowerCase() ?? '';
  const shop = merchant.osm_json.tags.shop?.toLowerCase() ?? '';

  // Map OSM categories to friendly group names
  const categoryGroups: Record<string, string> = {
    // Food & Dining
    'restaurant': 'Restaurants',
    'cafe': 'Cafes & Coffee',
    'bar': 'Bars & Drinks',
    'fast_food': 'Fast Food',
    'pub': 'Pubs & Bars',
    'bakery': 'Bakeries',
    'ice_cream': 'Desserts',
    'pizza': 'Pizza',
    'burger': 'Burgers',
    'sandwich': 'Sandwiches',
    'sushi': 'Sushi & Asian',
    'bbq': 'Barbecue',
    'mexican': 'Mexican',
    'chinese': 'Chinese',
    'indian': 'Indian',
    'thai': 'Thai',
    'vietnamese': 'Vietnamese',
    'korean': 'Korean',
    'middle_eastern': 'Middle Eastern',
    'diner': 'Diners',

    // Shopping
    'supermarket': 'Grocery & Shopping',
    'convenience': 'Convenience',
    'clothes': 'Clothing & Fashion',
    'electronics': 'Electronics',
    'beauty': 'Beauty & Personal Care',
    'hardware': 'Hardware & Tools',
    'books': 'Books & Media',
    'gift': 'Gift Shops',

    // Transportation
    'fuel': 'Gas Stations',
    'car_repair': 'Auto Services',
    'car_rental': 'Car Rentals',
    'taxi': 'Ride Services',
    'parking': 'Parking',

    // Accommodation
    'hotel': 'Hotels & Lodging',
    'hostel': 'Hostels',
    'apartment': 'Apartment Rentals',

    // Health & Fitness
    'pharmacy': 'Pharmacies',
    'gym': 'Gyms & Fitness',
    'fitness_center': 'Fitness Centers',
    'dentist': 'Dental',
    'doctor': 'Medical',
    'spa': 'Spas & Wellness',

    // Services
    'atm': 'ATMs & Banking',
    'bank': 'Banking',
    'coworking': 'Coworking',
    'laundry': 'Laundry & Cleaning',
    'hairdresser': 'Hair & Beauty',

    // Entertainment
    'cinema': 'Movies & Cinema',
    'theatre': 'Theatre & Shows',
    'music': 'Music Venues',
    'sports': 'Sports & Games',

    // Education
    'school': 'Schools',
    'university': 'Universities',

    // Pets
    'veterinary': 'Veterinary',
    'pet_shop': 'Pet Shops',

    // Other common
    'other': 'Other Businesses',
  };

  // Try to find a match in priority order
  if (categoryGroups[category]) {
    return categoryGroups[category];
  }

  if (categoryGroups[amenity]) {
    return categoryGroups[amenity];
  }

  if (categoryGroups[shop]) {
    return categoryGroups[shop];
  }

  // Default fallback
  return 'Other Businesses';
}

/**
 * Check if a merchant is in the "Other" category
 * This includes merchants with unrecognized categories
 */
export function isOtherCategory(merchant: BTCMapElement): boolean {
  const category = getMerchantCategoryGroup(merchant);
  return category === 'Other Businesses';
}

/**
 * Get a descriptive label for "Other" merchants
 * Includes the merchant name and category from OSM
 */
export function getOtherCategoryLabel(merchant: BTCMapElement): string {
  const name = merchant.osm_json.tags.name || merchant.osm_json.tags['name:en'] || 'Bitcoin Merchant';
  const category = merchant.tags.category ?? merchant.osm_json.tags.amenity ?? 'unknown';

  // Return a human-readable label
  return `${name} (${category})`;
}

/**
 * Separate merchants into main categories and "Other"
 * Useful for displaying in the UI with a separate "Other" section
 */
export function segregateMerchantsByCategory(merchants: BTCMapElement[]): {
  byCategory: Record<string, BTCMapElement[]>;
  other: BTCMapElement[];
} {
  const byCategory: Record<string, BTCMapElement[]> = {};
  const other: BTCMapElement[] = [];

  for (const merchant of merchants) {
    const group = getMerchantCategoryGroup(merchant);

    if (group === 'Other Businesses') {
      other.push(merchant);
    } else {
      if (!byCategory[group]) {
        byCategory[group] = [];
      }
      byCategory[group].push(merchant);
    }
  }

  return { byCategory, other };
}

/**
 * Create a sortable list of categories
 * Orders categories by frequency and importance
 */
export function getSortedCategories(merchants: BTCMapElement[]): string[] {
  const { byCategory } = segregateMerchantsByCategory(merchants);

  // Priority order for common categories
  const priorityOrder = [
    'Restaurants',
    'Cafes & Coffee',
    'Fast Food',
    'Grocery & Shopping',
    'Gas Stations',
    'Auto Services',
    'Pharmacies',
    'Hotels & Lodging',
    'Gyms & Fitness',
    'Entertainment',
    'Banking',
  ];

  const categories = Object.keys(byCategory);

  // Sort: priority categories first, then alphabetical
  return categories.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;

    return a.localeCompare(b);
  });
}
