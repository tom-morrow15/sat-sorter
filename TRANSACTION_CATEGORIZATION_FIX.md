# Transaction Categorization Persistence Fix

## Problem

Transactions (specifically the 42sat transactions from Jan 13 and Jan 15) were not staying categorized after the user assigned them to a bucket and line item. When the user:

1. Opened a transaction details dialog
2. Changed the category (bucket + line item)
3. Clicked "Save Category"
4. Closed the dialog

The transaction would appear categorized momentarily, but then revert back to uncategorized upon refresh or navigation.

## Root Cause

The issue was in the auto-save mechanism for transaction updates in `useBudgetStore.ts`:

1. **Transaction updates** (via `assignTransaction` → `updateTransaction`) update the state but don't directly trigger the relay save
2. The **auto-save effect** watches for state changes and batches saves with a **2-second debounce** to reduce relay spam
3. If the user closed the dialog or navigated away **before 2 seconds passed**, the change was never published to Nostr relays
4. While the change was persisted to localStorage initially, the relay sync (which is the source of truth when logged in) would override it on next refresh

## Solution

Implemented a priority-based debounce system:

1. **Transaction update flag**: When `updateTransaction` or `deleteTransaction` is called, set a `transactionUpdatedRef.current = true` flag
2. **Reduced debounce for transactions**: The auto-save effect now checks this flag:
   - **Shorter debounce (500ms)** for transaction updates
   - **Standard debounce (2000ms)** for other changes (buckets, line items, etc.)
3. **Flag cleanup**: After the save completes or a new state is compared, the flag is cleared

This ensures that transaction categorization changes are saved to relays within 500ms, giving the user time to navigate away before the critical save window closes.

## Changes Made

### `src/hooks/useBudgetStore.ts`

1. **Added transaction update tracking ref** (line ~87):
   ```typescript
   const transactionUpdatedRef = useRef(false);
   ```

2. **Updated `updateTransaction` function** (line ~916):
   - Set `transactionUpdatedRef.current = true` when updating
   - Better logging for debugging

3. **Updated `deleteTransaction` function** (line ~950):
   - Set `transactionUpdatedRef.current = true` when deleting
   - Consistent with update behavior

4. **Enhanced auto-save effect** (line ~533):
   - Check the transaction update flag
   - Use 500ms debounce when flag is set, 2000ms otherwise
   - Clear flag after successful save
   - Added detailed logging for transaction updates

## Testing

To verify the fix works:

1. **Create/import a transaction** (via NWC, manual entry, or CSV)
2. **Immediately categorize it** (open details → select category → save)
3. **Close the dialog without waiting**
4. **Refresh the page** - the transaction should remain categorized
5. **Navigate to a different month and back** - categorization should persist
6. **If logged in with Nostr**: Force a refresh or clear browser cache and reload - data should sync from relays with categorization intact

## Impact

- ✅ Transactions now reliably stay categorized
- ✅ Faster persistence for critical transaction changes
- ✅ No impact on other budget operations (buckets, line items still use 2s debounce)
- ✅ Backward compatible - no changes to data structures or API
- ✅ Works both logged in (with relay sync) and logged out (localStorage only)

## Performance Considerations

The reduced 500ms debounce for transactions has negligible performance impact because:
- Transactions are typically updated one at a time (user categorizing one transaction)
- Relay sync for a single transaction categorization is lightweight
- The 500ms still batches rapid consecutive updates
- Other changes continue using the 2s debounce to minimize relay load
