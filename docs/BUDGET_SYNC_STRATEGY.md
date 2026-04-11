# Budget Sync Strategy - Explicit Save Approach

## Overview

Sat Sorter uses a **simple, user-controlled sync system** that keeps your budget safe locally and lets you explicitly back it up to Nostr when you're ready.

**Key principle**: You control when your data goes to the cloud. No magic, no auto-sync, no conflicts.

## How It Works

### Data Storage Locations

1. **Local Storage (Browser)** - Primary storage, saved instantly with every change
2. **Nostr (kind 30078)** - Cloud backup (encrypted with your keys), saved only when you click the save button

### Sync Flow

```
User makes changes
    ↓
Saved to browser instantly ✓
(Shows "Changes saved locally")
    ↓
User clicks "💾 Save to Nostr" button (when ready)
    ↓
Shows "Uploading..." spinner
    ↓
"✅ Saved to Nostr!" toast
    ↓
Next login on another device
    ↓
Automatically downloads from Nostr (one-time)
    ↓
Continues editing on new device
```

## No Conflicts - Here's Why

Since you explicitly control when data goes to Nostr, there are NO conflicts to resolve:

- **Device A**: Edit locally, click Save → Upload to Nostr ✓
- **Device B**: Login → Download from Nostr (sees Device A's saved data) ✓
- **Continue editing**: On Device B, data is local until you Save ✓

This is exactly like traditional save buttons in apps like Word, Excel, Google Docs, etc.

## User Experience

### On Login (One-Time Download)

When you log in to a new device or browser:

1. App checks Nostr for your saved budget
2. If found, shows toast: **"Budget restored from cloud"**
3. Your budget automatically loads
4. **Important**: This happens once per login session - no continuous checking

### When You Make Changes

As you edit your budget:

```
Edit → Changes saved locally (browser storage)
      → Your data is always safe locally
      → Takes effect immediately
      → Ready to save to Nostr whenever you want
```

### When You Click "Save to Nostr" (The Floppy Disk Button)

```
Button status: "💾 Save to Nostr"
    ↓ [You click]
Button shows: "⏳ Saving..." (spinner)
    ↓ (uploading to Nostr...)
Button shows: "✅ Saved!" (green, 2 seconds)
    ↓
Toast: "✅ Saved to Nostr! 3 month(s) backed up to the cloud."
    ↓
Button returns to: "💾 Save to Nostr"
```

If upload fails:

```
Button shows: "⚠️ Failed" (red, 3 seconds)
    ↓
Toast: "Save error - Could not upload to Nostr. Check connection and try again."
    ↓
You can click again to retry
```

## No Data Loss - Guaranteed

Because you explicitly save to Nostr, there's no way to accidentally lose data:

### Scenario 1: Normal Multi-Device Usage
```
Device A:
- Edit budget (stays local)
- Click "Save to Nostr" → uploads ✓

Device B:
- Log in → automatically downloads from Device A ✓
- Edit budget (stays local)
- Click "Save to Nostr" → uploads ✓

Device A:
- Log in (next session) → sees Device B's latest ✓
```

### Scenario 2: You Close the App Without Saving
```
Device A:
- Edit budget locally
- Close app WITHOUT clicking save
- Tomorrow: Log back in
→ Your edits are still there (local storage persists)
→ Click save to back them up whenever ready
```

**Key**: Your edits are never lost because they're always in browser storage. Saving to Nostr is optional.

### Scenario 3: Copying Budget From Previous Month
```
- Current setup: April has 10 categories
- Action: Copy from April to May
- Result: May gets 10 categories
- Protection: Can't accidentally overwrite May (would show error)
```

### Scenario 4: Internet Goes Out
```
Device A:
- Editing budget offline
- All changes save to browser ✓
- No "Unsaved changes!" stress
- When internet returns, click Save to back up
```

## Save Button Location

The **"💾 Save to Nostr"** button is a floating action button (FAB) in the bottom right corner:

- **Position**: Fixed at bottom right (above the Quick Add transaction button)
- **Visible**: Only when logged in with Nostr
- **Icon**: Floppy disk 💾 (classic save symbol)
- **Size**: Large circle, easy to tap on mobile

### When the Button Appears

```
Not logged in → Button hidden (you can still edit locally)
    ↓
Log in with Nostr → Button appears (you can now save to cloud)
    ↓
Click button → Shows save progress
    ↓
After save → Button returns to normal state
```

## User Feedback

### Save Button States

The button shows clear feedback about what's happening:

```
Idle:      💾 Save to Nostr     (blue, clickable)
Saving:    ⏳ (spinner)          (blue, disabled)
Success:   ✅ (checkmark)        (green, 2 seconds)
Error:     ⚠️ (alert icon)       (red, 3 seconds)
```

### Toast Notifications

When you interact with the save button:

```
✅ "Saved to Nostr!"
   → Upload successful, all changes backed up
   → Shows: "3 month(s) backed up to the cloud."

❌ "Save error"
   → Upload failed
   → Shows: "Could not upload to Nostr. Check connection and try again."
   → Button remains clickable to retry

✅ "Budget restored from cloud"
   → On login, if budget found on Nostr
   → Shows: "Loaded X month(s) of budget data."

✅ "Log in required"
   → You tried to save but aren't logged in with Nostr
   → Shows: "You need to be logged in with Nostr to save to the cloud."
```

## Technical Details

### Encryption

- All data uploaded to Nostr is encrypted with **NIP-44** (your private key)
- Only you can decrypt your budget data
- Nostr relays never see unencrypted data
- Everyone sees the same encrypted blob, but only you can read it

### Download Strategy (On Login)

- **One-time per session**: Checks for saved budget when you log in
- **Automatic**: No button needed, happens in background
- **Skipped if not found**: If you have no saved budget on Nostr, app just uses local data
- **Preserves month**: Keeps your current month preference locally

### Upload Strategy (When You Click Save)

- **Explicit**: Only happens when you click "Save to Nostr"
- **Immediate**: No debounce delay - uploads as fast as your connection allows
- **Encrypted**: Data is encrypted before sending to Nostr
- **Immutable**: Once saved, creates an immutable event on relays
- **Replaceable**: Next save replaces the previous one (NIP-78 replaceable events)

### Duplicate Prevention

- `duplicateFromMonth` checks if target month already has data
- Returns error message instead of silently overwriting
- User must delete existing budget before copying over it

### Data Structure

```typescript
interface BudgetState {
  currentMonth: string;           // Current month being viewed
  budgets: MonthlyBudget[];       // Array of all monthly budgets
  currency: 'sats' | 'usd';       // Display preference
  lastSynced?: number;            // Unix timestamp (informational only)
}
```

## Best Practices

### To Avoid Data Loss

1. **Check the save indicator** before closing the app
2. **Wait for "Synced to cloud"** on important edits
3. **Log in to sync** across devices (auto-upload happens in background)
4. **Export backups** before major changes (Backup & Sync button)

### Multi-Device Usage

1. Edit on Device A
2. Wait for "Synced to cloud" indicator
3. Switch to Device B
4. Log in (auto-downloads from Nostr)
5. Continue editing

### If Something Goes Wrong

1. **Export your data** (Backup & Sync → Export File)
2. **Contact support** with the JSON file
3. **Use manual import** to restore from backup

## Implementation Details

### Conflict Detection Logic

```typescript
// Check timestamps
const timeDiff = Math.abs(remoteTimestamp - localTimestamp);

// Case 1: Remote is significantly newer
if (remoteTimestamp > localTimestamp + 300) {
  useRemote();  // Download from Nostr
}

// Case 2: Local is significantly newer  
else if (localTimestamp > remoteTimestamp + 300) {
  keepLocal(); // Keep local data
}

// Case 3: Within conflict window
else if (timeDiff < 300) {
  // Compare data completeness
  const localItems = countBudgetItems(local);
  const remoteItems = countBudgetItems(remote);
  
  if (Math.abs(localItems - remoteItems) > 5) {
    // Use version with more items
    useVersion(localItems > remoteItems ? local : remote);
  } else {
    // Items are similar, keep local
    keepLocal();
  }
}
```

### Auto-Upload Debounce

```typescript
// Wait 5 seconds after last change before uploading
const uploadTimeout = setTimeout(async () => {
  await upload(localBudget);
}, 5000);

// If another change happens, clear and restart timer
return () => clearTimeout(uploadTimeout);
```

## Best Practices

### To Keep Your Budget Safe

1. **Edit locally without worry** - Changes are saved to browser instantly
2. **Save to Nostr regularly** - Click the button when you're done making changes
3. **Wait for success** - Watch for the green checkmark and toast confirmation
4. **Test on another device** - Log in somewhere else to make sure your backup works

### Recommended Workflow

```
1. Use Device A
   - Edit budget (changes saved locally)
   - Click "Save to Nostr" (after making several changes)
   - See green checkmark + toast

2. Switch to Device B
   - Log in with Nostr
   - Budget automatically downloads
   - You see toast: "Budget restored from cloud"
   - Continue editing

3. Back to Device A (next day)
   - Log in
   - Budget downloads with Device B's latest changes
   - Everything is in sync
```

## Comparison: Old vs New

| Aspect | Auto-Sync (Old) | Explicit Save (New) |
|--------|-----------------|-------------------|
| **User Control** | Magic happens in background | You decide when to save |
| **Conflicts** | Complex logic to resolve | No conflicts - you're in control |
| **Data Loss Risk** | Could lose edits if app closed before sync | Edits always safe locally |
| **Clarity** | "Is it synced?" confusion | Crystal clear: "Not saved" or "Saved" |
| **Multi-Device** | Confusing merge logic | Simple: Save → Download on other device |
| **Mental Model** | Traditional auto-save | Traditional Ctrl+S / Save button |
| **Familiar To Users** | Not really - unusual | Yes! Like Excel, Word, Google Docs |

The new approach is **simpler, clearer, and more predictable**. Users know exactly what will happen when they click the button.
