# Wallet Transaction Tracking

## Overview

Sat Sorter now tracks which wallet connection each transaction originated from, allowing you to see exactly which Lightning wallet your payments came from and to whom they were sent.

## Features

### Transaction Source Identification

Every transaction imported from your Lightning wallets now shows:
- **Wallet Name**: The alias you gave to your wallet connection (e.g., "Alby Hub", "Mutiny Wallet")
- **Transaction Type**: Whether it was an incoming or outgoing payment
- **Payment Details**: Complete payment information including payment hash and preimage

### Viewing Transaction Details

Click on any transaction to see comprehensive payment information:

1. **Amount**: The exact satoshi amount (and USD value if applicable)
2. **Date & Time**: Exact timestamp when the payment was settled
3. **Source Wallet**: Which Lightning wallet connection the transaction came from
4. **Payment Hash**: The unique identifier for the Lightning payment (copyable)
5. **Preimage**: The cryptographic proof of payment (copyable)
6. **Category**: Which budget category the transaction is assigned to
7. **Status**: Confirmation that the payment is settled

### Filtering by Wallet Source

You can use the transaction search and filter to find transactions from specific wallet connections:

1. Go to **Transactions** panel
2. Use the search/filter to find transactions by wallet name
3. See all payments from that specific wallet connection

## How It Works

### Automatic Capture

When you use NWC to sync transactions from your Lightning wallet:

1. **Connection Setup**: You provide your wallet connection string
2. **Alias Creation**: You give the connection a name (e.g., "Alby Hub")
3. **Sync**: Transactions are imported with wallet source automatically captured
4. **Display**: Each transaction shows which wallet it came from

### Manual Transactions

Transactions you add manually don't have a wallet source (they show as "Manual Entry"). To add wallet information:

1. Edit the transaction (click to open details)
2. If you know the payment hash, you can update the description to include wallet context

### CSV Imports

When importing transactions via CSV:
- The source will show as the import source (e.g., "Strike API")
- If you want to associate them with a specific wallet, export from that wallet app first

## Multi-Wallet Management

If you have multiple Lightning wallets connected (e.g., Alby Hub + Mutiny):

1. **Each Connection is Tracked**: Transactions clearly show which wallet they came from
2. **Easy Identification**: Color-coded badges make it easy to spot transactions from different wallets
3. **Separate Views**: Filter to see transactions from specific wallets only
4. **Balance Tracking**: Understand which wallet sent which payments

## Payment Verification

For high-value transactions, you can verify payment authenticity:

1. **Payment Hash**: Unique identifier for the payment across all Lightning nodes
2. **Preimage**: Proves the payment was actually made
3. **Copy to Verify**: Use these values to verify payments with your wallet provider or on block explorers

## Privacy & Security

### Your Data
- All payment hashes and preimages are stored **only on your device**
- No payment information is sent to servers
- Your wallet connection strings are encrypted if you use cloud sync

### Payment Privacy
- The payment hash doesn't identify the sender/receiver
- Only you and the receiving Lightning node know the full payment details
- Even relays don't see who made payments

## Troubleshooting

### Transaction Not Showing Wallet Source

If an imported transaction doesn't show a wallet source:

1. **Manual Import**: The transaction may have been imported manually
2. **Legacy Transaction**: It was imported before wallet tracking was added
3. **CSV Import**: It came from a CSV file instead of direct wallet sync

**Solution**: You can manually update the transaction description to note which wallet it came from.

### Multiple Wallets Getting Mixed Up

If you're syncing from multiple wallets simultaneously:

1. **Rename Connections**: Give each wallet connection a clear, unique name
2. **Check Sync Order**: Wallets synced later will have more recent transactions
3. **Review Carefully**: After syncing, check that the correct wallet is marked for each transaction

### Preimage Not Available

Some wallet providers don't return the preimage. This is normal and doesn't indicate a problem:

1. **Payment Still Valid**: The transaction is still correctly recorded
2. **Hash Still Available**: You can still use the payment hash for verification
3. **Export Option**: Some wallets allow exporting full transaction history as CSV with more details

## Best Practices

### Naming Your Wallets

Give each connection a descriptive name:
- ✅ **Good**: "Alby Hub Main", "Mutiny Mobile", "Zeus Self-Hosted"
- ❌ **Bad**: "Wallet 1", "test", "NWC"

### Organizing by Wallet

If you have multiple wallets for different purposes:

1. **Income Wallet**: Keep income payments separate
2. **Spending Wallet**: Track daily spending separately  
3. **Savings Wallet**: Monitor your savings separately

Then use filters to see each wallet's activity.

### Reviewing Transactions

Regularly review imported transactions to:

1. Verify amounts are correct
2. Check that sources match expected wallets
3. Identify any suspicious activity
4. Categorize payments properly

## Technical Details

### Data Stored Per Transaction

```json
{
  "id": "unique-transaction-id",
  "amount": 50000,
  "description": "Payment description",
  "source": "nwc",
  "sourceWallet": "Alby Hub",
  "sourceWalletId": "nostr+walletconnect://...",
  "paymentHash": "abc123def456...",
  "preimage": "xyz789uvw012...",
  "isIncome": false,
  "date": "2024-01-15T14:30:00Z"
}
```

### Cloud Sync

When using cloud sync (Nostr):
- Wallet aliases are synced securely
- Payment hashes are stored (to prevent re-importing)
- Preimages are stored locally (not synced to relays)
- All encrypted data uses your private key

## FAQ

**Q: Will my wallet connections be stored on Nostr relays?**
A: Only encrypted references are stored, using NIP-44 encryption with your private key. Only you can decrypt them.

**Q: Can I see who received my payments?**
A: The payment hash identifies the payment but not the recipient. The Lightning invoice would have contained this info, but it's not stored by Sat Sorter.

**Q: What if I remove a wallet connection?**
A: Transactions from that wallet remain in your budget with the wallet name preserved. You can still see which wallet they came from.

**Q: Can I merge transactions from multiple wallets?**
A: You can update the category and assignment manually, but each transaction retains its source wallet information.

**Q: Why do some payments not show a preimage?**
A: Some wallets (especially older versions) don't provide preimage in their API responses. The payment is still valid and the payment hash is available.
