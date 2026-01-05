# BTCMap Integration Improvements

## Problem Statement

The BTCMap integration was not showing Bitcoin-accepting merchants for some line items, even when those merchants existed nearby. For example, "Steak n Shake" and other casual dining establishments weren't appearing in merchant indicators.

## Root Causes Identified

### 1. **Overly Strict Matching Algorithm**
The original `lineItemMatchesMerchant()` function used rigid word matching that required exact matches or very high string similarity. It failed to match:
- Brand names with multiple words (e.g., "Steak n Shake")
- Merchants listed under generic categories that don't match the line item name

### 2. **Incomplete Category Mappings**
The category mappings were missing many common merchant categories and chain restaurant names, resulting in:
- Limited keyword suggestions for matching
- No specific entries for popular chains (Burger King, Subway, Wendy's, etc.)
- Missing cuisine types (Japanese, Thai, Vietnamese, etc.)

### 3. **Weak Keyword Extraction**
The `getMerchantKeywords()` function wasn't extracting keywords from merchant names themselves, only from category mappings. This meant:
- Brand names weren't being considered in matching logic
- Unique merchant identifiers were ignored
- Name-based matches weren't possible

## Improvements Made

### 1. **Enhanced Matching Algorithm** (`lineItemMatchesMerchant`)

#### New Matching Hierarchy:
1. **Exact Name Match** (Highest Priority)
   - Direct merchant name match
   - Line item contains merchant name (e.g., "Dinner at Steak n Shake")

2. **Word-by-Word Matching**
   - Extract words from line item name (filtering common words)
   - Match words against merchant name and keywords
   - Require 67%+ word match ratio or 2+ matching words
   - Example: "Steak n Shake" matches "Shake" or "Steak" in line item

3. **Category/Amenity Matching** (Fallback)
   - Check if line item words match category or amenity fields
   - Less strict to catch broader category matches

#### Key Algorithm Changes:
```javascript
// Before: Required keyword inclusion matches
// After: Supports multiple match types with clear priority

// Exact name matching
if (merchantName.includes(lowerName)) return true;
if (lowerName.includes(merchantName)) return true;

// Word-by-word with ratio scoring
const matchRatio = matchCount / totalWords;
if (matchRatio >= 0.67) return true;

// Category fallback matching
if (keyword.length >= 3) return true; // Lowered from 4 chars
```

### 2. **Expanded Category Mappings**

Added 30+ new category entries including:
- **Cuisine Types**: Chinese, Thai, Vietnamese, Korean, Indian, Mexican, Middle Eastern, Japanese, Sushi, BBQ
- **Casual Dining**: Diners, steakhouse, casual dining keywords
- **Major Chains**: Burger King, McDonald's, Wendy's, Chick-fil-A, Popeyes, KFC, Taco Bell, Subway, Jimmy John's, Panera Bread, Chipotle, Qdoba
- **Expanded Fast Food**: Added "shake", "burgers", "tacos", "chicken", "sandwich" keywords

This ensures merchants are properly categorized regardless of how they're tagged in BTCMap.

### 3. **Improved Keyword Extraction** (`getMerchantKeywords`)

Now extracts keywords from multiple sources:
1. Category-based keywords (existing)
2. Amenity-based keywords (existing)
3. Cuisine tags (improved)
4. **Merchant name words** (NEW)
   - Splits merchant name into individual words
   - Filters out common stop words
   - Adds brand names to keyword list

Example: "Steak n Shake" now generates keywords: ["steak", "shake", "fast food", "food", "burger", "takeout", ...]

### 4. **Better Debugging & Monitoring**

Added console logging to help identify:
- Total merchants fetched from BTCMap
- Successfully matched merchants for each line item
- Match details for troubleshooting

```javascript
console.log(`[BTCMap] Fetched ${activeMerchants.length} active merchants...`);
console.log(`[BTCMap] Matched "${lineItemName}" to ${matches.length} merchant(s)...`);
```

## Testing the Improvements

To verify the improvements work:

1. **Set Your Location**: Click "Set Your Location" on the BTCMap banner
2. **Create a Line Item**: Add items like:
   - "Steak n Shake" → Should show matching fast food/casual dining merchants
   - "Coffee" → Should show cafes
   - "Groceries" → Should show supermarkets
   - "Gas" → Should show fuel stations

3. **Check Console**: Open developer console (F12) to see matching logs

## Expected Behavior

With these improvements:
- ✅ Merchant indicators appear next to line items more frequently
- ✅ Brand name matches work (e.g., "Steak n Shake" finds Steak n Shake)
- ✅ Generic category matches still work (e.g., "Dinner" finds restaurants)
- ✅ Word-based matching is more flexible
- ✅ Merchant results are properly sorted by distance

## Technical Details

### Files Modified
- `/src/hooks/useBTCMap.ts`
  - `lineItemMatchesMerchant()` - Enhanced matching algorithm
  - `getMerchantKeywords()` - Added merchant name word extraction
  - `CATEGORY_MAPPINGS` - Expanded to 60+ category entries
  - `fetchAllMerchants()` - Added debug logging

### Backward Compatibility
✅ All changes are backward compatible. Existing line items continue to match merchants while also supporting more cases.

### Performance Impact
✅ Minimal - Uses same number of array operations, just more sophisticated matching logic

## Future Enhancements

Potential improvements for future versions:
1. **Fuzzy Matching**: Implement Levenshtein distance for typo tolerance
2. **Machine Learning**: Learn from user interactions to improve matching
3. **Custom Merchant Tags**: Let users tag merchants for better categorization
4. **Search Suggestions**: Auto-suggest merchants based on available matches
5. **Merchant Verification**: Highlight verified vs. community-submitted merchants
6. **Real-time Updates**: Subscribe to BTCMap updates instead of periodic polling

## References

- BTCMap API: https://api.btcmap.org/v2/elements
- OSM Tags: https://wiki.openstreetmap.org/wiki/Key:amenity
