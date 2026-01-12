# Wallet Source Implementation Guide

## Overview

This document explains how wallet source tracking is implemented in Sat Sorter, allowing you to understand which wallet connection each transaction came from.

## Architecture

### Data Model

The `Transaction` type now includes wallet source fields:

```typescript
export interface Transaction {
  // ... existing fields ...
  source?: 'manual' | 'strike' | 'nwc' | 'zap'; // Where it came from
  sourceWallet?: string;        // Alias: "Alby Hub", "Mutiny", etc.
  sourceWalletId?: string;      // Connection string (encrypted)
}
```

### Component Hierarchy

```
TransactionsPanel
├── TransactionSourceBadge (displays wallet source)
├── TransactionDetailsDialog (shows full details)
└── Transaction List
    ├── Unassigned Section
    ├── Assigned Section
    └── Search Results
```

## Components

### TransactionSourceBadge

**Location**: `src/components/budget/TransactionSourceBadge.tsx`

Displays wallet source with colored badge and icon.

```typescript
<TransactionSourceBadge 
  transaction={transaction} 
  className="text-xs px-1.5 py-0"
  showWallet={true}
/>
```

Features:
- Color-coded by source type (NWC=blue, Zap=yellow, Strike=red)
- Shows wallet name if available
- Icons for visual identification
- Optional className for styling

### TransactionDetailsDialog

**Location**: `src/components/budget/TransactionDetailsDialog.tsx`

Full-screen modal showing comprehensive transaction information.

```typescript
<TransactionDetailsDialog
  open={showDetailsDialog}
  onOpenChange={setShowDetailsDialog}
  transaction={selectedTransaction}
  bucketName="Food"
  lineItemName="Groceries"
/>
```

Displays:
- Transaction amount and date
- Source wallet connection
- Payment hash (copyable)
- Preimage (copyable)
- Budget category assignment
- Payment status

## Data Flow

### NWC Sync Process

1. **Connection Setup** (`useNWC.ts`)
   ```typescript
   // User adds wallet connection with alias
   await addConnection(connectionString, "Alby Hub")
   ```

2. **Transaction Sync** (`useNWCSync.ts`)
   ```typescript
   // Get active connection
   const activeConnection = getActiveConnection()
   
   // List transactions from wallet
   const response = await listTransactions(
     activeConnection.connectionString,
     { from: lastTransactionTimestamp }
   )
   ```

3. **Create Transaction with Wallet Source**
   ```typescript
   const transaction = {
     amount: amountSats,
     description,
     date: transactionDate,
     source: 'nwc',
     sourceWallet: activeConnection.alias,      // "Alby Hub"
     sourceWalletId: activeConnection.connectionString,
     paymentHash: nwcTx.payment_hash,
     preimage: nwcTx.preimage,
     // ... other fields
   }
   ```

4. **Add to Budget** (`useBudget.ts`)
   ```typescript
   addTransaction(transaction)
   ```

5. **Sync to Cloud** (`useBudgetSync.ts`)
   ```typescript
   // Encrypt and upload to Nostr
   await uploadBudget(fullState)
   ```

### Display Process

1. **Load Transactions** (`Budget.tsx`)
   ```typescript
   const { currentBudget } = useBudget()
   // currentBudget.transactions includes wallet source
   ```

2. **Render Transaction List** (`TransactionsPanel.tsx`)
   ```typescript
   {transaction.source === 'nwc' && (
     <TransactionSourceBadge 
       transaction={transaction}
       showWallet={true}
     />
   )}
   ```

3. **Show Details** (on click)
   ```typescript
   <TransactionDetailsDialog
     open={showDetailsDialog}
     transaction={selectedTransaction}
   />
   ```

## State Management

### Local Storage
Transactions are stored in IndexedDB via the budget hook:
- `currentBudget.transactions[]` includes all wallet source fields
- Persisted between sessions

### Cloud Sync (Nostr)
When user enables cloud sync:
1. Wallet aliases are included in encrypted budget data
2. Payment hashes prevent re-importing
3. Uses NIP-44 encryption with user's key
4. Only encrypted data sent to relays

```typescript
// In useNWCSync
const encrypted = await nip44.encrypt(user.pubkey, plaintext)
await publish({
  kind: 30079, // NIP-78 app data
  content: encrypted,
  tags: [
    ['d', 'sat-sorter/budget-data'],
    ['alt', 'Sat Sorter Budget (encrypted)'],
  ],
})
```

## Wallet Connection Management

### Storage (`useNWC.ts`)

Connections stored in localStorage:
```typescript
// src/contexts/NWCContext.tsx
const [connections, setConnections] = useLocalStorage<NWCConnection[]>(
  'nwc-connections',
  []
)

interface NWCConnection {
  connectionString: string;  // Full NWC URI
  alias?: string;           // User-friendly name
  isConnected: boolean;
}
```

### Cloud Sync of Connections (`useNWCSync.ts`)

```typescript
// Download connections from Nostr on login
const downloadNWCConnections = async () => {
  const events = await nostr.query([
    {
      kinds: [30079],
      authors: [user.pubkey],
      '#d': ['sat-sorter/nwc-connections'],
    }
  ])
  
  // Decrypt and restore connections
  const encrypted = events[0].content
  const plaintext = await nip44.decrypt(user.pubkey, encrypted)
  const connections = JSON.parse(plaintext).connections
  
  // Add missing connections
  for (const conn of connections) {
    if (!connections.some(c => c.connectionString === conn.connectionString)) {
      await addConnectionToState(conn.connectionString, conn.alias)
    }
  }
}
```

## API Integration

### NIP-47 (Nostr Wallet Connect)

Used for fetching transactions:

```typescript
// src/lib/nwcClient.ts
export async function listTransactions(
  connectionString: string,
  options?: {
    from?: number;      // Unix timestamp
    until?: number;
    limit?: number;
    type?: 'incoming' | 'outgoing';
  }
): Promise<{ transactions: NWCTransaction[] }>

interface NWCTransaction {
  type: 'incoming' | 'outgoing';
  payment_hash: string;      // SHA256 hash
  preimage?: string;         // Proof of payment
  amount: number;            // in millisats
  created_at: number;        // unix timestamp
  settled_at?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}
```

The connection string format:
```
nostr+walletconnect://[wallet-pubkey]?relay=[relay-url]&secret=[secret-key]
```

## Display Logic

### Source Color Coding

```typescript
// src/components/budget/TransactionSourceBadge.tsx
const getSourceColor = () => {
  switch (transaction.source) {
    case 'nwc':
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
    case 'zap':
      return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
    case 'strike':
      return 'bg-red-500/20 text-red-700 dark:text-red-400'
    case 'manual':
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-400'
  }
}
```

### Transaction Details Modal

```typescript
// src/components/budget/TransactionDetailsDialog.tsx
export function TransactionDetailsDialog({
  transaction,
  bucketName,
  lineItemName,
}: Props) {
  return (
    <Dialog>
      {/* Transaction header with icon and amount */}
      {/* Source information section */}
      {/* Payment details (hash, preimage) */}
      {/* Category assignment */}
      {/* Status indicator */}
    </Dialog>
  )
}
```

## Backward Compatibility

### Migration Strategy

Old transactions without wallet source fields:
- Display without wallet badge
- Can be edited to add wallet info
- Cloud sync preserves existing data
- New transactions always include source

```typescript
// In TransactionsPanel
{transaction.source === 'nwc' && (
  <TransactionSourceBadge {...} />
)}
// Only shows badge if source is available
```

### CSV Import

When importing from CSV:
- Each transaction gets `source: 'csv'` or original source
- No `sourceWallet` unless manually added
- Can be edited afterward

```typescript
// src/hooks/useBudget.ts
const importedTransaction = {
  ...csvData,
  source: csvData.source || 'csv',
  // sourceWallet would need manual entry
}
```

## Testing

### Unit Tests

Key areas to test:

1. **Wallet Source Badge**
   ```typescript
   it('displays correct source color for NWC', () => {
     const tx = { source: 'nwc', sourceWallet: 'Alby Hub' }
     render(<TransactionSourceBadge transaction={tx} />)
     expect(screen.getByText('Alby Hub')).toHaveClass('text-blue-700')
   })
   ```

2. **Transaction Details Dialog**
   ```typescript
   it('shows payment hash and preimage', () => {
     const tx = { paymentHash: 'abc123', preimage: 'xyz789' }
     render(<TransactionDetailsDialog transaction={tx} open={true} />)
     expect(screen.getByText(/abc123/)).toBeInTheDocument()
   })
   ```

3. **NWC Sync**
   ```typescript
   it('captures wallet source during sync', async () => {
     const result = await syncTransactions()
     expect(result.imported).toBeGreaterThan(0)
     const tx = budget.transactions[0]
     expect(tx.sourceWallet).toBe('Alby Hub')
   })
   ```

### Manual Testing

1. **Connect multiple wallets**
   - Add Alby Hub with alias "Alby Hub"
   - Add Mutiny with alias "Mutiny Mobile"
   - Verify each shows correct alias

2. **Sync transactions**
   - Trigger manual sync
   - Verify transactions show wallet source
   - Check payment hashes are captured

3. **View details**
   - Click transaction
   - Verify dialog shows all fields
   - Test copy buttons for hash/preimage

4. **Cloud sync**
   - Enable cloud sync
   - Verify wallet names persist
   - Log out and log in
   - Confirm transactions retained with source

## Performance Considerations

### Database Queries
- Transactions indexed by date and lineItemId
- Wallet filter done in memory (small result set)
- No additional relay queries needed

### Storage
- Payment hash: ~64 bytes (hex string)
- Preimage: ~64 bytes (hex string)
- Wallet alias: ~20 bytes average
- Total per transaction: ~150 bytes additional

For 1000 transactions: ~150KB additional storage

### Sync Optimization
- Uses `lastTransactionTimestamp` for incremental sync
- Avoids re-importing duplicates via payment hash check
- Batches NWC requests (limit: 200 per request)

## Future Enhancements

### Potential Features

1. **Wallet Balance Tracking**
   ```typescript
   // Display balance per wallet connection
   {sourceWallet: 'Alby Hub', balance: 1_000_000}
   ```

2. **Payment Recipient Tracking**
   ```typescript
   // If invoice includes payee info
   {paymentRecipient: 'satoshi@example.com'}
   ```

3. **Wallet Export**
   ```typescript
   // Export transactions grouped by wallet
   export type: 'by-wallet' | 'by-category'
   ```

4. **Wallet Analytics**
   ```typescript
   // Spending patterns per wallet
   {walletName: 'Alby Hub', totalSpent: 5_000_000, transactions: 42}
   ```

5. **Multi-Wallet Dashboard**
   ```typescript
   // Overview of all connected wallets
   <WalletDashboard connections={connections} />
   ```

## Debugging

### Enabling Debug Logs

The sync process includes detailed logging:

```typescript
// In useNWCSync.ts
console.log('[NWCSync] Importing transaction:', {
  amount: amountSats,
  description,
  wallet: activeConnection.alias,
  paymentHash: nwcTx.payment_hash,
})
```

### Common Issues

1. **Wallet source not showing**
   - Check if `source === 'nwc'`
   - Verify `sourceWallet` is not undefined
   - Inspect IndexedDB for transaction data

2. **Payment hash missing**
   - Wallet may not support NIP-47 fully
   - Check wallet info fetch in `checkWalletCapabilities`
   - Fallback to description if hash unavailable

3. **Cloud sync losing wallet names**
   - Verify encryption/decryption working
   - Check NIP-44 availability
   - Confirm event published to relay

## Related Documentation

- [WALLET_TRANSACTION_TRACKING.md](./WALLET_TRANSACTION_TRACKING.md) - User guide
- [WALLET_SOURCE_TRACKING_GUIDE.md](../WALLET_SOURCE_TRACKING_GUIDE.md) - Quick start
- [docs/NOSTR_DIRECT_MESSAGES.md](./NOSTR_DIRECT_MESSAGES.md) - NIP-44 encryption patterns
