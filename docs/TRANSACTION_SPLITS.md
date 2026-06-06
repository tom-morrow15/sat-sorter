# Transaction Splits Implementation Design

## Overview

**Goal:** Enable users to split a single transaction across multiple categories/line items. For example, a $100 Walmart purchase can be split as $60 to Groceries and $40 to Household.

**Reference:** EveryDollar app by Dave Ramsey provides similar functionality.

**Current State:** The app treats each transaction as a single atomic unit assigned to one bucket + line item. No split capability exists.

**Impact:** Low-risk feature – it's purely additive and doesn't change the existing single-assignment transaction flow.

---

## 1️⃣ Data Model Changes

### 1.1 Transaction Type Extension

**Current:**
```typescript
export interface Transaction {
  id: string;
  amount: number; // in sats
  amountUsd?: number; // USD (source of truth)
  description: string;
  date: string; // ISO date string
  lineItemId: string | null; // assigned to one line item
  bucketId: string | null;
  isIncome: boolean;
  // ... other fields
}
```

**Proposed:**
```typescript
export interface TransactionSplit {
  id: string; // unique split ID
  lineItemId: string; // which line item this portion goes to
  bucketId: string; // which bucket this portion goes to
  amount: number; // portion in sats
  amountUsd?: number; // portion in USD
  description?: string; // optional note for this split (e.g., "Groceries portion")
}

export interface Transaction {
  id: string;
  amount: number; // total in sats (sum of all splits if splits exist)
  amountUsd?: number; // total USD (source of truth)
  btcPriceAtEntry?: number;
  description: string;
  date: string; // ISO date string
  lineItemId: string | null; // DEPRECATED – kept for backward compatibility
  bucketId: string | null; // DEPRECATED – kept for backward compatibility
  isIncome: boolean;
  source?: 'manual' | 'strike' | 'nwc' | 'zap';
  merchantName?: string;
  categoryHint?: string;
  
  // ===== NEW FIELDS =====
  splits?: TransactionSplit[]; // array of split portions (if empty/null → use legacy lineItemId/bucketId)
  isSplit?: boolean; // quick flag: true if splits.length > 0
}
```

### 1.2 Backward Compatibility

- **Existing transactions without splits:** Keep `lineItemId` and `bucketId` populated. The app treats them as single-assignment (status quo).
- **New split transactions:** Populate `splits` array. Leave `lineItemId` and `bucketId` null (or copy the first split's values for quick reference).
- **Helper function:** Always use `getTransactionAssignments(tx)` to get the actual assignments, which handles both legacy and split formats.

```typescript
export function getTransactionAssignments(tx: Transaction): 
  Array<{ bucketId: string; lineItemId: string; amountUsd: number; amountSats: number }> {
  if (tx.splits && tx.splits.length > 0) {
    return tx.splits.map(s => ({
      bucketId: s.bucketId,
      lineItemId: s.lineItemId,
      amountUsd: s.amountUsd ?? 0,
      amountSats: s.amount,
    }));
  }
  // Legacy format
  if (tx.lineItemId && tx.bucketId) {
    return [{
      bucketId: tx.bucketId,
      lineItemId: tx.lineItemId,
      amountUsd: tx.amountUsd ?? 0,
      amountSats: tx.amount,
    }];
  }
  // Unassigned
  return [];
}
```

---

## 2️⃣ UI / UX Flow

### 2.1 "Edit" Transaction Dialog (Enhanced)

**Current flow:**
- User clicks a transaction → small panel shows description, amount, assigned line item.
- User can reassign to a different line item.

**New flow:**
1. User clicks transaction.
2. Small panel appears with two options:
   - **"Quick assign"** (default) – assign the whole transaction to one line item (existing UX).
   - **"Split transaction"** (new button) – opens the detailed split editor.

### 2.2 Split Editor Dialog

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Split Transaction                           │
│ ─────────────────────────────────────────── │
│ Total: $100.00 (900,000 sats)               │
├─────────────────────────────────────────────┤
│                                             │
│ Split 1:  [Groceries] [$60.00] [540k sats] │
│ Split 2:  [Household] [$40.00] [360k sats] │
│                                             │
│ [+ Add split]                               │
│                                             │
│ ✓ Splits sum to total ($100.00)             │
│                                             │
│ [Cancel] [Save splits]                      │
└─────────────────────────────────────────────┘
```

**User actions:**
1. **Add a split:** Click "Add split" button → new row appears with empty bucket/line item dropdowns and an amount field.
2. **Edit a split:** Change the bucket → line item dropdown auto-populates (filtered to the selected bucket).
3. **Change amount:** User enters either USD or sats (toggle like the main transaction form). The app auto-converts using `useBitcoinPrice()`.
4. **Delete a split:** Click the trash icon next to the split row.
5. **Validation:** The dialog shows a checkmark or error if the sum of all split amounts equals the total transaction amount.

### 2.3 Key Interaction Details

- **Bucket/line-item selection:** When user selects a bucket, line-item dropdown filters to show only items in that bucket (existing pattern from other forms).
- **Real-time sum:** As the user edits amounts, the dialog shows "Subtotal: $X.XX" and updates the validation status.
- **Rounding:** Allow up to 2 decimal places for USD; sats are rounded to nearest sat (the `usdToSats` function already does this).
- **Tab navigation:** Users can tab through bucket → line item → amount fields for efficient entry.

---

## 3️⃣ Code Structure & Changes

### 3.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **SplitEditor** | `src/components/budget/SplitEditor.tsx` | Modal dialog for editing splits; handles add/remove/validation. |
| **SplitRow** | `src/components/budget/SplitRow.tsx` | Single split row (bucket, line item, amount inputs). |

### 3.2 Modified Components

| Component | Changes |
|-----------|---------|
| **TransactionsPanel** | Add "Split" button when user selects a transaction. |
| **TransactionRow** / **LineItemRow** | Show a small badge "Split (3)" if the transaction has multiple splits. |
| **AddTransactionDialog** | (Optional) Add a quick "Create as split" option so users can enter a split from the start instead of assigning then editing. |

### 3.3 New / Modified Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| **useBudget** | `src/hooks/useBudget.ts` | Add `splitTransaction(txId, newSplits)` action. Update `deleteTransaction` to handle cascading deletes. |
| (existing) | – | Modify `calculateSpentForLineItem` to use `getTransactionAssignments()` so split amounts are counted correctly. |

### 3.4 New Utility Functions

**File:** `src/lib/splitUtils.ts`

```typescript
/**
 * Get all assignments (bucket + line item combos) for a transaction,
 * handling both legacy single-assignment and new split formats.
 */
export function getTransactionAssignments(tx: Transaction): 
  Array<{ bucketId: string; lineItemId: string; amountUsd: number; amountSats: number }> {
  if (tx.splits && tx.splits.length > 0) {
    return tx.splits.map(s => ({
      bucketId: s.bucketId,
      lineItemId: s.lineItemId,
      amountUsd: s.amountUsd ?? 0,
      amountSats: s.amount,
    }));
  }
  if (tx.lineItemId && tx.bucketId) {
    return [{
      bucketId: tx.bucketId,
      lineItemId: tx.lineItemId,
      amountUsd: tx.amountUsd ?? 0,
      amountSats: tx.amount,
    }];
  }
  return [];
}

/**
 * Validate that all splits sum to the transaction total.
 * Returns { isValid: boolean; message?: string }
 */
export function validateSplits(
  totalUsd: number,
  splits: TransactionSplit[],
): { isValid: boolean; message?: string } {
  if (!splits || splits.length === 0) {
    return { isValid: false, message: "At least one split is required." };
  }
  const sumUsd = splits.reduce((sum, s) => sum + (s.amountUsd ?? 0), 0);
  const diff = Math.abs(sumUsd - totalUsd);
  if (diff > 0.01) {
    return {
      isValid: false,
      message: `Split amounts ($${sumUsd.toFixed(2)}) don't match total ($${totalUsd.toFixed(2)}).`,
    };
  }
  return { isValid: true };
}

/**
 * Create a new split from an existing transaction.
 * Returns a TransactionSplit object with generated ID.
 */
export function createSplit(
  bucketId: string,
  lineItemId: string,
  amountUsd: number,
  amountSats: number,
): TransactionSplit {
  return {
    id: crypto.randomUUID(),
    bucketId,
    lineItemId,
    amountUsd,
    amount: amountSats,
  };
}
```

---

## 4️⃣ Impact on Existing Calculations

### 4.1 Line Item Spent Amount

**Current:**
```typescript
export function calculateSpentForLineItem(lineItemId: string, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.lineItemId === lineItemId && !t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);
}
```

**New (using helper):**
```typescript
export function calculateSpentForLineItem(lineItemId: string, transactions: Transaction[]): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.isIncome) continue;
    const assignments = getTransactionAssignments(tx);
    for (const assign of assignments) {
      if (assign.lineItemId === lineItemId) {
        total += assign.amountSats;
      }
    }
  }
  return total;
}
```

This ensures that:
- A $100 transaction split as $60 (Groceries) + $40 (Household) adds 540k sats to Groceries spent and 360k sats to Household spent.
- Legacy single-assignment transactions continue to work unchanged.

### 4.2 Budget Remaining Calculation

**No change needed:** The logic that compares total income vs. total spent already feeds on `calculateSpentForLineItem`, so splits are automatically accounted for.

### 4.3 Transactions Panel Display

When displaying the list of transactions:
- **Single-assignment (legacy):** Show as normal.
- **Split:** Display a small badge (e.g., "Split (3)") next to the amount to indicate it's split across 3 line items.
- **On click:** Show the split breakdown.

---

## 5️⃣ Edge Cases & Validation

| Edge Case | How to Handle |
|-----------|--------------|
| **User tries to save splits that don't sum to the total** | Validation error dialog, don't save. |
| **User deletes all splits** | If splits array becomes empty, revert to legacy single-assignment or delete the transaction. |
| **User converts a legacy transaction to a split** | When editing, prompt: "Convert this transaction to a split?" If yes, create splits array. Keep original transaction ID. |
| **User "unsplits" a split transaction** | Add an "Undo splits" button on the split editor that reverts to single-assignment (pick the most recent/largest split and use that). |
| **Undo/redo** | No special handling needed – the transaction object change is stored in the budget state like any other edit. |
| **CSV export** | If exporting, flatten splits: export one CSV row per split. Or provide a "flattened" export option. |

---

## 6️⃣ Implementation Roadmap

### Phase 1: Data Model & Core Logic (≈2–3 hours)

1. Update `Transaction` interface in `budgetTypes.ts`.
2. Add `TransactionSplit` interface.
3. Create `splitUtils.ts` with validator + helper functions.
4. Update `useBudget` hook to add `splitTransaction` action.
5. Update `calculateSpentForLineItem` to use the new helper.
6. **Test:** Verify that a split transaction correctly distributes amounts across line items.

### Phase 2: UI – Split Editor (≈3–4 hours)

1. Create `SplitEditor.tsx` component (dialog with add/remove/validation).
2. Create `SplitRow.tsx` sub-component (single split row).
3. Wire into `TransactionsPanel` – add "Split" button.
4. **Test:** Create a transaction, click "Split", add multiple splits, verify validation and save.

### Phase 3: Integration & Polish (≈2–3 hours)

1. Update transaction display (show "Split (N)" badge).
2. Add "Undo splits" / "Convert to single-assignment" option.
3. Update CSV export to flatten splits.
4. Add documentation / in-app help.
5. **Test:** Full flow from transaction creation through split editing to budget calculation.

### Phase 4: Optional Enhancements (future)

- Quick-split suggestions (e.g., "Split 50/50", "Split by category hints").
- Split templates (save a common split pattern for reuse).
- Bulk split (apply the same split pattern to multiple transactions at once).

**Total estimated effort: ≈8–10 hours for a complete, polished implementation.**

---

## 7️⃣ Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| **Create a new split transaction** | Transaction appears with "Split (N)" badge in the list. Spent amounts update correctly for each assigned line item. |
| **Edit an existing split** | Can add/remove splits. Validation prevents saving if sums don't match. |
| **Convert legacy to split** | Single-assignment transaction can be converted to a split and back. |
| **Calculate totals** | Income, expenses, remaining budget all reflect split transactions correctly. |
| **Budget partners sync** | Split transactions are synced to partners via Nostr (no special logic needed – treated as a single transaction with splits). |
| **CSV export** | Exported CSV shows one row per split (or a note indicating splits). |
| **Transactions by line item filter** | Clicking a line item filters to show only transactions (including splits) assigned to that line item. |
| **Mobile UI** | Split editor is usable on small screens (stacked layout or scrollable). |

---

## 8️⃣ Backward Compatibility Guarantee

**✅ No breaking changes:**
- Existing transactions (without splits) continue to work unchanged.
- Synced budgets from other devices include the new `splits` field (defaulting to `null` if not present).
- Older versions of the app that don't understand `splits` will simply ignore the field and fall back to legacy `lineItemId` / `bucketId`.

---

## 9️⃣ Example User Journey

1. **User adds a transaction:** $100 Walmart purchase, not assigned yet.
2. **User clicks "Split transaction":**
   - Dialog opens with the full $100 shown.
   - User adds Split 1: Groceries $60.
   - User adds Split 2: Household $40.
   - Validation shows ✓ "Splits sum correctly."
   - User clicks "Save splits."
3. **Result:**
   - Transaction now shows "$100 (Split)" in the list.
   - Groceries line item spent is increased by $60 (in USD), converted to sats.
   - Household line item spent is increased by $40 (in USD), converted to sats.
   - Remaining budget updates accordingly.
4. **Later, user edits the transaction:**
   - Clicks the transaction → sees the split breakdown.
   - Can add/remove/modify splits as needed.
   - Can revert to single-assignment if desired.

---

## 🔟 Notes & Open Questions

| Question | Decision |
|----------|----------|
| Should we allow splitting income transactions? | **Probably not at first.** Income typically goes to a single "Income" bucket. Can add later if needed. |
| Should split notes (e.g., "groceries portion") be visible in the transaction list? | **On hover / expand.** By default, keep the list clean; detailed notes appear in the split editor. |
| Should we auto-suggest splits based on merchant name? | **Future enhancement.** For now, manual entry only. |
| Max number of splits per transaction? | **No hard limit.** Validation is only on sum. UI can show a subtle warning if > 10 splits. |
| Should CSV import create splits automatically? | **Not for MVP.** Imported transactions are single-assignment; user can split them afterward if needed. |

---

## Summary

This design adds a lightweight but powerful feature: the ability to split a transaction across multiple categories. It:

- ✅ Maintains backward compatibility with existing transactions.
- ✅ Integrates cleanly with the existing budget calculation logic.
- ✅ Keeps the UI simple (one "Split" button, one modal dialog).
- ✅ Aligns with the EveryDollar reference.
- ✅ Requires no server-side changes (data stays encrypted locally).
- ✅ Is testable and has clear acceptance criteria.

When ready to implement, start with Phase 1 (data model), then Phase 2 (UI), then test end-to-end. Total effort: ~8–10 hours for a complete, polished MVP.
