# Income Transaction Categorization Fix

## Problem

Income transactions (zaps from Nostr, incoming payments from Lightning wallets) could not be categorized because the transaction details dialog only showed **expense categories**. This caused:

1. Income transactions to remain permanently uncategorized
2. Income transactions to keep reappearing in the "needs categorizing" list
3. User confusion about why they couldn't assign incoming payments to the Income bucket

## Root Cause

The `TransactionDetailsDialog` component had this line:

```typescript
const expenseBuckets = buckets.filter(b => !b.isIncome);
```

This hard-coded filter meant the dropdown always showed only expense categories, regardless of whether the transaction was incoming (income) or outgoing (expense).

## Solution

Changed the bucket filtering logic to be **dynamic based on transaction type**:

```typescript
// Get buckets based on transaction type (income or expense)
const relevantBuckets = buckets.filter(b => b.isIncome === transaction.isIncome);
```

Now:
- **Income transactions** → Show only the Income bucket and its line items (Salary, Gifts, etc.)
- **Expense transactions** → Show only expense buckets (Housing, Food, Transportation, etc.)

### Additional Improvements

Added a transaction type label in the category selection UI:

```
Category                                                    Income
[Select a category...]
├─ Income
├─ Salary
├─ Gifts
```

This makes it immediately clear to the user what type of transaction they're categorizing.

## Changes Made

### `src/components/budget/TransactionDetailsDialog.tsx`

1. **Line ~128**: Changed `expenseBuckets` to `relevantBuckets`
   - Now filters based on `transaction.isIncome` instead of hard-coding to expenses

2. **Line ~131**: Updated bucket reference in dropdown
   - Changed from `expenseBuckets.map()` to `relevantBuckets.map()`

3. **Line ~133**: Updated edit capability check
   - Changed from `expenseBuckets.length > 0` to `relevantBuckets.length > 0`

4. **Line ~280**: Added transaction type label
   - Shows "Income" or "Expense" next to the category label for clarity

## Testing

To verify the fix works:

1. **Create or import an income transaction**
   - Use NWC to receive a payment
   - Use Nostr zaps
   - Manually add an income transaction

2. **Open the transaction details**
   - Click on the income transaction

3. **Click "Change" to edit the category**
   - You should now see the **Income bucket** in the dropdown
   - The label should say "Category" with "Income" shown on the right
   - You can now select which income line item it belongs to

4. **Expense transactions work as before**
   - Expense transactions still show only expense categories
   - Behavior is unchanged

## Impact

- ✅ Income transactions can now be properly categorized
- ✅ Zaps and incoming payments no longer get stuck in "needs categorizing"
- ✅ Better UX with clear labeling of transaction type
- ✅ Backward compatible - no data structure changes
- ✅ Works with all transaction sources (NWC, zaps, manual entry, CSV)

## Example Workflow

### Before Fix
1. Receive a zap for 21 sats
2. Open transaction details
3. Click "Change" to categorize
4. See only expense categories (Housing, Food, etc.)
5. **Can't categorize it** → Transaction stuck in "needs categorizing"

### After Fix
1. Receive a zap for 21 sats
2. Open transaction details
3. Click "Change" to categorize
4. See the **Income bucket** with line items like "Salary", "Gifts"
5. **Can categorize it** → Transaction moves to categorized list

## Why This Matters

In zero-based budgeting, **every satoshi must be assigned**:
- Expenses get assigned to expense buckets
- Income gets assigned to income line items (to track income sources)

Without this fix, income transactions couldn't be assigned, breaking the zero-based budgeting model and keeping transactions perpetually in the uncategorized list.
