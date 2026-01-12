# Wallet Source Tracking - Quick Reference

## 🎯 What's New in One Sentence
**Every transaction now shows which Lightning wallet it came from, with full payment details.**

## 🚀 Quick Start (30 seconds)

1. **Connect wallet**: Settings → Wallets → Add NWC Connection
2. **Give it a name**: "Alby Hub", "Mutiny", etc.
3. **Sync automatically**: Transactions import with wallet source
4. **View source**: Transactions now show wallet badge
5. **Click for details**: See payment hash, preimage, exact timestamp

## 📍 Where to Find It

### In Transactions Panel
```
☕ Coffee Shop
🟦 Alby Hub  |  Dec 15  |  -5,000 sats
             ↑ New wallet badge!
```

Click to see:
- Amount in sats/USD
- Exact settlement time
- Payment Hash (copyable)
- Preimage (copyable)
- Budget category

### In Multiple Views
- **Unassigned transactions**: Shows wallet for import tracking
- **Assigned transactions**: Shows wallet with category
- **Search results**: Filters by wallet name
- **Cloud sync**: Preserves wallet names across devices

## 🎨 Visual Guide

### Transaction List (with wallet source)
```
┌─ UNCATEGORIZED ─────────────────────────┐
│ ☕ Coffee Shop                           │
│ 🟦 Alby Hub | Dec 15 | -5,000 sats    │
│                                         │
│ 🚕 Uber Ride                           │
│ 🟨 Mutiny | Dec 14 | -8,500 sats     │
└─────────────────────────────────────────┘

┌─ CATEGORIZED ───────────────────────────┐
│ 💰 Salary Income                        │
│ [Food] [🟦 Alby Hub] | Dec 1 | +500k  │
└─────────────────────────────────────────┘
```

### Details Dialog (on click)
```
┌─ Transaction Details ──────────────────┐
│                                         │
│  ☕ Coffee Shop                         │
│                                         │
│  Amount: 5,000 sats ($1.50)           │
│  Date: Dec 15, 2024 at 2:30 PM       │
│                                         │
│  Source: 🟦 Alby Hub                  │
│  (Lightning Wallet)                    │
│                                         │
│  Payment Hash:                         │
│  abc123def456... [Copy]               │
│                                         │
│  Preimage:                            │
│  xyz789uvw012... [Copy]               │
│                                         │
│  Category: Food → Restaurants         │
│  Status: ✅ Settled                    │
│                                         │
└─────────────────────────────────────────┘
```

## 🎯 Use Cases

### Verify a Payment
1. Click transaction
2. Copy Payment Hash
3. Share with recipient
4. They confirm receipt
5. ✅ Verified!

### Track Multiple Wallets
1. Connect Alby Hub (main account)
2. Connect Mutiny (mobile)
3. Transactions show which wallet
4. Filter to see each wallet's activity
5. Understand your cash flow

### Keep Payment Records
1. All transactions auto-saved
2. Payment hash prevents duplicates
3. Preimage proves settlement
4. Works offline, syncs when online
5. Cloud backup via Nostr (encrypted)

### Debug Issues
1. Transaction not showing?
   → Check wallet auto-sync enabled
   → Manual sync from Transactions panel

2. Preimage missing?
   → Your wallet doesn't provide it
   → Payment Hash still available

3. Wrong wallet shown?
   → Check which wallet was synced last
   → Verify sync timestamps

## 🏷️ Wallet Badge Colors

| Source | Color | Icon | Example |
|--------|-------|------|---------|
| NWC | 🟦 Blue | Wallet | Alby Hub, Mutiny, Zeus |
| Zap | 🟨 Yellow | Zap | Zap payments |
| Strike | 🟥 Red | Link | Strike API import |
| Manual | ⬜ Gray | Plus | Hand-entered |

## 📱 Quick Tips

### Multi-Wallet Setup
```
Device 1: Alby Hub (main), Mutiny (mobile)
Device 2: Same wallets, auto-restored via cloud sync
→ All wallets available on both devices
```

### Best Wallet Names
- ✅ "Alby Hub (Main)"
- ✅ "Mutiny (Mobile)"
- ✅ "Zeus (Self-Hosted)"
- ❌ "Wallet 1" (not helpful)

### Weekly Routine
1. Review new transactions
2. Verify amounts and wallets
3. Categorize unassigned
4. Check cloud sync status
5. Export if needed

## 🔒 Privacy Promises

| Data | Location | Encrypted |
|------|----------|-----------|
| Wallet names | Your device | Yes (if cloud sync) |
| Payment hashes | Your device | Yes (if cloud sync) |
| Preimages | Your device only | N/A (local) |
| Connection strings | Your device only | Not uploaded |
| Private keys | Your device only | Not touched |

**Bottom line**: Everything private, everything yours, nothing on servers.

## 🐛 Troubleshooting in 30 Seconds

**Q: Wallet not showing?**
A: Check if transaction source is "nwc". Manual/CSV imports won't show.

**Q: Preimage missing?**
A: Normal - wallet may not provide it. Payment Hash is enough.

**Q: Multiple wallets confused?**
A: Click to see full details. Payment hashes are unique identifiers.

**Q: Cloud sync lost wallet names?**
A: Log back in. Wallets auto-restore from Nostr (encrypted).

## 📚 Full Docs

| Document | For | Length |
|----------|-----|--------|
| WALLET_SOURCE_TRACKING_GUIDE.md | Users | Quick read |
| docs/WALLET_TRANSACTION_TRACKING.md | Users | Complete reference |
| docs/WALLET_SOURCE_IMPLEMENTATION.md | Developers | Technical details |

## ✅ Works With

- ✅ Alby Hub (recommended)
- ✅ Mutiny Wallet
- ✅ Zeus
- ✅ Any NWC-compatible wallet
- ✅ Multiple wallets simultaneously
- ✅ Cloud sync (Nostr relays)
- ✅ CSV import (manual source)
- ✅ Mobile & desktop browsers

## 🎁 What You Get

| Feature | Benefit |
|---------|---------|
| Wallet tracking | Know which wallet made each payment |
| Payment hash | Verify payments independently |
| Preimage | Prove you made the payment |
| Timestamps | Exact settlement time |
| Multi-wallet | Manage separate wallets |
| Cloud sync | Access from any device |
| Privacy | All data stays with you |

## 🚀 Ready to Use?

1. Open Sat Sorter
2. Go to Import → Add NWC Connection
3. Paste your wallet connection string
4. Give it a name
5. Enable Auto-Sync
6. Refresh transactions
7. Click any transaction to see details

**That's it! You're now tracking wallet sources.** 🎉

---

For more details, see the comprehensive guides in this project.
