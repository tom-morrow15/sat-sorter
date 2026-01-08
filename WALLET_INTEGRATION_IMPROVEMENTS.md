# Wallet Integration & Merchant Matching Improvements

This document outlines the major improvements made to Sat Sorter's wallet integration and merchant categorization systems.

## 1. Multi-Payment Method Support

### Overview
Sat Sorter now supports multiple payment methods with automatic priority detection and fallback:

1. **NWC (Nostr Wallet Connect)** - Highest priority
2. **WebLN (Browser Extensions)** - Auto-detects Alby, Nos2x, Nostrich, etc.
3. **LNbits (Self-hosted Lightning)** - For self-hosters and custom setups
4. **Direct Node APIs** - LND, C-Lightning, Eclair for power users
5. **Manual Entry** - Fallback for all scenarios

### Key Files Modified

**`src/hooks/useWallet.ts`** - Enhanced wallet detection
- Added `hasWebLN` to detect browser extension wallets
- Added support for LNbits configuration (URL + admin key)
- Added support for Direct Node configuration (host, port, macaroon, TLS cert)
- Added `availableMethods` array showing all connected methods in priority order
- Exported helpers: `saveLNbitsConfig()`, `clearLNbitsConfig()`, `saveNodeConfig()`, `clearNodeConfig()`
- Configurations are stored in browser localStorage for persistence

### WebLN Integration
- **No setup required!** If the user has Alby or another WebLN-compatible extension installed, it's automatically detected
- WebLN provides seamless integration with browser extension wallets
- Perfect for casual users who already have Alby installed

### LNbits Integration
- Ideal for self-hosted Lightning setups
- Users can connect to their own LNbits instance or use a public instance
- Requires LNbits URL and admin key
- Connection is tested before saving
- Stored securely in browser localStorage

### Direct Node API Support
- **LND (Lightning Network Daemon)**
  - Requires: host, port, macaroon (base64 encoded)
  - Optional: TLS certificate
  - Located at: ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon

- **C-Lightning**
  - Requires: host, port
  - Full control over your Lightning node

- **Eclair**
  - Requires: host, port, TLS certificate (optional)
  - Java-based Lightning implementation

## 2. Wallet Methods Configuration Dialog

### New Component: `WalletMethodsDialog`
Located in `src/components/budget/WalletMethodsDialog.tsx`

Features:
- **Tab-based interface** for easy navigation
  - WebLN tab: Shows detection status and installation link to Alby
  - LNbits tab: Configuration with connection testing
  - Node tab: Multi-node-type support with macaroon/cert upload

- **Visual feedback**
  - Green checkmark when method is connected
  - Amber warning when method is available but not configured
  - Real-time connection testing

- **Priority explanation** 
  - Shows users which methods are currently active
  - Explains fallback priority order
  - Helps users understand which method will be used

### Integration
- Accessible via Settings icon (⚙️) in the Lightning Wallet modal header
- All settings are persisted in browser localStorage
- Non-destructive: Can test connections without saving

## 3. Scrollable Merchant Lists

### Problem Fixed
When multiple merchants matched a line item (e.g., 9 restaurants), users couldn't scroll through the full list.

### Solution
- Updated `MerchantIndicator` component to use proper scrollable containers
- Removed artificial height limits that prevented scrolling
- Added `max-h-[320px] overflow-y-auto` for main popover
- Added `max-h-[280px] overflow-y-auto` for badge version
- Now users can scroll through all matching merchants

### Files Modified
- `src/components/budget/MerchantIndicator.tsx`

## 4. Improved Merchant Categorization

### Problem Fixed
"Gas" line items were incorrectly matching restaurants with "gastro fusion" cuisine.

### Solution
Created strict category matching with priority rules:

**`src/lib/merchantUtils.ts`** - Enhanced merchant rules
- More specific fuel station patterns at the top of rules list
- Strict fuel station detection (avoids "gastro" cuisine matching)
- Better pattern ordering (most specific → most general)
- Improved merchant recognition with brand names

**Pattern Examples:**
```typescript
// ✅ Strict fuel matching - won't match restaurants
{ pattern: /^gas station|chevron|shell|exxon|bp|mobil(?!\s)|speedway|wawa/i, bucket: 'Transportation', lineItem: 'Gas' },

// ✅ Won't be caught by generic "food" patterns
{ pattern: /restaurant|burger|pizza|taco|sushi|diner/i, bucket: 'Food', lineItem: 'Restaurants' },
```

**`src/hooks/useBTCMap.ts`** - Enhanced BTCMap matching
- Added `isSpecificLineItem` detection for items like "Gas", "Rent", "Insurance"
- Strict category matching for specific line items
- Only matches fuel category for "Gas" line items (ignores "gastro")
- Prevents false positives from cuisine tags

## 5. "Other" Category Improvements

### New Utility Module: `merchantCategoryUtils.ts`
Located in `src/lib/merchantCategoryUtils.ts`

Provides tools for organizing merchants:
- `getMerchantCategoryGroup()` - Maps OSM categories to friendly group names
- `isOtherCategory()` - Identifies unrecognized merchants
- `segregateMerchantsByCategory()` - Separates main categories from "Other"
- `getSortedCategories()` - Orders categories by frequency and importance

### Visual Improvements
**Updated MerchantIndicator to highlight "Other" merchants:**
- Shows category group name instead of raw OSM category
- Adds amber alert icon (⚠️) for "Other Businesses"
- Highlights row with amber background on hover
- Makes it clear which merchants aren't properly categorized

**Example:**
```
Restaurant (matches well) 🌟
Bitcoin Pizza Shop      ⚡ 3.2 mi

Other Businesses (needs attention) ⚠️
Mystery Store           3.8 mi
```

### Category Grouping
Merchants are now organized into friendly groups:
- Restaurants, Cafes & Coffee, Fast Food
- Grocery & Shopping, Clothing & Fashion
- Gas Stations, Auto Services, Parking
- Pharmacies, Gyms & Fitness
- Hotels & Lodging, Banking
- And more...

## Testing & Validation

### Test Scenarios
1. **WebLN Detection**
   - Install Alby extension
   - Payment methods dialog should show "WebLN wallet detected"

2. **LNbits Configuration**
   - Enter LNbits URL and admin key
   - Click "Test & Connect"
   - Should show success/error message

3. **Fuel Station Matching**
   - Create "Gas" line item in Transportation bucket
   - Should only match actual gas stations (Chevron, Shell, etc.)
   - Should NOT match restaurants with "gastro" cuisine

4. **Merchant List Scrolling**
   - Add location with 9+ restaurants
   - Click merchant indicator on Restaurants line item
   - Should show all merchants with vertical scrolling

5. **Other Category Visualization**
   - Unrecognized merchants should show amber alert icon
   - Distinguishable from well-categorized merchants

## Configuration Storage

### LocalStorage Keys
```javascript
// LNbits configuration
localStorage.getItem('sat-sorter-lnbits')
// Format: { url: "https://...", adminKey: "sk_..." }

// Direct Node configuration
localStorage.getItem('sat-sorter-node')
// Format: { type: "lnd", host: "localhost", port: 10009, ... }

// Bitcoin price (existing)
localStorage.getItem('bitcoin-price-data')

// Location settings (existing)
localStorage.getItem('sat-sorter-location')
```

## User Workflow

### First Time Setup
1. User taps Lightning Wallet button
2. If they have Alby installed, WebLN is automatically available
3. If they want to use LNbits or their own node:
   - Click Settings icon (⚙️)
   - Switch to desired tab
   - Enter configuration details
   - Click "Test & Connect"

### Using Multiple Wallets
- App automatically tries methods in priority order
- If NWC fails, it falls back to WebLN
- If WebLN fails, it tries LNbits
- And so on...
- No user intervention needed

### Switching Methods
- User can configure multiple methods
- All are persisted in localStorage
- App uses the first available method
- User can disconnect individual methods anytime

## Future Improvements

Potential enhancements for future versions:

1. **Hardware Wallet Support**
   - Add support for hardware-based signing
   - BTCPay integration

2. **Multi-Account Support**
   - Store multiple NWC connections
   - Switch between wallets per transaction

3. **LNbits Webhooks**
   - Real-time transaction updates
   - Automatic balance sync

4. **Custom Category Rules**
   - Let users define custom merchant categories
   - Save category preferences

5. **Merchant Feedback**
   - Users can report miscategorized merchants
   - Help improve BTCMap data

## Summary

These improvements make Sat Sorter's wallet integration more flexible and robust while fixing critical merchant categorization issues. Users now have maximum compatibility with popular wallet solutions, and merchants are accurately matched to budget line items.
