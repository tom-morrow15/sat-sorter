# BTCMap Testing Guide

## Quick Start

### 1. Set Your Location
- Open the Sat Sorter app
- Click **"Set Your Location"** on the BTCMap banner (or **"Change"** if already set)
- Choose one of these options:
  - **Search**: Enter "Jacksonville FL" or your city/zip code
  - **Popular Cities**: Select a major city from the list
  - **Coordinates**: Enter latitude/longitude manually

### 2. Create Test Line Items
Add line items with these names to test the improved matching:

#### Exact Name Matching
- `Steak n Shake` → Should find Steak n Shake locations
- `McDonald's` → Should find McDonald's
- `Subway` → Should find Subway

#### Generic Category Matching
- `Coffee` → Should find cafes and coffee shops
- `Lunch` → Should find restaurants and fast food
- `Groceries` → Should find supermarkets and convenience stores
- `Gas` → Should find fuel stations
- `Pharmacy` → Should find pharmacies

#### Multi-Word Matching
- `Fast Food` → Should find burger places, Taco Bell, etc.
- `Italian Food` → Should find Italian restaurants
- `Mexican Food` → Should find tacos, burritos, Mexican restaurants

#### Cuisine Matching
- `Sushi` → Should find Japanese restaurants
- `Thai Food` → Should find Thai restaurants
- `Burger King` → Should find Burger King locations

## Understanding the Results

### Merchant Indicator Badge
When a line item has matching merchants nearby, you'll see:
- 🗺️ **Map Pin Icon** - Indicates Bitcoin merchants found
- **Number** - How many merchants matched
- **⚡ Zap Icon** - Indicates Lightning payment support

Click the badge to see details about each matching merchant:
- Merchant name and category
- Distance from your location
- Payment methods (Lightning ⚡ or On-chain ₿)
- Link to open in Google Maps

## Troubleshooting

### No Merchants Appearing?

1. **Check Location is Set**
   - Look for location name and radius in the BTCMap banner
   - If showing "Set Your Location", click it and follow setup

2. **Check Search Radius**
   - Try increasing the search radius (25 miles → 50 miles)
   - Especially in rural areas, merchants may be farther away

3. **Try Different Line Items**
   - "Coffee" and "Restaurants" are usually common
   - Local chains may not have "fast_food" category tag

4. **Check Browser Console**
   - Open F12 (Developer Tools)
   - Go to Console tab
   - Look for logs starting with `[BTCMap]`
   - These show if matching is working

### Example Console Output

```
[BTCMap] Fetched 4521 active merchants out of 4523 total
[BTCMap] Matched "Coffee" to 3 merchant(s): 
  (3) ["Joe's Coffee", "Local Cafe", "Downtown Brew"]
```

## Developer Console Debugging

The improved BTCMap system includes debug logging. To use it:

1. **Open Developer Tools**: Press `F12` or right-click → "Inspect"
2. **Go to Console Tab**: Click "Console" tab
3. **Look for BTCMap Logs**: Entries starting with `[BTCMap]`
4. **Examples of log output**:
   - `[BTCMap] Fetched 4521 active merchants out of 4523 total`
   - `[BTCMap] Matched "Dinner" to 5 merchant(s): ["Restaurant A", "Restaurant B", ...]`

This helps identify:
- ✅ How many merchants are in the database
- ✅ Whether your line item is matching merchants
- ✅ How many matches were found

## Known Limitations

### Merchants Not in BTCMap
- Some Bitcoin-accepting businesses may not be listed in BTCMap
- BTCMap depends on community contributions
- To add a merchant: Visit https://btcmap.org/add-location

### Matching Edge Cases
- Very short names (e.g., "B" or "IT") won't match well
- Acronyms may not work (e.g., "BBQ" might not match unless tagged as "bbq")
- Regional restaurant names may not have category tags

### Category Tags
- Merchants are tagged based on OpenStreetMap (OSM) data
- Tags may be incomplete or incorrect in some cases
- You can help improve by editing OSM and BTCMap

## Test Cases Checklist

Use this checklist to verify the improvements are working:

```
□ Exact merchant name matches
  □ "Steak n Shake" finds locations
  □ "McDonald's" finds locations
  □ "Subway" finds locations

□ Generic category matches
  □ "Coffee" finds cafes
  □ "Restaurants" finds restaurants
  □ "Groceries" finds supermarkets

□ Multi-word matching
  □ "Fast Food" finds burger places
  □ "Italian Food" finds Italian restaurants
  □ "Thai Food" finds Thai restaurants

□ Cuisine-specific matching
  □ "Sushi" finds Japanese restaurants
  □ "Burgers" finds burger chains
  □ "Pizza" finds pizza places

□ Distance calculation
  □ Closest merchants appear first
  □ Distance in miles shows correctly
  □ Merchants outside radius don't appear

□ Payment methods
  □ Lightning badge shows for merchants accepting ⚡
  □ On-chain badge shows for merchants accepting ₿
  □ Some merchants may have both
```

## Performance Notes

- First load fetches ~4,500 merchants (normal - takes a few seconds)
- Subsequent loads use cached data (instant)
- Cache refreshes every 30 minutes
- Matching happens instantly on line item changes

## Questions or Issues?

If the matching still doesn't work as expected:

1. Check the browser console for error messages
2. Try a different line item name
3. Make sure location is properly set
4. Try increasing search radius
5. Check that merchants exist in your area at https://btcmap.org

---

*Last Updated: January 2026*
*BTCMap Integration Version: 2.0 (Enhanced Matching)*
