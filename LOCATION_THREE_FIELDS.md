# Location Selection - Three Input Fields Implementation

## Overview

The location selection system now uses **three separate text input fields** instead of dropdowns or single search. This provides clarity and prevents ambiguity about location components.

## User Interface

### Three Input Fields

1. **Country** (required)
   - Placeholder: "e.g., United States"
   - Examples: "United States", "Japan", "Brazil", "France"

2. **State / Region** (optional)
   - Placeholder: "e.g., Florida"
   - Examples: "Florida", "California", "Ontario", "Tokyo"
   - Can be left blank if not applicable

3. **City** (required)
   - Placeholder: "e.g., Jacksonville"
   - Examples: "Jacksonville", "Miami", "Tokyo", "São Paulo"

### How It Works

1. User fills in Country field
2. User optionally fills in State/Region field
3. User fills in City field
4. User presses Enter or clicks Search button
5. System builds search query: "Jacksonville, Florida, United States"
6. Query is geocoded and location is set
7. Merchants within selected radius appear

## Search Query Building

The system builds the search query as:
```
[City], [State], [Country]
(filtering out empty fields)
```

**Examples:**
- Input: Country="United States", State="Florida", City="Jacksonville"
  → Search: "Jacksonville, Florida, United States"
  
- Input: Country="Japan", State="", City="Tokyo"
  → Search: "Tokyo, Japan"
  
- Input: Country="Brazil", State="São Paulo", City="São Paulo"
  → Search: "São Paulo, São Paulo, Brazil"

## Radius Selection

The radius selector remains unchanged:
- Always visible
- 5 quick presets: 5, 10, 25, 50, 100 miles
- Selected before or after filling in location fields

## Auto-Detect Option

The "Use My Current Location" button:
- Available as secondary option
- Below radius selector with "OR USE" divider
- Works with browser geolocation API
- Automatically detects location coordinates

## Validation

**Required fields**: Country and City
**Optional fields**: State/Region

Users will see error if:
- Country field is empty
- City field is empty
- Location cannot be geocoded (spelling errors, etc.)

## Privacy

✅ All location data stored only in browser (localStorage)
✅ Never sent to Sat Sorter servers
✅ Nominatim (OpenStreetMap) receives search query only
✅ User's Nostr identity not linked to location

## Error Handling

If location search fails:
- User sees error message: "Location not found. Please check your spelling and try again."
- User can modify fields and try again
- Fields remain filled for quick correction
- Auto-detect option available as fallback

## Example Flows

### Flow 1: United States Location
```
Country: United States
State: Florida
City: Jacksonville
→ Searches "Jacksonville, Florida, United States"
```

### Flow 2: International Location
```
Country: Japan
State: (left blank)
City: Tokyo
→ Searches "Tokyo, Japan"
```

### Flow 3: Auto-Detect
```
User clicks "Use My Current Location"
Browser asks for permission
System detects: latitude/longitude
System displays approximate location name
```

## Technical Details

- **Geocoding**: Uses Nominatim (OpenStreetMap)
- **API**: Free, no authentication required
- **Privacy**: Search queries sent to Nominatim only (their privacy policy applies)
- **Coordinates**: Returned and stored locally
- **Radius**: Applied after coordinates are obtained

## Benefits

✅ **Clear**: Each field has explicit purpose
✅ **Flexible**: Works with any location worldwide
✅ **Simple**: Three straightforward inputs
✅ **Reliable**: Geocoding works well with proper formatting
✅ **Private**: No data sent to Sat Sorter
✅ **Optional**: State field can be skipped for simpler locations

## Testing Notes

- [x] Country field required validation works
- [x] City field required validation works
- [x] State field optional (can be skipped)
- [x] Search builds correct query string
- [x] Radius selection works
- [x] Auto-detect button works
- [x] Error messages are helpful
- [x] Fields clear when location cleared
- [x] Works on mobile and desktop
- [x] Pressing Enter on City field triggers search

## Future Improvements

Possible enhancements:
- [ ] Autocomplete suggestions as user types
- [ ] Popular locations quick-select
- [ ] Recent locations for quick access
- [ ] Map preview of selected location
- [ ] Coordinate input for advanced users
