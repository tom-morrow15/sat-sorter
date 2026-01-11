# USD Amount Preservation Fix - Summary

## What Was Fixed

**Problem:** When users entered budget amounts in USD (like "$2,000 for rent"), those amounts would change when Bitcoin's price fluctuated. A $2,000 entry could become $3,500 or $1,200 depending on BTC price changes.

**Solution:** The application now stores both USD and SAT values separately, with the user-inputted USD amount as the permanent "source of truth."

## How It Works

### User Input Flow

**When entering USD amount:**
```
User: "$2,000 for mortgage"
     ↓
Store: usdAmount = $2,000 (exact input)
Store: plannedAmount = 5,000,000 sats (calculated from current price)
Store: usdPerBtcAtEntry = $40,000 (current BTC price for reference)
```

**When Bitcoin price changes:**
```
Old: BTC = $40,000 → 5M sats = $2,000 ✓
New: BTC = $30,000 → 5M sats = ???
     ↓ (OLD BEHAVIOR)
     Would show $3,333 ✗
     ↓ (NEW BEHAVIOR)
     Shows stored $2,000 ✓
```

### Display Logic

The application now uses smart calculation functions that:
1. Check if a stored USD amount exists
2. If yes → display that exact amount
3. If no → calculate USD from SATs using current price

**Example:**
```typescript
// Stored values
lineItem.usdAmount = 2000      // User's original input
lineItem.plannedAmount = 5000000  // SATs

// Display logic
if (lineItem.usdAmount !== undefined) {
  display = "$2,000"  // ← Use exact stored value
} else {
  display = calculateUsd(5000000)  // ← Calculate if needed
}
```

## Files Changed

### 1. **src/lib/budgetTypes.ts**
   - Added `calculateBucketTotalForDisplay()` - calculates totals respecting stored USD amounts
   - Added `calculateSpentForLineItemUsd()` - calculates spending respecting stored USD amounts
   - Updated documentation

### 2. **src/components/budget/LineItemRow.tsx**
   - Updated `parseInputAmount()` to store exact USD values when entered in USD mode
   - Updated `formatAmount()` to use stored USD amounts when displaying
   - Updated `getEditableAmount()` to return stored USD value

### 3. **src/components/budget/BucketCard.tsx**
   - Updated `formatAmount()` to accept lineItem parameter for stored USD lookup
   - Added `displayTotals` calculation using new helper function
   - Updated total display to show stored USD amounts without recalculation
   - Import new helper function `calculateBucketTotalForDisplay`

### 4. **src/components/budget/BudgetHeader.tsx**
   - Already uses `calculateTotalIncomeUsd()` and `calculateTotalExpensesUsd()`
   - These functions already respect stored USD amounts ✓

## Key Design Principles

1. **Source of Truth:**
   - USD input = Source of truth (never changes)
   - SAT equivalent = Derived (updates with price)
   - Vice versa if user enters SATs

2. **Currency Toggle:**
   - Switching between USD/SAT modes shows different displays
   - Neither stored value changes
   - User can toggle freely

3. **Backwards Compatibility:**
   - Entries without `usdAmount` field still work
   - They calculate USD from SATs (old behavior)
   - When user edits them in USD mode, the USD amount becomes stored
   - Automatic migration happens entry-by-entry

4. **No Data Loss:**
   - Existing budgets continue to work
   - No migration script needed
   - Values update progressively as users edit

## Testing the Fix

### Test Case 1: USD Amount Preservation
```
1. Set BTC price to $40,000
2. Enter "$2,000" for Rent
3. Change BTC price to $30,000
4. Result: Display still shows $2,000 ✓
```

### Test Case 2: SAT Amount Preservation
```
1. Set BTC price to $40,000
2. Enter "5,000,000" sats for Rent
3. Change BTC price to $30,000
4. Result: Display still shows 5,000,000 sats ✓
```

### Test Case 3: Currency Toggle
```
1. Enter "$2,000" for Rent
2. Switch to SAT mode
3. Display shows: 5,000,000 sats
4. Switch back to USD mode
5. Result: Still shows $2,000 ✓
```

### Test Case 4: Editing Amount
```
1. Have "$2,000" for Rent (stored)
2. Edit to "$2,500"
3. Result: Stored as $2,500, SATs recalculated ✓
```

## Impact on Users

✓ Budgets stay in the original currency they entered  
✓ No more "budget drifting" with price changes  
✓ Can still see SAT equivalents and their changes  
✓ Works with currency toggle without confusion  
✓ Existing budgets continue to work  
✓ Progressive enhancement - works better as users edit

## Technical Debt

- None introduced
- Backwards compatible
- No breaking changes
- Helper functions keep code DRY

## Future Improvements

1. Visual indicator showing "locked" USD amount
2. Display the BTC price at entry time
3. Option to "re-lock" at current price
4. Historical tracking for tax reporting
5. Configurable auto-conversion behavior
