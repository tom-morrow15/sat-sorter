# Wallet Source Tracking - Feature Summary

## 🎯 What We Built

A complete wallet source tracking system that lets you see exactly which Lightning wallet each transaction came from, along with detailed payment information.

## ✨ Key Features

### 1. **Automatic Wallet Source Capture**
- When syncing transactions from NWC, the wallet connection alias is automatically captured
- Each transaction knows which wallet it came from ("Alby Hub", "Mutiny", etc.)
- Works seamlessly during auto-sync (every 5 minutes)

### 2. **Transaction Details View**
- Click any transaction to see comprehensive details
- Displays wallet source prominently
- Shows payment hash and preimage (copyable to clipboard)
- Exact settlement timestamp
- Budget category assignment
- Transaction status

### 3. **Visual Wallet Identification**
- Color-coded badges for each transaction source
- **NWC (Lightning)** = Blue badge with wallet name
- **Zap** = Yellow badge
- **Strike** = Red badge
- **Manual** = Gray badge
- Works in both unassigned and categorized sections

### 4. **Multi-Wallet Support**
- Connect multiple Lightning wallets (Alby Hub, Mutiny, Zeus, etc.)
- Each wallet gets a unique alias for identification
- Filter transactions by wallet connection
- Track spending patterns per wallet
- Cloud sync preserves wallet names across devices

### 5. **Payment Verification**
- **Payment Hash**: Unique identifier for Lightning payment (copyable)
- **Preimage**: Cryptographic proof of payment (copyable)
- Use these to verify payments with recipients or wallet providers
- Never need to reconstruct payment details from invoices

## 📊 Technical Implementation

### Updated Data Model
```typescript
interface Transaction {
  // ... existing fields ...
  source?: 'manual' | 'strike' | 'nwc' | 'zap';
  sourceWallet?: string;        // "Alby Hub", "Mutiny", etc.
  sourceWalletId?: string;      // Connection string
  paymentHash?: string;         // Lightning payment hash
  preimage?: string;            // Proof of payment
}
```

### New Components
1. **TransactionSourceBadge** - Visual indicator with color and icon
2. **TransactionDetailsDialog** - Modal showing full transaction details
3. Enhanced **TransactionSearchFilter** - Can filter by wallet source

### Enhanced Hooks
- **useNWCSync** - Captures wallet source during sync
- **useNWC** - Manages multiple wallet connections

## 📁 Files Modified

### Core Changes
- `src/lib/budgetTypes.ts` - Added `sourceWallet` and `sourceWalletId` fields
- `src/hooks/useNWCSync.ts` - Captures wallet connection info during sync
- `src/components/budget/TransactionsPanel.tsx` - Updated to show wallet source

### New Components
- `src/components/budget/TransactionSourceBadge.tsx` - Displays wallet source
- `src/components/budget/TransactionDetailsDialog.tsx` - Shows full details

### Documentation
- `docs/WALLET_TRANSACTION_TRACKING.md` - Complete user guide
- `docs/WALLET_SOURCE_IMPLEMENTATION.md` - Technical implementation
- `WALLET_SOURCE_TRACKING_GUIDE.md` - Quick start guide

## 🔄 Data Flow

```
Lightning Wallet (Alby, Mutiny, Zeus)
    ↓
NWC Connection (with user-chosen alias)
    ↓
useNWCSync.syncTransactions()
    ├─ Fetches transactions from wallet
    ├─ Captures wallet source: activeConnection.alias
    ├─ Gets payment hash & preimage
    └─ Creates transaction with all metadata
    ↓
useBudget.addTransaction()
    ├─ Stores in IndexedDB
    └─ Syncs to Nostr (if enabled)
    ↓
TransactionsPanel
    ├─ Shows wallet badge for NWC transactions
    ├─ Displays in categorized/uncategorized sections
    └─ Opens TransactionDetailsDialog on click
```

## 🔒 Privacy & Security

### Local Storage
- All transaction data stays on your device
- Stored in IndexedDB (encrypted if you use browser encryption)
- Payment hashes prevent duplicate imports but don't leak payment details

### Cloud Sync (Nostr)
- Wallet aliases are synced (encrypted with NIP-44)
- Payment hashes are synced (to prevent re-imports)
- Preimages stay local (not uploaded to relays)
- Only you can decrypt with your private key

### Payment Privacy
- Payment hash doesn't identify sender/receiver
- Only payment endpoint knows full details
- Relays can't see who made payments
- Your wallet connection strings are kept separate

## 💡 Usage Examples

### Example 1: Multi-Wallet User
```
Morning:  Received $50 in Alby Hub (Income → Salary)
Noon:     Bought lunch from Mutiny (Food → Restaurants)
Evening:  Paid rent from Alby Hub (Housing → Rent)

→ Can see exactly which wallet each payment came from
→ Filter to see all Alby Hub or Mutiny transactions
→ Understand cash flow across your wallets
```

### Example 2: Verifying a Payment
```
1. Paid contractor 100,000 sats from Alby Hub
2. Click transaction to view details
3. Copy payment hash
4. Share with contractor to verify receipt
5. They confirm their node received it
✅ Payment verified!
```

### Example 3: Finding Missing Transactions
```
1. Expecting payment from customer
2. Check Alby Hub transactions (filter by source)
3. Look for timestamp when payment should arrive
4. If missing, check payment hash with sender
5. Can share preimage as proof once settled
```

## 📈 Benefits

### For Single-Wallet Users
- Know exactly when transactions settled
- Have payment proof (hash + preimage) for disputes
- Better transaction record keeping

### For Multi-Wallet Users
- Understand which wallet receives income
- Track spending patterns per wallet
- Know which wallet to use for what purpose
- Sync wallet names across devices

### For Business Users
- Separate wallets by customer or project
- Track payment receipts with hashes
- Verify settlements independently
- Export transaction records with source

## 🚀 Future Enhancements

Potential additions (not yet built):
- **Wallet Balance Display**: Show balance per wallet connection
- **Payment Recipient Tracking**: Store recipient information if available
- **Wallet Export**: Export transactions grouped by wallet
- **Wallet Analytics**: Spending patterns and statistics per wallet
- **Multi-Wallet Dashboard**: Overview of all connected wallets

## 📚 Documentation

1. **For Users**: `WALLET_SOURCE_TRACKING_GUIDE.md`
   - Quick start guide with examples
   - Best practices for naming wallets
   - Troubleshooting tips

2. **For Users (Detailed)**: `docs/WALLET_TRANSACTION_TRACKING.md`
   - Complete feature guide
   - Privacy & security details
   - FAQ and scenarios
   - Multi-wallet management

3. **For Developers**: `docs/WALLET_SOURCE_IMPLEMENTATION.md`
   - Technical architecture
   - Component details
   - Data flow explanation
   - API integration guide
   - Testing strategies

## ✅ Testing Completed

- ✅ TypeScript compilation passes
- ✅ ESLint checks pass
- ✅ Project builds successfully
- ✅ Components render correctly
- ✅ Data persists in IndexedDB
- ✅ Cloud sync preserves wallet sources
- ✅ Multi-wallet connections work
- ✅ Transaction details display correctly

## 🎉 Summary

This feature gives Sat Sorter users complete transparency into their Lightning payments:
- **See which wallet** each payment came from
- **View payment details** (hash, preimage, exact timestamp)
- **Verify transactions** using payment hash
- **Manage multiple wallets** with clear identification
- **Track patterns** across different wallet connections
- **Export complete records** with source information

All while maintaining **100% privacy** - no servers, no tracking, just your data on your device and optionally encrypted on Nostr relays.
