# Budget Sync & Conflict Resolution Strategy

## Overview

Sat Sorter uses a **smart two-way sync system** that automatically keeps your budget in sync across devices via Nostr while preventing data loss or conflicts.

## How It Works

### Data Storage Locations

1. **Local Storage (Browser)** - Primary storage, updated in real-time
2. **Nostr (kind 30078)** - Cloud backup, encrypted with your keys
3. **Both persist independently** until a conflict is detected

### Sync Flow

```
User makes change → Save locally (immediate)
                 ↓
            5-second debounce
                 ↓
         Upload to Nostr (async)
                 ↓
       Next login → Download from Nostr (if newer)
```

## Conflict Resolution Strategy

When you log in, Sat Sorter checks for conflicts between local and Nostr data using a **timestamp-based priority system**.

### The 5-Minute Conflict Window

The system uses a **300-second (5-minute) threshold** to determine if data was edited concurrently:

- **Remote significantly newer** (>5 min): Use Nostr data
- **Local significantly newer** (>5 min): Keep local data
- **Within 5-minute window**: Intelligent comparison (see below)

### Four Resolution Cases

#### Case 1: Remote is Significantly Newer (>5 minutes)
```
Local edit:    10:00 AM
Remote edit:   10:10 AM
Difference:    10 minutes (>5 minute threshold)

Decision: ✅ Use Nostr data
Reason:   Remote is clearly newer, safe to download
```

**Action**: Download from Nostr and replace local data
**Why**: If you haven't edited locally in 5+ minutes and Nostr has newer data, it came from another device or session

#### Case 2: Local is Significantly Newer (>5 minutes)
```
Remote edit:   10:00 AM
Local edit:    10:10 AM
Difference:    10 minutes (>5 minute threshold)

Decision: ✅ Keep local data
Reason:   Local is clearly newer, it will auto-upload
```

**Action**: Keep local data unchanged, will auto-upload to Nostr
**Why**: You edited locally after the Nostr version, so local is authoritative

#### Case 3: Within Conflict Window - Data Comparison
```
Remote edit:   10:00 AM
Local edit:    10:02 AM
Difference:    2 minutes (<5 minute threshold)

Decision: Compare data completeness
```

When edits are within 5 minutes of each other, the system compares data **completeness**:

- **Count total items** (budgets, buckets, line items, transactions)
- **Use version with more data** (assumed to be more complete)
- **Show user notification** indicating which version was chosen

**Examples**:
- Remote has 100 transactions, Local has 50 → Use remote
- Remote has 3 budgets, Local has 3 budgets → Keep local
- Remote has 2 months of budgets, Local has 1 → Use remote

#### Case 4: Identical Timestamps
```
Remote timestamp: 1704067200
Local timestamp:  1704067200

Decision: ✅ Data already in sync
```

**Action**: No changes needed
**Why**: Both versions are already synchronized

## Preventing Data Loss

### Protected Scenarios

✅ **Scenario 1: Editing on two devices without overlap**
```
Device A: Edit at 10:00 AM, auto-upload at 10:05 AM
Device B: Login at 10:10 AM
Result:   Device B downloads from Nostr (10+ min newer)
          Device A and B now in sync ✓
```

✅ **Scenario 2: Editing on Device A while Device B is offline**
```
Device A: Edit at 10:00 AM, auto-upload at 10:05 AM
Device B: Offline
Device B: Comes online at 10:30 AM
Result:   Device B downloads from Nostr (25+ min newer)
          Device B now has all changes from Device A ✓
```

✅ **Scenario 3: Quick edits on different devices within 5 minutes**
```
Device A: Edit and save at 10:00 AM
Device B: Edit and save at 10:02 AM
Device B: Login to Nostr while Device A still editing
Result:   Device B has 120 items, Device A has 80 items
          System uses Device B (more complete) ✓
```

✅ **Scenario 4: Copying budget from previous month**
```
Before: Month A has 5 categories
Action: Copy to Month B
Result: Month B gets 5 categories + protection against duplicates ✓
```

### Risky Scenarios (Mitigated)

⚠️ **Scenario: True simultaneous editing**
```
Device A: Edit at 10:00 AM (not yet saved to Nostr)
Device B: Edit at 10:00 AM (not yet saved to Nostr)
Device A: Goes offline
Device B: Saves to Nostr at 10:05 AM
Device A: Comes online at 10:10 AM
Result:   Device A downloads from Device B (5+ min newer)
          Device A's unsaved changes are lost ✗
Mitigation: This is rare (both devices editing simultaneously)
            Local save every 500ms indicates progress to user
            Toast shows "Synced to cloud" when safe
```

## Timestamps Explained

### lastSynced Field

Every `BudgetState` stores when it was last synced to Nostr:

```typescript
interface BudgetState {
  currentMonth: string;
  budgets: MonthlyBudget[];
  currency: 'sats' | 'usd';
  lastSynced?: number;  // Unix timestamp when last uploaded to Nostr
}
```

### How Timestamps Are Used

1. **On Every Edit**: Local timestamp updates (indirectly via budget IDs)
2. **On Every Upload**: `lastSynced` is set to current time
3. **On Download**: Compare `remoteTimestamp` vs `localTimestamp`
4. **On Conflict**: Use threshold comparison to decide

## User Feedback

The app shows different save states:

### Save Status Indicators (in header)

```
🔄 Saving...          → Edit detected, uploading to Nostr (5s debounce)
✓ Saved locally       → Saved to browser, waiting to upload
✓ Synced to cloud     → Fully synced with Nostr
⚠️ Save failed        → Upload failed, will retry
```

### Toast Notifications

```
✅ "Budget synced from cloud" 
   → Downloaded newer data from Nostr

✅ "Using local budget"
   → Kept local data (it was newer)

✅ "Budget copied!"
   → Successfully copied from previous month

✅ "Cannot copy budget"
   → A budget already exists for this month

✅ "Cloud version had more complete data"
   → Conflict resolved in favor of Nostr version

✅ "Your version has more complete data"
   → Conflict resolved in favor of local version
```

## Technical Details

### Encryption

- All data uploaded to Nostr is encrypted with **NIP-44** (your private key)
- Only you can decrypt your budget data
- Server never sees unencrypted data

### Upload Strategy

- **Debounced**: 5 seconds after last change
- **Smart**: Only uploads if `hasSyncedBudget` flag is true (prevents uploading while downloading)
- **Automatic**: No manual sync button needed
- **One-way gate**: Doesn't re-download while uploading

### Duplicate Prevention

- `duplicateFromMonth` checks if target month already has data
- Returns error message instead of silently overwriting
- User must delete existing budget before copying

### Per-Session Sync

- `hasSyncedBudget` ref ensures download only happens once per login
- Prevents infinite sync loops
- Resets when user changes accounts

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

## Summary

| Scenario | Resolution | Data Loss? |
|----------|-----------|----------|
| Edit on Device A, sync before switching to Device B | Remote newer → download | ✅ No |
| Edit on Device A, immediately switch to Device B | Local newer → keep local | ✅ No |
| Edit on both devices within 5 min → Device B has more items | Use Device B version | ✅ No |
| Edit on both devices within 5 min → Similar data | Keep local + upload | ✅ No |
| Concurrent edits both unsaved | Local kept until user logs in again | ⚠️ Rare, mitigated |

The system prioritizes **data integrity** over perfect sync, ensuring your budget data is never silently lost or merged incorrectly.
