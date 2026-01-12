# Multi-Wallet Enhancement - Wallet Names in Transactions

## 🎯 What Changed

Transactions now **always display the wallet name** for each transaction, making it crystal clear which of your wallets each payment came from.

## 📊 Before vs After

### Before
```
☕ Coffee Shop
🟦 Lightning | Dec 15 | -5,000 sats
            ↑ Generic "Lightning" label
```

### After
```
☕ Coffee Shop
🟦 Alby Hub | Dec 15 | -5,000 sats
            ↑ Specific wallet name!
```

## 🏦 Multi-Wallet Setup Example

With 3 wallets connected:

```
Wallet 1: "Alby Hub" (Main Account)
Wallet 2: "Mutiny" (Mobile)
Wallet 3: "Zeus" (Self-Hosted)

Transactions now show:
─────────────────────────────────────
☕ Coffee Shop
🟦 Mutiny | Dec 15 | -5,000 sats
           ↑ You know it came from Mutiny!

💰 Salary
🟦 Alby Hub | Dec 1 | +500,000 sats
           ↑ Income went to Alby Hub

🚕 Uber
🟦 Zeus | Dec 14 | -8,500 sats
        ↑ From your self-hosted node
```

## 🔍 Where Wallet Names Appear

### 1. **Unassigned Transactions**
In the "Needs Categorizing" section, each transaction shows:
- Wallet name badge
- Transaction date
- Amount

### 2. **Assigned Transactions**
In the "Categorized" section, each transaction shows:
- Category badge
- Wallet name badge
- Date

### 3. **Search Results**
Filtered transactions show:
- Wallet name badge
- Category (if assigned)
- Date and amount

### 4. **Transaction Details Dialog**
Click any transaction to see:
- **Wallet Source** (large, bold heading)
- Wallet name prominently displayed
- Payment hash (copyable)
- Preimage (copyable)
- Full settlement details

## 🎨 Visual Identification

Each wallet source has a unique color:

| Wallet Type | Color | Icon | Example |
|-------------|-------|------|---------|
| Lightning (NWC) | 🟦 Blue | Wallet | "Alby Hub", "Mutiny", "Zeus" |
| Zap | 🟨 Yellow | Zap | "Zap Payment" |
| Strike | 🟥 Red | Link | "Strike Import" |
| Manual | ⬜ Gray | Plus | "Manual Entry" |

## 💡 How to Name Your Wallets

When connecting each wallet via NWC, give it a clear, descriptive name:

### ✅ Good Names
- "Alby Hub (Main)"
- "Mutiny (Mobile)"
- "Zeus (Self-Hosted)"
- "Alby Hub - Income"
- "Mutiny - Daily Spend"

### ❌ Poor Names
- "Wallet 1" (which wallet?)
- "test" (not descriptive)
- "NWC" (too generic)
- "" (blank - will say "Lightning")

## 🔄 How It Works

When you sync transactions from any wallet:

1. You connect a wallet and give it an alias: **"Alby Hub"**
2. You enable auto-sync
3. Transactions import with full payment details
4. Each transaction is tagged with **"Alby Hub"**
5. Transactions display the wallet name in badges
6. You can see at a glance which wallet made the payment

## 📱 Use Cases

### Case 1: Separate Wallets by Purpose
```
"Alby Hub (Income)" ← Money in
"Mutiny (Spending)" ← Daily expenses
"Zeus (Savings)" ← Long-term hold

You can immediately see which wallet a payment came from!
```

### Case 2: Identify Suspicious Activity
```
If you see: "🟦 Mutiny" on an unexpected large payment
You know to check your mobile wallet specifically
```

### Case 3: Organize Multi-Device Setup
```
Desktop Device: "Alby Hub (Desktop)"
Mobile Device: "Mutiny (Mobile)"

Same transaction list, clear source identification
```

## 🔧 Technical Details

### What's Stored
Each transaction now stores:
- `sourceWallet` - The wallet alias (e.g., "Alby Hub")
- `sourceWalletId` - The full connection string (for cloud sync)

### How Display Works
1. Check if transaction has a `sourceWallet` value
2. If yes → **Show the wallet name** (e.g., "Alby Hub")
3. If no → Fall back to source type (e.g., "Lightning", "Manual")

### Backward Compatibility
- Old transactions without wallet names? No problem!
- They'll show as "Lightning" instead of the wallet name
- New transactions automatically get the wallet name

## 🎯 Benefits for Multi-Wallet Users

| Benefit | What You Get |
|---------|--------------|
| **Clear Source** | Know exactly which wallet each payment came from |
| **Easy Filtering** | Filter by wallet name to see all transactions from one wallet |
| **Better Organization** | Understand cash flow across your wallets |
| **Dispute Resolution** | Quickly identify which wallet was used for a payment |
| **Audit Trail** | Complete history of which wallet sent/received what |

## 🚀 Getting Started

### To See Wallet Names in Your Transactions

1. **Connect wallets with clear names**
   - Go to Settings → Wallets
   - Add/Edit each wallet connection
   - Give each a descriptive name

2. **Sync transactions**
   - Enable auto-sync
   - Transactions will import with wallet source
   - New transactions show wallet names

3. **View your transactions**
   - Look at the "Transactions" panel
   - See wallet badge with the name
   - Click for full details including payment hash

## ❓ FAQ

**Q: Why does my transaction show "Lightning" instead of wallet name?**
A: It was imported before the enhancement, or synced from a wallet without an alias. You can manually edit the transaction or re-sync after naming your wallet.

**Q: Can I change a wallet's name?**
A: Yes! Edit the wallet connection in Settings. Future transactions will use the new name.

**Q: What happens to old transactions?**
A: They keep their original wallet name (or "Lightning" if unnamed). New transactions get the wallet name automatically.

**Q: Can I have multiple wallets with the same name?**
A: Not recommended - use unique names for clarity. But technically yes, they would all show the same badge.

**Q: Does this work with cloud sync?**
A: Yes! Wallet names are synced encrypted to Nostr. Log in on another device and see the same wallet names.

## 🎉 Summary

Transactions now **always show the specific wallet name** making it crystal clear which of your 3+ wallets each payment came from. Perfect for users managing multiple Lightning wallets!

**See exactly which wallet made each payment, every time.** ⚡
