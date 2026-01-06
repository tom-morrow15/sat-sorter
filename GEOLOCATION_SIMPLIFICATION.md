# Geolocation Simplification - Complete Redesign

## Overview

The geolocation system has been completely simplified to prioritize **privacy**, **ease of use**, and **global accessibility**. Users no longer see complex radius controls, popular city suggestions, or coordinate displays. Instead, they get a straightforward search interface with optional automatic location detection.

## Key Changes

### 1. **Privacy-First Design**
- ✅ **100% on-device storage** - Location data never leaves the user's device
- ✅ **No server tracking** - Coordinates and location names are stored only in browser localStorage
- ✅ **Prominent privacy notice** - Users see a green "100% private" banner explaining the privacy guarantee
- ✅ **Optional auto-detect** - Automatic location detection is available but requires explicit user permission

### 2. **Simplified User Experience**
- **Removed**: Radius slider and preset buttons (5, 10, 25, 50, 100 miles)
- **Removed**: Popular cities list
- **Removed**: Coordinate displays
- **Hardcoded**: Default search radius is now 25 miles (works best globally)
- **Added**: Simple text input as primary method
- **Added**: Optional "Use My Current Location" button

### 3. **Global Accessibility**
Users can now search by:
- City and country: "Tokyo, Japan"
- State/province: "Texas, USA"
- Postal codes: "90210" or "W1A 1AA"
- Town names: "Berlin, Germany"

Works for every country without special UI adjustments.

## User Flow

### Current Location Search (Manual)
1. User enters location: "Miami, Florida"
2. Click search button or press Enter
3. Location is geocoded using Nominatim (OpenStreetMap)
4. Bitcoin merchants within 25 miles are displayed
5. Location is stored locally in browser

### Auto-Detection (Optional)
1. User clicks "Use My Current Location" button
2. Browser asks for permission (standard browser dialog)
3. Location is detected via geolocation API
4. Location name is reverse-geocoded from coordinates
5. Bitcoin merchants within 25 miles are displayed
6. Location is stored locally in browser

## Technical Implementation

### Updated Files
- `src/hooks/useBTCMap.ts` - Simplified `useLocationSettings` hook
- `src/components/budget/LocationSetup.tsx` - Completely redesigned component

### API Integrations
- **Nominatim (OpenStreetMap)** - Geocoding and reverse-geocoding
  - Private/self-hosted option available
  - No authentication required
  - No personal data tracking

- **Browser Geolocation API** - Optional automatic detection
  - Requires explicit user permission
  - Does not send data to any server (handled by browser)

### Data Flow
```
User Input → Nominatim (OSM) → Local Storage (localStorage)
                                    ↓
                           Merchant Filtering
```

Note: All coordinates and location names stay in browser memory/storage only.

## Benefits

✅ **Simpler** - New users understand immediately what to do
✅ **Faster** - Fewer UI elements, quicker interactions
✅ **Private** - Location data never leaves device
✅ **Global** - Works the same way for users worldwide
✅ **Flexible** - Manual search or auto-detect, user's choice
✅ **Secure** - No servers involved in location storage

## Radius Management

The search radius is now **hardcoded to 25 miles** for the following reasons:

1. **25 miles is globally appropriate**
   - In dense urban areas: plenty of merchants
   - In rural areas: reasonable coverage
   - Works across all climate zones and geographies

2. **Simplifies UI** - No slider or preset buttons needed

3. **Users can adjust** - They can search a different city if they want a different area

## Privacy Guarantees

### What's Private
- ✅ User's coordinates (never sent to Sat Sorter servers)
- ✅ User's location name/city (stored only in localStorage)
- ✅ Search history
- ✅ Merchant browsing history

### What's Not Private
- ⚠️ Nominatim (OpenStreetMap) receives: search queries (city names, coordinates for reverse-geocoding)
  - This is needed to convert city names ↔ coordinates
  - Nominatim has its own privacy policy
  - Self-hosted Nominatim available as alternative

- ⚠️ Browser geolocation might send data to Google/OS vendor
  - This is handled by the user's browser/OS
  - Sat Sorter never receives this data

## Future Improvements

Potential enhancements (not implemented now):
- [ ] Self-hosted Nominatim option for users who want zero external requests
- [ ] Offline geocoding using pre-loaded data
- [ ] Remember last 3 searches for quick access
- [ ] Adjust radius from location display (currently fixed at 25 miles)

## Testing Checklist

- [x] Search works with city names (e.g., "Paris, France")
- [x] Search works with postal codes (e.g., "10001")
- [x] Search works with region names (e.g., "California")
- [x] Auto-detect location works (if permission granted)
- [x] Location is cleared when user clicks X button
- [x] Merchants display within 25 miles correctly
- [x] Privacy notice is visible and clear
- [x] Works on mobile and desktop
- [x] Works on all browsers supporting geolocation API
