# Wallet Source Tracking - User Guide

## 🎯 What's New

Sat Sorter now tracks which Lightning wallet each transaction came from, giving you complete visibility into your payments.

## 📱 Quick Start

### Step 1: Connect Your Wallet (NWC)
When you add your Lightning wallet via NWC (Nostr Wallet Connect):
- Give it a friendly name: "Alby Hub", "Mutiny", "Zeus", etc.
- Enable automatic sync
- Transactions will flow in

### Step 2: View Wallet Source
Each transaction now shows:
- **Wallet Badge**: Which wallet the payment came from (e.g., "Alby Hub" 🟦)
- **Amount**: How many sats were paid
- **Date**: When the transaction settled
- **Category**: Which budget category it's assigned to

Example:
```
☕ Coffee Shop
🟦 Alby Hub  |  Dec 15, 2024  |  -5,000 sats
```

### Step 3: Click for Details
Click any transaction to see comprehensive information:
- Full amount in sats (and USD if applicable)
- Exact settlement timestamp
- Source wallet connection
- **Payment Hash**: The unique Lightning payment ID
- **Preimage**: Cryptographic proof of settlement
- Category assignment

## 🏦 Managing Multiple Wallets

If you have multiple Lightning wallets connected:

### Separate by Purpose
```
Wallet 1: "Alby Hub (Main)"
├── Salary deposits
├── Large purchases
└── Bill payments

Wallet 2: "Mutiny (Mobile)"
├── Daily spending
├── Tips & donations
└── Small payments
```

### Track Separately
Use filters to see transactions from specific wallets:
1. Tap the search/filter button
2. Enter wallet name
3. See all transactions from that wallet

### Understand Your Flow
- Which wallet do you receive payments to?
- Which wallet do you spend from daily?
- Which wallet is your savings account?

## 💡 Understanding Payment Information

### Payment Hash
- **What it is**: Unique identifier for a Lightning payment
- **Why it matters**: Prevents duplicate payments
- **How to use**: Verify payment was received with the recipient
- **Privacy**: Doesn't identify who sent or received payment

### Preimage
- **What it is**: Cryptographic proof that payment was settled
- **Why it matters**: Proves you actually made the payment
- **How to use**: Share with wallet support for verification
- **Privacy**: Only you and the recipient should know

### Example Scenario
You paid someone 50,000 sats:
1. ✅ Amount settled: 50,000 sats
2. ✅ Wallet: Alby Hub
3. ✅ Payment Hash: `abc123def456...`
4. ✅ Date: Jan 15, 2024 at 2:30 PM
5. ✅ Preimage: `xyz789uvw012...` (proof of payment)

## 🔄 Syncing Best Practices

### Setting Up Sync
1. Add wallet connection: **Import** → **Add NWC Connection**
2. Give it a clear name
3. Enable **Auto-Sync** (5-minute intervals)
4. First sync gets recent transactions

### What Gets Imported
- ✅ Incoming Lightning payments
- ✅ Outgoing Lightning payments
- ✅ Payment amounts
- ✅ Payment hashes & preimages
- ✅ Settlement dates
- ❌ Merchant names (unless stored in wallet notes)
- ❌ Invoice descriptions (depends on wallet)

### Manual Entry
Don't have an NWC-compatible wallet? No problem:
1. Export transactions as CSV from your wallet
2. Use **Import** → **Import CSV**
3. Manually add wallet source to descriptions
4. Categorize each transaction

## 📊 Example Scenarios

### Scenario 1: Multi-Wallet User
```
Date         | Description      | Amount  | Wallet        | Category
-------------|------------------|---------|---------------|----------
Dec 15       | Grocery Store    | 5,000   | Alby Hub      | Food → Groceries
Dec 14       | Gas Station      | 3,500   | Mutiny Mobile | Transport → Gas
Dec 14       | Salary Income    | 500,000 | Alby Hub      | Income → Salary
```

### Scenario 2: Verifying a Payment
You want to verify a payment to your landlord:

1. Click transaction in Categorized section
2. View Transaction Details
3. Copy Payment Hash: `3d4f5e6a7b8c...`
4. Share with landlord to verify receipt
5. They confirm their node received it
6. ✅ Payment verified!

### Scenario 3: Finding Duplicate Payments
You notice a large expense twice:

1. Use filter to search by description
2. See both transactions from same wallet
3. Check Payment Hashes - if they're the same, it's a display bug
4. If different, they were two separate payments
5. Delete the duplicate or investigate further

## 🛡️ Security Notes

### What's Stored Locally
- Transaction amounts
- Payment hashes
- Preimages
- Wallet connection names
- All category assignments

### What's NOT Stored
- Your wallet private keys
- Your wallet connection strings (kept separate)
- Recipient/sender details (unless in description)
- Bank account information

### Cloud Sync
If you enable Nostr cloud sync:
- Wallet names are synced (encrypted)
- Payment hashes are synced (to prevent re-imports)
- Preimages stay on your device
- Your private key encrypts everything

## ❓ Troubleshooting

### Transaction Missing Wallet Source
**Why**: It was imported before wallet tracking, or imported from CSV
**Fix**: Edit and manually add wallet info to description

### Preimage Not Showing
**Why**: Your wallet doesn't provide preimage data
**Fix**: It's optional - Payment Hash is sufficient for verification

### Wallet Name Shows as Connection String
**Why**: You connected without giving it an alias
**Fix**: Edit the wallet connection name in settings

### Transactions Showing Wrong Wallet
**Why**: Multiple wallets synced simultaneously
**Fix**: Check which wallet was synced last; verify dates match

## 📝 Tips & Tricks

### Naming Conventions
Use consistent naming across devices:
- ✅ "Alby Hub (Main Account)"
- ✅ "Mutiny (Mobile)"
- ✅ "Zeus (Self-Hosted Node)"

### Regular Auditing
Weekly:
1. Review new transactions
2. Check amounts are correct
3. Verify wallet sources match expectations
4. Categorize unassigned payments

Monthly:
1. Export categorized transactions
2. Compare with bank/wallet records
3. Identify patterns and spending trends
4. Adjust budget as needed

### Using Payment Hashes
Keep them for:
- Dispute resolution
- Payment verification
- Wallet migration (when switching providers)
- Historical records

## 🚀 Next Steps

1. **Set up NWC**: Connect your Lightning wallet
2. **Name it clearly**: "Alby Hub", "Mutiny", etc.
3. **Enable auto-sync**: Get transactions automatically
4. **Review transactions**: Click to see full details
5. **Categorize**: Assign to budget categories
6. **Monitor**: Use filters to track spending by wallet

## Questions?

For detailed documentation, see [WALLET_TRANSACTION_TRACKING.md](./docs/WALLET_TRANSACTION_TRACKING.md)
