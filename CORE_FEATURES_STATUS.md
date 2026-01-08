# Sat Sorter - Core Features Status

## The Three Pillars You Identified

You correctly identified three critical features for a production-ready budgeting app:

1. **NWC Transaction Auto-Import** - Automatic transaction tracking
2. **BTCMap Auto-Refresh** - Instant location updates  
3. **Nostr Relay Sync** - Cross-device sync with user control

---

## 1. NWC Transaction Auto-Import 🟡 READY FOR TESTING

### Current Implementation
The NWC sync is already well-implemented in `useNWCSync.ts`:

**Features:**
- ✅ Connect any NWC-compatible wallet (Alby, Zeus, Primal, etc.)
- ✅ Auto-sync transactions every 5 minutes (when enabled)
- ✅ Manual sync button
- ✅ Duplicate detection (won't import same transaction twice)
- ✅ Converts millisats to sats
- ✅ Tracks income vs expense
- ✅ Stores payment hash for deduplication

**How It Works:**
```
User connects wallet via NWC
    ↓
App polls wallet every 5 minutes (if auto-sync enabled)
    ↓
Fetches transactions since last sync
    ↓
Filters out duplicates
    ↓
Imports into budget as unassigned transactions
    ↓
User categorizes transactions
```

**User Flow:**
1. Click hamburger menu → Connect Wallet (or wallet icon)
2. Click "Lightning Wallet (NWC)"
3. Paste NWC connection string from wallet
4. Enable "Auto-sync" toggle
5. Transactions automatically appear!

**Limitations:**
- ⚠️ Depends on wallet supporting `list_transactions` method
- ⚠️ Some wallets (older ones) may not support this
- ⚠️ Alby, Zeus, and most modern wallets DO support it

### Testing Checklist
- [ ] Connect Alby wallet via NWC
- [ ] Enable auto-sync
- [ ] Make a Lightning payment
- [ ] Wait up to 5 minutes (or click "Sync Now")
- [ ] Transaction should appear in unassigned list
- [ ] Assign to budget category

---

## 2. BTCMap Auto-Refresh 🟢 SHOULD BE FIXED

### The Problem
When user set location, merchants didn't appear until page refresh.

### Root Cause Found
The `useLocalStorage` hook wasn't reactive across different hook instances:
- `LocationSetup` updates location via `useLocalStorage`
- `useBTCMap` reads location via `useLocalStorage`
- Same key, but different hook instances = not reactive!

### The Fix Applied
Added custom event system to `useLocalStorage`:
```typescript
// When setValue is called:
window.dispatchEvent(
  new CustomEvent('local-storage-change', {
    detail: { key, value: serialized },
  })
);

// All hook instances listen for this event:
window.addEventListener('local-storage-change', handleLocalChange);
```

Now when location is updated, ALL instances of `useLocalStorage` with the same key get notified and re-render.

### Testing Checklist
- [ ] Open app fresh
- [ ] Click "Set Location"
- [ ] Enter city and country
- [ ] Click "Search"
- [ ] Dialog closes
- [ ] **Merchants should appear immediately!**
- [ ] No refresh button needed
- [ ] No page reload needed

### If Still Not Working
Let me know and I'll add more debugging. The fix should work but may need adjustment based on React's render cycle.

---

## 3. Nostr Relay Sync 🟢 COMPLETELY REWORKED

### What Changed

**Before:**
- "Cloud sync" terminology (vague, untrustworthy)
- No visibility into which relays
- No way to add/remove relays
- Hidden implementation

**After:**
- "Nostr Relay Sync" terminology (clear, technical)
- Shows exactly which relays data syncs to
- Add, remove, toggle relays
- Clear explanation of encryption
- User has full control

### New UI Features

**Sync Status:**
- Shows last sync time
- "Push to Relays" button
- "Pull from Relays" button
- Visual status (syncing, synced, error)

**Relay Management:**
- Collapsible section showing all relays
- Each relay shows: URL, write status
- Toggle write on/off for each relay
- Add new relays
- Remove relays (minimum 1)
- Summary: "📡 Budget syncing to 3 relays: damus, nostr.band, ditto"

**Encryption Explanation:**
- Clear message: "Your budget is encrypted with your Nostr keys and stored on relays you choose. Only you can decrypt it."
- No "cloud" terminology
- Users understand exactly what happens

### How It Works (Technical)

```
User makes budget change
    ↓
Budget encrypted with NIP-44 (to self)
    ↓
Published as NIP-78 event (kind 30078)
    ↓
Sent to all relays with write=true
    ↓
Header shows "Syncing to relays..."
    ↓
On new device: query relays for budget
    ↓
Decrypt with user's Nostr key
    ↓
Budget restored!
```

### Testing Checklist

**Basic Sync:**
- [ ] Login with Nostr account
- [ ] Create some budget entries
- [ ] Click Menu → Nostr Relay Sync
- [ ] Click "Push to Relays"
- [ ] Should show success

**Cross-Device:**
- [ ] Device A: Login with Nostr, create budget
- [ ] Device A: Push to relays
- [ ] Device B: Login with SAME Nostr account
- [ ] Device B: Open Nostr Relay Sync
- [ ] Device B: Click "Pull from Relays"
- [ ] Budget should appear!

**Relay Management:**
- [ ] Open Nostr Relay Sync
- [ ] Click "Your Relays" to expand
- [ ] See list of relays with write status
- [ ] Toggle write on/off for a relay
- [ ] Add a new relay (e.g., wss://nos.lol)
- [ ] Remove a relay

---

## Known Issues to Monitor

### NWC Sync
- **Issue**: Some wallets don't support `list_transactions`
- **Solution**: Error message tells user to try different wallet
- **Workaround**: Manual transaction entry still works

### BTCMap Auto-Refresh
- **Issue**: May still need testing on actual devices
- **Solution**: The localStorage fix should work
- **Fallback**: Refresh button still exists if needed

### Nostr Relay Sync
- **Issue**: Conflict resolution not implemented
- **Impact**: If user edits on 2 devices simultaneously, last write wins
- **Solution**: For now, edit on one device at a time
- **Future**: Add conflict detection dialog

---

## What Still Needs Work

### Must Test
1. **BTCMap auto-refresh** - Does the localStorage fix work?
2. **Cross-device sync** - Does it actually sync between devices?
3. **NWC transaction import** - Does it work with your wallet?

### Nice to Have (Future)
1. **Conflict resolution** - What if 2 devices edit simultaneously?
2. **Sync history** - Show log of sync events
3. **Offline queue** - Queue changes made without internet
4. **Real-time sync** - Instant sync instead of manual push/pull

---

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| NWC Transaction Import | 🟡 Ready | Test with real wallet |
| BTCMap Auto-Refresh | 🟢 Fixed | Test location setting flow |
| Nostr Relay Sync | 🟢 Reworked | Full relay management UI |

---

## Next Steps

1. **Test all three features** on real devices
2. **Report any issues** with specific steps to reproduce
3. **Verify NWC works** with your preferred wallet
4. **Confirm relay sync** works across devices

Once these three features are verified working, you have a solid production-ready budgeting app!

---

## Commit Reference

All changes in commit: `e56da1a`

**Files changed:**
- `src/hooks/useLocalStorage.ts` - Reactive across instances
- `src/components/budget/BackupRestoreDialog.tsx` - Complete rework
- `src/components/budget/BudgetHeader.tsx` - Updated terminology
