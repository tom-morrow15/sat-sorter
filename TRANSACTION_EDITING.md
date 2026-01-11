# Transaction Editing Feature

## Overview

Users can now edit transactions after they've been logged and categorized. This includes changing the transaction amount, description, category, and subcategory.

## How to Use

### Editing Categorized Transactions

1. Look for the "Categorized" section in the Transactions panel
2. **Click on any categorized transaction** to open the edit dialog
3. Make any changes you need:
   - Update the description
   - Change the amount (in USD or SATs depending on your currency setting)
   - Reassign to a different category or subcategory
   - Remove from a category by selecting "Unassigned"
4. Click "Save Changes" to apply the updates

### What Can Be Edited

- **Description**: Change the transaction description (e.g., "Alby Hub" → "Salary Deposit")
- **Amount**: Update the transaction amount in your selected currency
  - If you update a USD amount, the SAT equivalent will recalculate
  - If you update a SAT amount, the USD value will recalculate
- **Category**: Change which budget bucket the transaction belongs to
- **Subcategory**: Change which specific line item within a category

### Editing Unassigned Transactions

Unassigned transactions can also be edited by:
1. Clicking on an unassigned transaction in the "Needs Categorizing" section
2. The assign dialog will open where you can:
   - Categorize it to a bucket and line item
   - Or you can click "Edit" to also change the amount/description (future enhancement)

## Technical Implementation

### Files Modified

1. **src/pages/Budget.tsx**
   - Export `updateTransaction` from useBudget hook
   - Pass `onUpdateTransaction` prop to TransactionsPanel

2. **src/components/budget/TransactionsPanel.tsx**
   - Add `onUpdateTransaction` to component props
   - Add state for edit dialog: `showEditDialog`, `editAmount`, `editDescription`, `editBucketId`, `editLineItemId`
   - Add `handleOpenEdit()` function to open edit dialog with transaction data
   - Add `handleSaveEdit()` function to save changes
   - Make assigned transactions clickable (button element)
   - Add comprehensive edit dialog with all form fields
   - Handle amount parsing (USD ↔ SATs conversion)
   - Preserve USD amount logic (source of truth)

### Key Features

#### Dual Currency Support
- When editing in USD mode, the USD amount is treated as source of truth
- When editing in SAT mode, the SAT amount is treated as source of truth
- Exchange rates are captured at edit time

#### Smart Amount Parsing
```typescript
// Reuses the same parseInputAmount logic as add/assign
const { sats, usdAmount, usdPerBtcAtEntry } = parseInputAmount(editAmount);

// Returns both SAT and USD values properly formatted
```

#### Non-Breaking Updates
- Transactions update in place without losing other data
- Only the edited fields are updated via `Partial<Transaction>`
- Other properties (id, date, isIncome, etc.) remain unchanged

### State Management

Edit dialog uses local form state:
```typescript
const [editAmount, setEditAmount] = useState('');
const [editDescription, setEditDescription] = useState('');
const [editBucketId, setEditBucketId] = useState<string>('');
const [editLineItemId, setEditLineItemId] = useState<string>('');
```

When edit dialog opens, form is populated with current transaction values.

### Dialog Behavior

**Edit Dialog:**
- Modal dialog that opens when clicking a categorized transaction
- Shows all transaction details in editable fields
- Category and subcategory dropdowns
- "Unassigned" option to remove categorization
- Cancel/Save buttons

**Data Flow:**
1. User clicks transaction → `handleOpenEdit()` populates form
2. User makes changes to form fields
3. User clicks "Save Changes" → `handleSaveEdit()` validates and updates
4. Update sent via `onUpdateTransaction()` to parent component
5. Parent calls `updateTransaction()` from useBudget hook
6. Transaction data persists to local storage

## Future Enhancements

### Phase 2: Advanced Editing
- Edit unassigned transactions to also change amount/description before categorizing
- Bulk edit multiple transactions at once
- Edit transaction date (currently always uses entry date)
- Transaction notes/comments field
- Tag support for custom organization

### Phase 3: Transaction History
- View edit history of a transaction
- Undo/redo functionality
- Timestamp of last edit
- Track who made the edit (for multi-user features)

### Phase 4: Automatic Recategorization
- Machine learning to suggest category changes based on description
- Rules engine: "If description contains X, suggest category Y"
- Learn from user behavior over time

## User Experience

### Common Workflows

**Recategorizing Auto-Imported Transactions:**
```
Alby Hub imported "Zap received" as "Unknown"
1. Click the categorized transaction
2. Change category from blank to "Income"
3. Change subcategory to "Salary" or "Zaps"
4. Click "Save Changes"
✓ Transaction now properly categorized
```

**Correcting a Transaction:**
```
User manually logged "$50" but meant to enter "$500"
1. Click the transaction
2. Change amount from "$50" to "$500"
3. Click "Save Changes"
✓ USD amount is now $500 with updated SAT equivalent
```

**Moving Between Categories:**
```
User realized expense should be in different bucket
1. Click the transaction
2. Change category from "Transportation" to "Food"
3. Change subcategory as needed
4. Click "Save Changes"
✓ Transaction moved to new category
```

## Testing Checklist

- [ ] Click categorized transaction opens edit dialog
- [ ] Edit description and save
- [ ] Edit amount in USD mode and verify SAT equivalent updates
- [ ] Edit amount in SAT mode and verify USD equivalent updates
- [ ] Change category and save
- [ ] Change subcategory and save
- [ ] Remove categorization by setting to "Unassigned"
- [ ] Cancel button closes dialog without saving
- [ ] Transaction list updates immediately after save
- [ ] Delete button still works on categorized transactions
- [ ] Search/filter results can be edited
- [ ] USD amount preservation works when editing (doesn't recalculate from SAT)

## API

### Component Props

```typescript
onUpdateTransaction: (transactionId: string, updates: Partial<Transaction>) => void
```

**Example Usage:**
```typescript
onUpdateTransaction('txn-123', {
  description: 'Updated description',
  amount: 5000000,
  usdAmount: 200,
  usdPerBtcAtEntry: 40000,
  bucketId: 'bucket-456',
  lineItemId: 'item-789'
});
```

### Hook Usage

```typescript
const { updateTransaction } = useBudget();

updateTransaction(transactionId, {
  description: 'New description',
  amount: newSats,
  usdAmount: newUsd,
  bucketId: newBucketId,
  lineItemId: newLineItemId
});
```

## Notes

- Transaction dates cannot currently be edited (use creation date)
- Editing an already-assigned transaction doesn't prevent double-assignment errors (use responsibly)
- Amount validation ensures positive values only
- Empty description defaults to current description
- Assigned transactions show up in a scrollable list (top 10 visible)
- Edit dialog is separate from assign dialog (cleaner UX)
