# USD Amount Preservation Feature

## Overview

This document describes how the Sat Sorter application preserves user-inputted USD amounts, preventing them from changing when Bitcoin prices fluctuate.

## Problem Statement

Previously, when a user entered a budget amount in USD (e.g., "My mortgage is $2,000"), the application would store only the SAT equivalent. When Bitcoin's price changed, the USD display would automatically recalculate based on the new price, causing the displayed amount to drift from what the user originally entered.

**Example of the old behavior:**
- User inputs: $2,000 mortgage
- BTC price: $40,000 → Stored as 5,000,000 sats
- BTC price drops to $30,000 → Display shows $3,333 (5M sats × $30K price)
- User sees: Original $2,000 amount became $3,333 ❌

## Solution: Dual Amount Storage

The application now stores **both USD and SAT values separately** and treats the user-inputted USD amount as the "source of truth."

### Data Structure

Each budget line item now stores:

```typescript
interface LineItem {
  id: string;
  name: string;
  plannedAmount: number;              // SATs (always stored)
  usdAmount?: number;                 // User's original USD input (source of truth)
  usdPerBtcAtEntry?: number;          // BTC price when amount was entered (for reference)
}
```

### Storage Logic

When a user **enters a USD amount**:
1. Store the exact USD amount they entered
2. Calculate the SAT equivalent using the **current BTC price**
3. Store the BTC price at the time of entry (for reference)
4. When BTC price changes: **keep USD fixed, SAT display updates only**

When a user **enters a SAT amount**:
1. Store the SAT amount
2. Clear the `usdAmount` field (SATs become source of truth)
3. When BTC price changes: **keep SATs fixed, USD display updates**

## Implementation Details

### 1. LineItemRow Component (`src/components/budget/LineItemRow.tsx`)

The component now:
- Displays the stored USD amount when in USD mode (not a recalculation)
- When editing in USD mode, saves the exact USD value with exchange rate
- When editing in SAT mode, clears the USD amount so SATs become the source

```typescript
const parseInputAmount = (value: string): { sats: number; usdAmount?: number; usdPerBtcAtEntry?: number } => {
  const num = parseFloat(value) || 0;
  if (currency === 'usd' && priceData) {
    // Store the exact USD amount, exchange rate, and convert to sats
    return {
      sats: Math.round(usdToSats(num, priceData.usdPerBtc)),
      usdAmount: num,                    // ← Exact user input preserved
      usdPerBtcAtEntry: priceData.usdPerBtc,
    };
  }
  // When entering sats, clear the USD amount so sats becomes the source of truth
  return {
    sats: Math.round(num),
    usdAmount: undefined,                // ← Clear to make SATs source of truth
    usdPerBtcAtEntry: undefined,
  };
};
```

### 2. Helper Functions (`src/lib/budgetTypes.ts`)

New calculation functions that respect stored USD amounts:

#### For Planned Amounts
```typescript
export function calculateBucketTotalUsd(bucket: Bucket, usdPerBtc: number): number {
  return bucket.lineItems.reduce((sum, item) => {
    // Use stored USD amount if available, otherwise convert from sats
    if (item.usdAmount !== undefined) {
      return sum + item.usdAmount;  // ← Returns exact user input
    }
    return sum + (item.plannedAmount / 100_000_000) * usdPerBtc;  // ← Calculated if needed
  }, 0);
}
```

#### For Spent Amounts
```typescript
export function calculateSpentForLineItemUsd(lineItemId: string, transactions: Transaction[], usdPerBtc: number): number {
  return transactions
    .filter(t => t.lineItemId === lineItemId && !t.isIncome)
    .reduce((sum, t) => {
      if (t.usdAmount !== undefined) {
        return sum + t.usdAmount;  // ← Use stored amount if available
      }
      return sum + (t.amount / 100_000_000) * usdPerBtc;
    }, 0);
}
```

### 3. Display Logic (`src/components/budget/BucketCard.tsx`)

The component now:
- Uses `calculateBucketTotalForDisplay()` to get totals that respect stored USD amounts
- Displays the exact USD amount when available
- Falls back to calculation only when no USD amount is stored

```typescript
const displayTotals = priceData 
  ? calculateBucketTotalForDisplay(bucket, priceData.usdPerBtc, currency) 
  : { sats: total, usd: 0 };

// In display:
<p>{formatUsd(displayTotals.usd)}</p>  // ← Uses stored value if available
```

## User Experience

### Scenario: Bitcoin Price Change

**Initial State:**
- User inputs: $2,000 mortgage
- BTC price: $40,000
- Stored: 5,000,000 sats + $2,000 USD

**Bitcoin price drops to $30,000:**
- Display in USD mode: Still shows **$2,000** ✅
- Display in SAT mode: Still shows **5,000,000 sats** ✅
- Both values preserved exactly as entered

**User edits the amount to $2,500:**
- New stored: 8,333,333 sats + $2,500 USD
- Both stored values update together

## Currency Toggle Behavior

When users toggle between USD and SAT modes:

- **USD mode → SAT mode:** Display switches to SATs. If USD amount was stored, SATs stay fixed
- **SAT mode → USD mode:** Display switches to USD. Uses stored USD if available, otherwise calculates
- **Neither value changes** when toggling - only the display changes

## Migration and Backwards Compatibility

Existing budget entries without stored USD amounts:
- Still work correctly
- USD calculation uses current BTC price (pre-existing behavior)
- When user edits these entries in USD mode, the new USD amount becomes stored
- Automatic migration happens entry-by-entry as users edit

## Testing Recommendations

1. **Enter USD amount, change BTC price:**
   - Verify USD amount stays the same
   - Verify SAT amount stays the same

2. **Enter SAT amount, change BTC price:**
   - Verify SAT amount stays the same
   - Verify USD display updates with new price

3. **Edit amount in different currencies:**
   - USD → Edit → Verify USD stored
   - SAT → Edit → Verify SATs used as source of truth
   - Toggle currency modes → Verify correct values display

4. **Budget totals and spending:**
   - Verify bucket totals use stored USD amounts when available
   - Verify spent amounts respect stored USD amounts
   - Verify remaining budget calculates correctly

## Code Quality

- No breaking changes to existing data structures
- Backwards compatible (missing `usdAmount` fields default to calculation)
- Follows TypeScript types and null-safety patterns
- All calculations use helper functions for consistency
- Well-documented with comments explaining the source-of-truth logic

## Future Enhancements

Potential improvements:
1. Add visual indicator showing when USD amount was locked in
2. Show the BTC price at entry time alongside the stored USD amount
3. Allow users to "reset" to current price conversion
4. Export budget with historical entry prices for tax/reporting
5. Add settings for "auto-convert on price change" vs "keep user input"
