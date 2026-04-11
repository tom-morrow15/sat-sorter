# Auto-Save Feature Guide

## Overview

Sat Sorter now features **automatic cloud backup to Nostr** for logged-in users. Your budget is automatically saved every 2 seconds as you make changes, protecting your data from loss.

## How It Works

### For Logged-In Users (With Nostr)

**Automatic:**
- ✅ Every edit to your budget is auto-saved to Nostr
- ✅ 2-second debounce (batches rapid changes)
- ✅ Silent operation (no interruptions)
- ✅ Runs in background without slowing you down
- ✅ Encrypted with NIP-44 (only you can read)
- ✅ Survives browser crashes and device loss

**Manual:**
- Still available - "Save to Nostr" FAB in bottom right
- Shows sync status and provides direct control
- Useful for explicit save points

### For Guests (No Nostr Login)

**Local Storage:**
- ✅ Budget saved in browser IndexedDB
- ⚠️ Only works on this device
- ⚠️ Lost if browser cache is cleared
- ⚠️ No cross-device access
- ⚠️ No backup if device is lost

**Recommended:**
- Log in with Nostr for cloud backup
- Export to JSON monthly for archival backup

## User Experience

### What You'll See

**While Editing:**
- No visual indicators (clean, distraction-free)
- Budget updates instantly
- Auto-save happens silently in background

**Save Button (FAB):**
- **Blue cloud icon** = Ready (or auto-saved)
- **Spinning icon** = Manual save in progress
- **Green checkmark** = Successfully saved!
- **Red X** = Save failed (click to retry)

**Backup & Sync Dialog:**
- Shows "Auto-saving enabled" when active
- Displays last sync timestamp
- "Upload to Cloud" and "Download" still available for manual control

### Timeline Example

```
14:00:00  Log in with Nostr
          → Auto-save activates
          → Button turns green briefly

14:00:15  You add $500 line item
          → Auto-save triggered (2 sec debounce)
          → No visible change yet

14:00:17  Auto-save completes
          → Button shows checkmark
          → Changes synced to Nostr

14:00:18  You edit category name
          → Auto-save timer resets

14:00:20  Auto-save completes again
          → Status updated

14:00:45  You close browser tab
          → Pending changes auto-saved
          → Data preserved
```

## Data Flow

### Auto-Save Process

```
1. User makes change (edit line item, add transaction, etc.)
                  ↓
2. Change saved to local browser storage
                  ↓
3. Auto-save timer triggered (2-second debounce)
                  ↓
4. After 2 seconds with no new changes:
                  ↓
5. Budget state serialized to JSON
                  ↓
6. Encrypted with NIP-44 to your pubkey
                  ↓
7. Published to Nostr relays
                  ↓
8. Event stored on multiple relays
                  ↓
9. Timestamp updated silently
                  ↓
10. Next browser/device can retrieve it
```

### Recovery Process

**When logging in on new device:**
```
1. User logs in with Nostr
2. Auto-save loads latest backup from Nostr
3. Timestamps compared:
   - Remote newer? → Show merge dialog
   - Local newer? → Auto-sync to cloud
   - Same? → Use local copy
4. User resumes with full budget
```

## Safety Features

### Automatic Backups

- **Frequency:** Every 2 seconds (debounced)
- **Timeout:** 5-minute safety interval
- **On Exit:** Saves any pending changes when closing tab
- **Encryption:** NIP-44 (end-to-end)
- **Storage:** Multiple Nostr relays (redundancy)

### Conflict Resolution

When opening budget on multiple devices:
```
Device A synced 10:00 AM
Device B synced 9:55 AM

Resolution:
→ Compare timestamps
→ Use newer version (10:00 AM from A)
→ Older version discarded
```

### Data Protection

- ✅ Private key never leaves your browser/signer
- ✅ Only you can decrypt your budget
- ✅ Relays can't read content (encrypted)
- ✅ No central server stores plaintext
- ✅ Survives relay outages (backed up across many relays)

## Common Questions

### Q: What if I'm not logged in?

**A:** Budget saves locally in IndexedDB only. To enable cloud backup:
1. Click "Log in with Nostr" in alert banner
2. Authorize with your Nostr signer
3. Auto-save activates automatically

### Q: How do I know if auto-save is working?

**A:** Check the Backup & Sync menu:
```
Menu → Backup & Sync
↓
Look for: "✓ Auto-saving enabled"
```

The "Save to Nostr" button will also briefly show a green checkmark after saves.

### Q: Can I turn off auto-save?

**A:** Not currently, but you can:
- Control manual saves with the FAB button
- Use the "Upload to Cloud" button in Backup & Sync
- Still have local storage as fallback

### Q: What if I have different data on different devices?

**A:** Auto-save uses timestamps to pick the newest version:
```
Device 1: Last saved 10:00 AM
Device 2: Last saved 10:15 AM
Result:   Device 2 version is used (newer)
```

If you want to keep Device 1's data, save it before Device 2 syncs.

### Q: Is my data really encrypted?

**A:** Yes! NIP-44 encryption uses:
- Your Nostr private key
- Conversation key derivation
- Secure encryption standard (XChaCha20-Poly1305)
- Only your private key can decrypt

**Even we can't see your budget** if it was on a server (which it's not).

### Q: What if Nostr relays go down?

**A:** Your local copy is always there:
- Browser IndexedDB has full backup
- Multiple relays store encrypted copies
- One relay outage doesn't affect you
- Data syncs when any relay comes back online

### Q: How much data can I store?

**A:** Typically:
- Up to 5-10 years of budgets on Nostr
- Each month's budget = ~10-50KB encrypted
- Relays usually allow up to 1MB per event
- No practical limit for personal use

### Q: Can someone read my encrypted budget?

**A:** No, because:
- Only your private key can decrypt
- You keep private key in your signer
- Signer never sends plaintext to relays
- Relays only see encrypted content
- Even signer operators can't read it (key stays on device)

### Q: What happens if I lose my private key?

**A:** Budget is lost too, because:
- Data encrypted to your key
- Without key, data unreadable
- **Solution: Back up your mnemonic/key securely**
- **Solution: Export JSON backup monthly**

### Q: Can I share my budget with someone?

**A:** This feature is coming soon! For now:
- Share via export/import JSON files
- Send files via secure channel (Signal, etc)
- Partner receives copy (not linked)

**Coming:** Budget partners feature with shared editing

## Best Practices

### Daily

1. **Review daily spending** - Auto-save keeps it safe
2. **Add transactions promptly** - Gets saved automatically
3. **Trust auto-save** - Don't stress about saving

### Weekly

1. **Export JSON backup** - Settings > Storage > Export
2. **Store in safe location** - Cloud storage or USB
3. **Verify restore works** - Test import occasionally

### Monthly

1. **Review budget changes** - Check Backup & Sync for sync times
2. **Update next month** - Duplicate from current month
3. **Backup before major changes** - Export JSON first

### Before Travel

1. **Verify cloud backup exists** - Check timestamp in Backup & Sync
2. **Export JSON copy** - Carry on phone/tablet
3. **Test on other device** - Ensure cross-device access works

## Troubleshooting

### "Auto-save not working"

**Check:**
1. Are you logged in? (Look for account switcher in header)
2. Is signer NIP-44 compatible? (Check if encryption works)
3. Do you have internet connection?
4. Check console for errors: F12 → Console tab

**Fix:**
1. Log out and log back in
2. Try different Nostr signer/app
3. Refresh page
4. Export data and restart browser

### "Data out of sync on different devices"

**This is normal!** Each device has its own local copy. They sync when:
1. You manually click "Upload to Cloud"
2. Auto-save completes (2 seconds after changes)
3. You download on another device

**To fix:**
1. Go to Backup & Sync menu
2. Click "Upload to Cloud" on Device A
3. Go to Device B
4. Click "Download" in Backup & Sync menu

### "Lost budget data"

**Check these in order:**
1. Other browser tabs (might have older copy)
2. Backup & Sync → "Download" from Nostr
3. Downloaded JSON backups on disk
4. Ask partners if they have shared copy

### "Sync taking too long"

**Normal causes:**
- Network latency
- Relay connection issues
- Large budget file (many transactions)

**Should take < 5 seconds normally**

**If stuck > 1 minute:**
1. Refresh page
2. Check internet
3. Try different relay set
4. Check signer app status

## Security Checklist

Before trusting auto-save with important data:

- [ ] I've logged in successfully with my Nostr signer
- [ ] I see "✓ Auto-saving enabled" in Backup & Sync
- [ ] I've tested downloading data on another device
- [ ] I've exported at least one JSON backup
- [ ] I understand encryption is to my private key
- [ ] I've backed up my Nostr keys/mnemonic securely
- [ ] I've tested budget restore from export

## Advanced Configuration

### Manual Relay Management

Coming soon - ability to choose specific relays for backup

### Backup Frequency

Currently: 2-second debounce (can't be changed)

Future options:
- 1-second (for power users)
- 5-second (for bandwidth-limited users)
- Manual only (for privacy-conscious users)

### Encryption Methods

Currently: NIP-44 to self

Future options:
- Shared encryption for budget partners
- Multi-device key coordination
- Backup key options

## Next Steps

1. **Log in with Nostr** if you haven't already
2. **Make a budget change** and watch auto-save work
3. **Export a JSON backup** for safety
4. **Test on another device** to verify sync works
5. **Review Backup & Sync menu** to understand status

You're now protected from data loss! 🎉

---

**Questions?** Check the Backup & Sync dialog in the app for status info.

**Last Updated:** April 2026
