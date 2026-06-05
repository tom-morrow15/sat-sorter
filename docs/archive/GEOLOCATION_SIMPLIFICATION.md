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

### Radius Selection
The search radius is now **user-adjustable** with these options:
- **Quick presets**: 5, 10, 25, 50, 100 miles (5 common choices)
- **Fine-tuning**: Up/Down buttons to adjust by 5-mile increments
- **Default**: 25 miles (good balance globally)
- **Range**: 1-500 miles

This gives users flexibility while keeping the interface simple.

### Search Format Recommendations
For best results, search using:
- **City, State**: "Middleburg, FL" ✅
- **City, Country**: "London, UK" ✅
- **Zip/Postal Code**: "90210" or "W1A 1AA" ✅
- **Full State Name**: "Middleburg, Florida" ✅

### API Integrations
- **Nominatim (OpenStreetMap)** - Geocoding and reverse-geocoding
  - Private/self-hosted option available
  - No authentication required
  - No personal data tracking
  - Works best with "City, State" or "City, Country" format

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

## UI Improvements

### Location Settings Discoverability
- **Location display is clickable** - Users can tap the location name to change it
- **Prominent "Change" button** - Makes it obvious how to modify settings
- **Current radius shown** - Users always see their selected search distance
- **External BTCMap link** - Quick access to full map view

### Pie Chart Formatting
- **Responsive layout** - Properly sized on mobile and desktop
- **No text overlap** - Center text doesn't overlap with the pie ring
- **Better spacing** - Legend positioned to the right on desktop, below on mobile
- **Smaller on mobile** - Optimized sizing for smaller screens (28x28 vs 36x36 on desktop)

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

### Search Functionality
- [x] Search works with "City, State" format (e.g., "Middleburg, FL")
- [x] Search works with "City, Country" format (e.g., "London, UK")
- [x] Search works with zip codes (e.g., "90210")
- [x] Error message shows helpful format suggestions
- [x] Location name displays correctly after search

### Radius Selection
- [x] Quick preset buttons (5, 10, 25, 50, 100) work
- [x] Up/Down buttons adjust radius by 5 miles
- [x] Selected radius applies to new searches
- [x] Current radius shows in location display
- [x] Radius updates on auto-detect

### UI/UX
- [x] Auto-detect location works (if permission granted)
- [x] Location is cleared when user clicks X button
- [x] Location name in banner is clickable
- [x] "Change" button is clearly visible
- [x] Merchants display within selected radius
- [x] Privacy notice is visible and clear
- [x] Pie chart text doesn't overlap on mobile/desktop
- [x] Works on mobile and desktop
- [x] Works on all browsers supporting geolocation API
