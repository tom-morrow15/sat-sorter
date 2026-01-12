# Fixing Wallet Names on Existing Transactions

## 🔍 The Issue

If you're still seeing "Lightning" instead of your wallet names, it's because:

1. **Your wallets were connected without custom names** - They got default names like "NWC Wallet"
2. **Transactions were synced before wallet names were set** - They didn't have the wallet alias captured
3. **The enhancement just fixed the issue** - Now wallet names are REQUIRED when connecting

## ✅ Solution: Re-sync with Proper Wallet Names

### Step 1: Update Your Wallet Names

First, you need to give each wallet a clear, unique name. Here's how:

1. Open **Sat Sorter**
2. Click **Import Transactions** button
3. Go to **Alby Hub** tab
4. You should see your connected wallets listed

For each wallet, look for where you can edit or rename it. If there's no rename option, you'll need to:
- Delete the connection
- Re-add it with a proper name

### Step 2: Delete Old Connections Without Names

1. In the **Alby Hub** tab, find each connected wallet
2. If it says "NWC Wallet" or has no custom name, click the trash/delete icon
3. This won't delete your transactions - just the connection

### Step 3: Re-add Wallets with Proper Names

1. In the **Alby Hub** tab, find the "Add Another Wallet" section
2. **Wallet Name field**: Enter the wallet name (e.g., "Alby Hub", "Mutiny", "Zeus") **- NOW REQUIRED**
3. **NWC Connection URI field**: Paste your wallet's NWC connection string
4. Click **Connect**

**Important**: The wallet name field is now **required** to prevent this issue in the future!

### Step 4: Re-sync Transactions

1. Once connected with the proper wallet name, click the **sync button** (🔄) next to each wallet
2. This will import NEW transactions with the wallet name properly set
3. For OLD transactions that were imported without names, you have two options:

#### Option A: Delete Old Transactions and Re-sync (Recommended)
1. Delete all transactions from your budget (if you can - or note them)
2. Re-sync - they'll import with proper wallet names
3. If you had categorized them, you'll need to re-categorize

#### Option B: Manual Update (Tedious but Preserves Data)
1. Click each old transaction to edit it
2. Manually update the wallet source if visible
3. (This is tedious with many transactions)

## 📋 Expected Result

After re-syncing, you should see:

```
Before (Issue):
☕ Coffee
🟦 Lightning | -5,000 sats

After (Fixed):
☕ Coffee
🟦 Alby Hub | -5,000 sats
```

## 🎯 Why This Happened

The wallet name field was originally marked "optional" to not burden users. But without it, we couldn't tell which wallet each transaction came from when you have 3+ wallets. 

**The fix**: Made it required so every transaction properly captures its source wallet.

## 🚀 Going Forward

1. **Always enter a wallet name** when connecting a wallet
2. **Use clear, unique names** like:
   - "Alby Hub (Main)" 
   - "Mutiny (Mobile)"
   - "Zeus (Self-Hosted)"
3. **Re-sync often** to keep transactions up to date
4. Transactions will **always** show the wallet name

## 💡 Pro Tips

### Naming Convention for Multiple Wallets
```
Wallet 1: "Alby Hub (Main Account)"
Wallet 2: "Mutiny (Mobile)"
Wallet 3: "Zeus (Self-Hosted)"

→ This makes it crystal clear which wallet each payment came from
```

### Best Practice
1. Name wallets **before** the first sync
2. Keep names **short but descriptive**
3. Use **consistent naming** across devices
4. **Avoid**: "Wallet 1", "test", "NWC"

## 🆘 Troubleshooting

### Q: I deleted a wallet connection - will it delete my transactions?
**A**: No! Deleting a connection just removes it from the wallet list. Your transactions stay in the budget with their payment hashes intact.

### Q: Can I edit a wallet's name?
**A**: Yes! Delete the old connection and re-add it with the new name.

### Q: Will old transactions ever show the wallet name?
**A**: Only if they were imported AFTER the wallet had a proper name set. Transactions imported before won't be retroactively updated, but newly synced transactions will have the correct name.

### Q: Why didn't I have to enter a wallet name before?
**A**: It was optional. But that caused confusion with 3+ wallets. Now it's required to prevent this issue.

## 📊 Summary

| Issue | Cause | Solution |
|-------|-------|----------|
| Seeing "Lightning" instead of wallet name | Wallets connected without custom names | Re-add wallets with proper names |
| Old transactions don't show wallet name | Imported before names were set | Delete and re-sync with proper names |
| Wallet name field now required | Prevents future confusion | Just enter a wallet name when connecting |

## ✨ After You Fix It

Once you've re-synced:
- ✅ Each transaction shows the correct wallet name
- ✅ Easy to identify which wallet made each payment
- ✅ Perfect for managing 3+ wallets
- ✅ No more confusion about transaction sources

---

**Need help?** The wallet name field now has clear instructions to guide you through the process!
