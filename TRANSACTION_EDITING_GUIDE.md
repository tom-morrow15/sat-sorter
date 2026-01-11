# How to Edit Transactions - Quick Guide

## For Users

### Editing a Transaction (Quick Steps)

1. **Find your transaction** in the "Categorized" section of the Transactions panel
2. **Click on the transaction** - an edit dialog will pop up
3. **Make your changes:**
   - Edit the description (e.g., "Alby Hub" → "Salary Deposit")
   - Change the amount (currency depends on your current setting)
   - Pick a different category/subcategory
   - Or remove the category by selecting "Unassigned"
4. **Click "Save Changes"** - your transaction is updated!

### Common Tasks

#### "I categorized it wrong, I need to move it"
→ Click the transaction, pick a new category, save

#### "I entered the wrong amount"
→ Click the transaction, change the amount, save

#### "I want to remove the category assignment"
→ Click the transaction, select "Unassigned" for category, save

#### "I want to change what the transaction is called"
→ Click the transaction, edit the description, save

## Technical Details for Developers

### What Happens When You Edit

1. Transaction data is loaded into the edit form
2. User makes changes
3. Amount is parsed (converts USD ↔ SATs if needed)
4. `updateTransaction()` is called with the new data
5. Transaction updates in local storage
6. UI reflects changes immediately

### Supported Fields

- ✅ **description**: Text field, no length limit
- ✅ **amount**: Number field, positive only
- ✅ **usdAmount**: Calculated from amount in USD mode
- ✅ **usdPerBtcAtEntry**: Captured at edit time
- ✅ **bucketId**: Category assignment
- ✅ **lineItemId**: Subcategory assignment
- ❌ **date**: Not editable (created on transaction entry)
- ❌ **isIncome**: Not editable (determines transaction type)
- ❌ **id**: Not editable (transaction identifier)

### Currency Handling

**Important**: The USD amount is treated as the "source of truth"

- **Editing in USD mode**: USD amount is exact, SATs recalculate
- **Editing in SAT mode**: SAT amount is exact, USD recalculates
- **BTC price captured**: Stored for reference at edit time
- **No drift**: Previously entered USD amounts stay fixed when price changes

### Validation

- Amount must be greater than 0
- Description is optional (defaults to current value)
- Category is optional (can set to "Unassigned")
- Subcategory is optional

## For Support

### Common Issues

**Q: Why can't I edit unassigned transactions?**
A: Currently, you must categorize unassigned transactions first, then edit. We'll add direct editing of unassigned transactions in a future update.

**Q: Can I change the transaction date?**
A: Not yet. Transaction dates are set when they're created. We'll add date editing in a future release.

**Q: What if I make a mistake while editing?**
A: Click "Cancel" to close the dialog without saving. Your transaction stays unchanged.

**Q: Does editing affect syncing?**
A: Yes, edited transactions will be synced to Nostr when you sync your budget.

## Example Scenarios

### Scenario 1: Alby Hub Auto-Import
```
What happened: Alby Hub automatically logged a Zap payment
Current state: $50 categorized as "Unknown"
Goal: Recategorize as "Income" > "Zaps Received"

Steps:
1. Click the $50 transaction in "Categorized"
2. Change Category from blank to "Income"
3. Change Subcategory to "Zaps Received"
4. Click "Save Changes"
✓ Done! Now tracked properly as income
```

### Scenario 2: Data Entry Error
```
What happened: User accidentally entered $500 as $50
Current state: $50 in "Food" > "Groceries"
Goal: Fix the amount to $500

Steps:
1. Click the $50 transaction
2. Change Amount from "$50.00" to "$500.00"
3. Click "Save Changes"
✓ Done! Amount is now correct
```

### Scenario 3: Wrong Category
```
What happened: User logged gas expense under Transportation > Gas
But realized it should be under Transportation > Car Payment
Goal: Move to correct subcategory

Steps:
1. Click the transaction
2. Category is already "Transportation" ✓
3. Change Subcategory from "Gas" to "Car Payment"
4. Click "Save Changes"
✓ Done! Moved to correct bucket
```

### Scenario 4: Uncategorizing
```
What happened: Transaction was categorized but needs to be unassigned
Goal: Remove category assignment

Steps:
1. Click the transaction
2. Select "Unassigned" for Category
3. Line item automatically clears
4. Click "Save Changes"
✓ Done! Transaction is now unassigned
```

## Future Planned Features

- [ ] Edit unassigned transactions directly (without categorizing first)
- [ ] Edit transaction dates
- [ ] Bulk edit multiple transactions
- [ ] Undo/redo for edits
- [ ] Transaction edit history
- [ ] AI-suggested category changes based on description
- [ ] Custom tags for transactions
- [ ] Notes/comments on transactions
- [ ] Transaction merging (combine similar transactions)
- [ ] Import history tracking

---

Need help? Create a transaction, then click to edit it to see how it works!
