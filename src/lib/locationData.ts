/**
 * Location data for country/state/city selection
 * Curated data for major locations worldwide
 */

export interface LocationEntry {
  country: string;
  countryCode: string;
  state?: string;
  city: string;
  lat: number;
  lon: number;
}

// Major cities worldwide organized by country and state/region
export const LOCATION_DATA: LocationEntry[] = [
  // United States
  { country: 'United States', countryCode: 'US', state: 'California', city: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { country: 'United States', countryCode: 'US', state: 'California', city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { country: 'United States', countryCode: 'US', state: 'California', city: 'San Diego', lat: 32.7157, lon: -117.1611 },
  { country: 'United States', countryCode: 'US', state: 'California', city: 'Sacramento', lat: 38.5816, lon: -121.4944 },
  { country: 'United States', countryCode: 'US', state: 'Texas', city: 'Houston', lat: 29.7604, lon: -95.3698 },
  { country: 'United States', countryCode: 'US', state: 'Texas', city: 'Dallas', lat: 32.7767, lon: -96.7970 },
  { country: 'United States', countryCode: 'US', state: 'Texas', city: 'Austin', lat: 30.2672, lon: -97.7431 },
  { country: 'United States', countryCode: 'US', state: 'Texas', city: 'San Antonio', lat: 29.4241, lon: -98.4936 },
  { country: 'United States', countryCode: 'US', state: 'Florida', city: 'Miami', lat: 25.7617, lon: -80.1918 },
  { country: 'United States', countryCode: 'US', state: 'Florida', city: 'Jacksonville', lat: 30.3322, lon: -81.6557 },
  { country: 'United States', countryCode: 'US', state: 'Florida', city: 'Tampa', lat: 27.9506, lon: -82.4572 },
  { country: 'United States', countryCode: 'US', state: 'Florida', city: 'Orlando', lat: 28.5421, lon: -81.3723 },
  { country: 'United States', countryCode: 'US', state: 'New York', city: 'New York City', lat: 40.7128, lon: -74.0060 },
  { country: 'United States', countryCode: 'US', state: 'New York', city: 'Buffalo', lat: 42.8864, lon: -78.8784 },
  { country: 'United States', countryCode: 'US', state: 'New York', city: 'Rochester', lat: 43.1629, lon: -77.6088 },
  { country: 'United States', countryCode: 'US', state: 'Pennsylvania', city: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
  { country: 'United States', countryCode: 'US', state: 'Pennsylvania', city: 'Pittsburgh', lat: 40.4406, lon: -79.9959 },
  { country: 'United States', countryCode: 'US', state: 'Illinois', city: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { country: 'United States', countryCode: 'US', state: 'Ohio', city: 'Columbus', lat: 39.9612, lon: -82.9988 },
  { country: 'United States', countryCode: 'US', state: 'Ohio', city: 'Cleveland', lat: 41.4993, lon: -81.6944 },
  { country: 'United States', countryCode: 'US', state: 'Ohio', city: 'Cincinnati', lat: 39.1131, lon: -84.5080 },
  { country: 'United States', countryCode: 'US', state: 'Georgia', city: 'Atlanta', lat: 33.7490, lon: -84.3880 },
  { country: 'United States', countryCode: 'US', state: 'Massachusetts', city: 'Boston', lat: 42.3601, lon: -71.0589 },
  { country: 'United States', countryCode: 'US', state: 'Washington', city: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { country: 'United States', countryCode: 'US', state: 'Arizona', city: 'Phoenix', lat: 33.4484, lon: -112.0742 },
  { country: 'United States', countryCode: 'US', state: 'Nevada', city: 'Las Vegas', lat: 36.1699, lon: -115.1398 },
  { country: 'United States', countryCode: 'US', state: 'Colorado', city: 'Denver', lat: 39.7392, lon: -104.9903 },

  // Canada
  { country: 'Canada', countryCode: 'CA', state: 'Ontario', city: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { country: 'Canada', countryCode: 'CA', state: 'Ontario', city: 'Ottawa', lat: 45.4215, lon: -75.6972 },
  { country: 'Canada', countryCode: 'CA', state: 'Quebec', city: 'Montreal', lat: 45.5017, lon: -73.5673 },
  { country: 'Canada', countryCode: 'CA', state: 'Quebec', city: 'Quebec City', lat: 46.8139, lon: -71.2080 },
  { country: 'Canada', countryCode: 'CA', state: 'British Columbia', city: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { country: 'Canada', countryCode: 'CA', state: 'Alberta', city: 'Calgary', lat: 51.0447, lon: -114.0719 },
  { country: 'Canada', countryCode: 'CA', state: 'Alberta', city: 'Edmonton', lat: 53.5461, lon: -113.4938 },

  // United Kingdom
  { country: 'United Kingdom', countryCode: 'GB', state: 'England', city: 'London', lat: 51.5074, lon: -0.1278 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'England', city: 'Manchester', lat: 53.4808, lon: -2.2426 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'England', city: 'Birmingham', lat: 52.5086, lon: -1.8755 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'England', city: 'Liverpool', lat: 53.4084, lon: -2.9916 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'Scotland', city: 'Edinburgh', lat: 55.9533, lon: -3.1883 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'Scotland', city: 'Glasgow', lat: 55.8642, lon: -4.2518 },
  { country: 'United Kingdom', countryCode: 'GB', state: 'Wales', city: 'Cardiff', lat: 51.4816, lon: -3.1791 },

  // France
  { country: 'France', countryCode: 'FR', state: 'Île-de-France', city: 'Paris', lat: 48.8566, lon: 2.3522 },
  { country: 'France', countryCode: 'FR', state: 'Provence-Alpes-Côte d\'Azur', city: 'Nice', lat: 43.7102, lon: 7.2620 },
  { country: 'France', countryCode: 'FR', state: 'Auvergne-Rhône-Alpes', city: 'Lyon', lat: 45.7640, lon: 4.8357 },
  { country: 'France', countryCode: 'FR', state: 'Occitanie', city: 'Toulouse', lat: 43.6047, lon: 1.4422 },

  // Germany
  { country: 'Germany', countryCode: 'DE', state: 'Berlin', city: 'Berlin', lat: 52.5200, lon: 13.4050 },
  { country: 'Germany', countryCode: 'DE', state: 'Bavaria', city: 'Munich', lat: 48.1351, lon: 11.5820 },
  { country: 'Germany', countryCode: 'DE', state: 'Hesse', city: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  { country: 'Germany', countryCode: 'DE', state: 'North Rhine-Westphalia', city: 'Cologne', lat: 50.9375, lon: 6.9603 },

  // Spain
  { country: 'Spain', countryCode: 'ES', state: 'Madrid', city: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { country: 'Spain', countryCode: 'ES', state: 'Catalonia', city: 'Barcelona', lat: 41.3851, lon: 2.1734 },
  { country: 'Spain', countryCode: 'ES', state: 'Valencia', city: 'Valencia', lat: 39.4699, lon: -0.3763 },

  // Italy
  { country: 'Italy', countryCode: 'IT', state: 'Lazio', city: 'Rome', lat: 41.9028, lon: 12.4964 },
  { country: 'Italy', countryCode: 'IT', state: 'Lombardy', city: 'Milan', lat: 45.4642, lon: 9.1900 },
  { country: 'Italy', countryCode: 'IT', state: 'Tuscany', city: 'Florence', lat: 43.7696, lon: 11.2558 },

  // Japan
  { country: 'Japan', countryCode: 'JP', state: 'Tokyo', city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { country: 'Japan', countryCode: 'JP', state: 'Osaka', city: 'Osaka', lat: 34.6937, lon: 135.5023 },
  { country: 'Japan', countryCode: 'JP', state: 'Kyoto', city: 'Kyoto', lat: 35.0116, lon: 135.7681 },

  // China
  { country: 'China', countryCode: 'CN', state: 'Beijing', city: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { country: 'China', countryCode: 'CN', state: 'Shanghai', city: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { country: 'China', countryCode: 'CN', state: 'Guangdong', city: 'Guangzhou', lat: 23.1291, lon: 113.2644 },
  { country: 'China', countryCode: 'CN', state: 'Chongqing', city: 'Chongqing', lat: 29.5630, lon: 106.5516 },

  // Brazil
  { country: 'Brazil', countryCode: 'BR', state: 'São Paulo', city: 'São Paulo', lat: -23.5505, lon: -46.6333 },
  { country: 'Brazil', countryCode: 'BR', state: 'Rio de Janeiro', city: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
  { country: 'Brazil', countryCode: 'BR', state: 'Bahia', city: 'Salvador', lat: -12.9714, lon: -38.5014 },
  { country: 'Brazil', countryCode: 'BR', state: 'Minas Gerais', city: 'Belo Horizonte', lat: -19.8267, lon: -43.9449 },

  // Mexico
  { country: 'Mexico', countryCode: 'MX', state: 'Mexico City', city: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { country: 'Mexico', countryCode: 'MX', state: 'Jalisco', city: 'Guadalajara', lat: 20.6597, lon: -103.2494 },
  { country: 'Mexico', countryCode: 'MX', state: 'Nuevo León', city: 'Monterrey', lat: 25.6866, lon: -100.3161 },

  // Australia
  { country: 'Australia', countryCode: 'AU', state: 'New South Wales', city: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { country: 'Australia', countryCode: 'AU', state: 'Victoria', city: 'Melbourne', lat: -37.8136, lon: 144.9631 },
  { country: 'Australia', countryCode: 'AU', state: 'Queensland', city: 'Brisbane', lat: -27.4698, lon: 153.0251 },

  // India
  { country: 'India', countryCode: 'IN', state: 'Maharashtra', city: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { country: 'India', countryCode: 'IN', state: 'Delhi', city: 'New Delhi', lat: 28.6139, lon: 77.2090 },
  { country: 'India', countryCode: 'IN', state: 'Karnataka', city: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { country: 'India', countryCode: 'IN', state: 'Tamil Nadu', city: 'Chennai', lat: 13.0827, lon: 80.2707 },

  // Singapore
  { country: 'Singapore', countryCode: 'SG', state: 'Singapore', city: 'Singapore', lat: 1.3521, lon: 103.8198 },

  // Hong Kong
  { country: 'Hong Kong', countryCode: 'HK', state: 'Hong Kong', city: 'Hong Kong', lat: 22.3193, lon: 114.1694 },

  // South Korea
  { country: 'South Korea', countryCode: 'KR', state: 'Seoul', city: 'Seoul', lat: 37.5665, lon: 126.9780 },
  { country: 'South Korea', countryCode: 'KR', state: 'Busan', city: 'Busan', lat: 35.1796, lon: 129.0756 },

  // Thailand
  { country: 'Thailand', countryCode: 'TH', state: 'Bangkok', city: 'Bangkok', lat: 13.7563, lon: 100.5018 },

  // Philippines
  { country: 'Philippines', countryCode: 'PH', state: 'Metro Manila', city: 'Manila', lat: 14.5995, lon: 120.9842 },

  // Indonesia
  { country: 'Indonesia', countryCode: 'ID', state: 'Special Capital Region', city: 'Jakarta', lat: -6.2088, lon: 106.8456 },

  // Malaysia
  { country: 'Malaysia', countryCode: 'MY', state: 'Kuala Lumpur', city: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869 },

  // Vietnam
  { country: 'Vietnam', countryCode: 'VN', state: 'Ho Chi Minh', city: 'Ho Chi Minh City', lat: 10.7769, lon: 106.7009 },
  { country: 'Vietnam', countryCode: 'VN', state: 'Hanoi', city: 'Hanoi', lat: 21.0285, lon: 105.8542 },

  // Argentina
  { country: 'Argentina', countryCode: 'AR', state: 'Buenos Aires', city: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },

  // Chile
  { country: 'Chile', countryCode: 'CL', state: 'Santiago', city: 'Santiago', lat: -33.8688, lon: -51.2093 },

  // Colombia
  { country: 'Colombia', countryCode: 'CO', state: 'Bogotá', city: 'Bogotá', lat: 4.7110, lon: -74.0721 },

  // Peru
  { country: 'Peru', countryCode: 'PE', state: 'Lima', city: 'Lima', lat: -12.0464, lon: -77.0428 },

  // South Africa
  { country: 'South Africa', countryCode: 'ZA', state: 'Gauteng', city: 'Johannesburg', lat: -26.2023, lon: 28.0436 },
  { country: 'South Africa', countryCode: 'ZA', state: 'Western Cape', city: 'Cape Town', lat: -33.9249, lon: 18.4241 },

  // Egypt
  { country: 'Egypt', countryCode: 'EG', state: 'Cairo', city: 'Cairo', lat: 30.0444, lon: 31.2357 },

  // Nigeria
  { country: 'Nigeria', countryCode: 'NG', state: 'Lagos', city: 'Lagos', lat: 6.5244, lon: 3.3792 },

  // Kenya
  { country: 'Kenya', countryCode: 'KE', state: 'Nairobi', city: 'Nairobi', lat: -1.2865, lon: 36.8172 },

  // Saudi Arabia
  { country: 'Saudi Arabia', countryCode: 'SA', state: 'Riyadh', city: 'Riyadh', lat: 24.7136, lon: 46.6753 },

  // United Arab Emirates
  { country: 'United Arab Emirates', countryCode: 'AE', state: 'Dubai', city: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { country: 'United Arab Emirates', countryCode: 'AE', state: 'Abu Dhabi', city: 'Abu Dhabi', lat: 24.4539, lon: 54.3773 },

  // Israel
  { country: 'Israel', countryCode: 'IL', state: 'Tel Aviv', city: 'Tel Aviv', lat: 32.0853, lon: 34.7818 },
  { country: 'Israel', countryCode: 'IL', state: 'Jerusalem', city: 'Jerusalem', lat: 31.7683, lon: 35.2137 },

  // Turkey
  { country: 'Turkey', countryCode: 'TR', state: 'Istanbul', city: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { country: 'Turkey', countryCode: 'TR', state: 'Ankara', city: 'Ankara', lat: 39.9334, lon: 32.8597 },

  // Greece
  { country: 'Greece', countryCode: 'GR', state: 'Attica', city: 'Athens', lat: 37.9838, lon: 23.7275 },

  // New Zealand
  { country: 'New Zealand', countryCode: 'NZ', state: 'Auckland', city: 'Auckland', lat: -37.0742, lon: 174.6053 },
  { country: 'New Zealand', countryCode: 'NZ', state: 'Wellington', city: 'Wellington', lat: -41.2865, lon: 174.7762 },

  // Switzerland
  { country: 'Switzerland', countryCode: 'CH', state: 'Zurich', city: 'Zurich', lat: 47.3769, lon: 8.5472 },
  { country: 'Switzerland', countryCode: 'CH', state: 'Geneva', city: 'Geneva', lat: 46.2044, lon: 6.1432 },

  // Netherlands
  { country: 'Netherlands', countryCode: 'NL', state: 'North Holland', city: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { country: 'Netherlands', countryCode: 'NL', state: 'South Holland', city: 'Rotterdam', lat: 51.9225, lon: 4.4792 },

  // Belgium
  { country: 'Belgium', countryCode: 'BE', state: 'Brussels', city: 'Brussels', lat: 50.8503, lon: 4.3517 },

  // Austria
  { country: 'Austria', countryCode: 'AT', state: 'Vienna', city: 'Vienna', lat: 48.2082, lon: 16.3738 },

  // Poland
  { country: 'Poland', countryCode: 'PL', state: 'Masovian', city: 'Warsaw', lat: 52.2297, lon: 21.0122 },
  { country: 'Poland', countryCode: 'PL', state: 'Lesser Poland', city: 'Krakow', lat: 50.0647, lon: 19.9450 },

  // Czech Republic
  { country: 'Czech Republic', countryCode: 'CZ', state: 'Prague', city: 'Prague', lat: 50.0755, lon: 14.4378 },

  // Hungary
  { country: 'Hungary', countryCode: 'HU', state: 'Budapest', city: 'Budapest', lat: 47.4979, lon: 19.0402 },

  // Romania
  { country: 'Romania', countryCode: 'RO', state: 'Bucharest', city: 'Bucharest', lat: 44.4268, lon: 26.1025 },

  // Portugal
  { country: 'Portugal', countryCode: 'PT', state: 'Lisbon', city: 'Lisbon', lat: 38.7223, lon: -9.1393 },

  // Ireland
  { country: 'Ireland', countryCode: 'IE', state: 'Dublin', city: 'Dublin', lat: 53.3498, lon: -6.2603 },

  // Scandinavia
  { country: 'Sweden', countryCode: 'SE', state: 'Stockholm', city: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { country: 'Norway', countryCode: 'NO', state: 'Oslo', city: 'Oslo', lat: 59.9139, lon: 10.7522 },
  { country: 'Denmark', countryCode: 'DK', state: 'Copenhagen', city: 'Copenhagen', lat: 55.6761, lon: 12.5683 },
  { country: 'Finland', countryCode: 'FI', state: 'Helsinki', city: 'Helsinki', lat: 60.1699, lon: 24.9384 },
];

/**
 * Get unique countries from location data
 */
export function getCountries(): string[] {
  const countries = [...new Set(LOCATION_DATA.map(loc => loc.country))];
  return countries.sort();
}

/**
 * Get states for a specific country
 */
export function getStatesByCountry(country: string): string[] {
  const states = [...new Set(
    LOCATION_DATA
      .filter(loc => loc.country === country)
      .map(loc => loc.state || 'General')
  )];
  return states.sort();
}

/**
 * Get cities for a specific country and state
 */
export function getCitiesByCountryAndState(country: string, state?: string): string[] {
  const cities = [...new Set(
    LOCATION_DATA
      .filter(loc => 
        loc.country === country && 
        (!state || loc.state === state || (state === 'General' && !loc.state))
      )
      .map(loc => loc.city)
  )];
  return cities.sort();
}

/**
 * Get coordinates for a specific location
 */
export function getLocationCoordinates(country: string, state?: string, city?: string): { lat: number; lon: number } | null {
  const location = LOCATION_DATA.find(loc => 
    loc.country === country && 
    loc.city === city &&
    (!state || loc.state === state)
  );
  
  if (location) {
    return { lat: location.lat, lon: location.lon };
  }
  
  return null;
}

/**
 * Get a display name for selected location
 */
export function getLocationDisplayName(country: string, state?: string, city?: string): string {
  const parts = [city, state, country].filter(Boolean);
  return parts.join(', ');
}
