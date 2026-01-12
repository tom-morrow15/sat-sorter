# Quick Start: NWC Cloud Sync

## 5-Minute Setup

### What You're Getting
Your Alby Hub (or other NWC wallet) connections now sync automatically across all your devices.

### Setup Steps

1. **Connect Wallet on Device 1**
   - Open satsorter.com
   - Log in with Nostr
   - Go to Settings → Wallet
   - Click "Connect Wallet"
   - Scan/paste your Alby Hub NWC URI
   - Done! ✓

2. **Sync to Device 2**
   - Open satsorter.com on different device/browser
   - Log in with SAME Nostr account
   - Wait 5-10 seconds
   - See: "Cloud sync: Restored 1 wallet connection"
   - Your wallet is ready! ✓

3. **Check It Works**
   - Settings → Wallet
   - Your wallet should be listed
   - Try syncing a transaction
   - Works without reconnecting ✓

## Behind the Scenes

```
Device 1                Nostr Relays          Device 2
────────              ──────────────          ────────
Connect wallet    →    encrypt + upload   →   download + decrypt
                       (NIP-44)               → auto-restore
```

## Key Features

- ✅ **Automatic**: No buttons to click
- ✅ **Encrypted**: Only you can decrypt
- ✅ **Instant**: Available within 10 seconds
- ✅ **Works Offline**: Local copy always available
- ✅ **Multi-wallet**: All wallets sync together
- ✅ **Secure**: No passwords, no servers

## Troubleshooting (30 Seconds)

| Problem | Solution |
|---------|----------|
| Wallet not on Device 2 | Make sure logged into SAME Nostr account |
| Still not there | Reload the page (forces fresh download) |
| Sync is slow | Check your relays in Settings |
| Connection shows "offline" | Normal! Validates on first use |

## That's It!

You're all set. Your wallet connections now follow you everywhere. 🚀

---

For more details, see:
- `NWC_CLOUD_SYNC_FIX.md` - Full explanation
- `TESTING_NWC_CLOUD_SYNC.md` - Detailed testing steps
- `NWC_CLOUD_SYNC_COMPLETE.md` - Technical details

Any questions? Check the browser console (Ctrl+Shift+J) for debug logs!
