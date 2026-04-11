# Bulletproof Nostr Save System Design

## Context: Why Previous Auto-Save Failed

Before implementing anything, we need to understand what went wrong:

1. **Silent Failures** - User didn't know save failed
2. **Conflict Resolution** - Multiple versions, user lost changes
3. **No Verification** - Changes published but never retrieved
4. **Race Conditions** - Simultaneous saves/loads corrupted data
5. **No Versioning** - Overwriting old data without recovery
6. **Silent Overwrites** - Newer device overwrote older changes
7. **Trust Issues** - Users couldn't verify data was safe

## The Primal Model (How It Actually Works)

Primal's approach for posts:
1. **Immutable Events** - Posts never change (kind 1 events)
2. **Append-Only** - New posts are added, old ones never deleted
3. **Deletion Events** - Delete requests are separate events (kind 5)
4. **Relay Query** - Get all events on login, reconstruct
5. **Simple Conflict** - If same content posted twice, just duplicate (user handles)

**Why this works for posts:**
- Posts are immutable by nature
- If you post same thing twice, it's just duplicate
- Users understand this model (like email)
- No complex merge logic needed

**Why this WON'T work for budgets:**
- Budgets ARE mutable (you edit amounts constantly)
- Duplicating old amounts breaks budget
- Complex state with relationships (transactions → line items)
- Deletions need to be coordinated (can't have orphaned transactions)

## The Core Problem to Solve

**Goal:** Sync budget like Primal syncs posts, but for mutable structured data

**Requirements:**
1. ✅ No data loss (ever)
2. ✅ Seamless multi-device experience
3. ✅ Can delete transactions/line items safely
4. ✅ Simple to understand (no complex sync logic for users)
5. ✅ Verified protection (users know data is safe)
6. ✅ Manual control (user can manage sync)
7. ✅ Automatic convenience (works silently most of the time)
8. ✅ Rollback capability (recover from mistakes)

## Proposed Solution: "Safe Cloud" Model

### Core Philosophy

**Three Layers of Safety:**
1. **Local** - Your device (primary source of truth)
2. **Cloud** - Nostr (encrypted backup of entire state)
3. **Versioning** - Keep history (for rollbacks)

**User Control:**
- Automatic sync by default
- Manual refresh button to pull from cloud
- Manual publish button to push to cloud
- Clear visibility into what's being synced
- Easy rollback to previous versions

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ USER'S DEVICE (IndexedDB)                                       │
│ Current Budget State (Primary Source of Truth)                  │
│ ├─ Monthly budgets                                             │
│ ├─ Categories & line items                                    │
│ ├─ Transactions                                               │
│ └─ Local metadata                                             │
│    ├─ lastLocalModified: timestamp                           │
│    ├─ lastLocalSyncedFromCloud: timestamp                   │
│    └─ autoSyncEnabled: boolean                               │
└────┬─────────────────────────────────────────────────────────┘
     │
     │ When user changes something
     ├─→ Update local IndexedDB
     ├─→ Record: lastLocalModified = now()
     │
     │ When auto-sync enabled (every 30 seconds)
     ├─→ Check if local > lastSyncedFromCloud
     ├─→ If yes: Encrypt entire state
     └─→ Publish to Nostr (kind 30078)

┌────────────────────────────────────────────────────────────────┐
│ NOSTR CLOUD (Encrypted Event)                                   │
│ Event: kind 30078 (replaceable addressable)                    │
│ ├─ content: encrypted budget JSON                             │
│ ├─ created_at: when synced                                   │
│ ├─ tags: ['d', 'sat-sorter/budget/2026-04']                 │
│ ├─ metadata: version, checksum, timestamp                   │
│ └─ history tags: link to previous versions                  │
└────┬─────────────────────────────────────────────────────────┘
     │
     │ When user logs in on new device
     ├─→ Query Nostr for most recent version
     ├─→ Decrypt with private key
     ├─→ Compare local vs cloud timestamp
     │
     ├─ If cloud newer:
     │  └─→ Show "Remote version available"
     │     [Pull from Cloud] [Keep Local] [Compare]
     │
     └─ If local newer:
        └─→ Auto-publish to cloud
           (User approved auto-sync)
```

### Key Design Decisions

#### 1. **Immutable Monthly Snapshots** (Not Stream of Changes)
```
WRONG (Stream-based):
  Event 1: Add line item "Groceries"
  Event 2: Change "Groceries" to $500
  Event 3: Delete "Groceries"
  → Problem: If Event 2 fails to sync, user lost data

CORRECT (Snapshot-based):
  Event: Complete budget for 2026-04
  {
    "budgets": [{ "month": "2026-04", "buckets": [...] }],
    "version": 5,
    "checksum": "abc123",
    "timestamp": 1712884800
  }
  → On next change: Publish entirely new Event
  → Each month is complete, self-contained
```

**Why snapshots:**
- ✅ Easy to verify (checksum proves integrity)
- ✅ No partial states (always consistent)
- ✅ Simple sync logic (compare versions, take newer)
- ✅ Easy rollback (just restore old version)
- ✅ Works with deletions (entire state includes what's deleted)

#### 2. **Versioning for Rollback**
```
Event v5: Full budget snapshot + pointer to v4
Event v4: Full budget snapshot + pointer to v3
Event v3: Full budget snapshot + pointer to v2
...

Tags in event:
['version', '5']
['previous', 'v4-checksum']
['checksum', 'sha256-of-content']
```

**Why versioning:**
- ✅ User can see what changed
- ✅ Can rollback if something went wrong
- ✅ Verifies data integrity (checksum)
- ✅ Helps debug sync issues
- ✅ Keeps limited history (last 10 versions)

#### 3. **Explicit Sync Points** (Not Silent)
```
Current approach (Silent auto-save):
  - Hard to debug when something goes wrong
  - User doesn't know if sync succeeded
  - Trust issues (is data really there?)

Better approach (Explicit with feedback):
  - User sees sync happen
  - Clear success/error messages
  - Manual control when needed
  - "Auto-sync" checkbox to enable background syncs
```

**Sync Modes:**

**Mode 1: Offline-First (Default)**
```
- All edits go to local storage immediately
- Visible locally within 100ms
- User can work offline
- Sync to Nostr when convenient (or auto-enabled)
- Manual "Sync to Cloud" button always visible
```

**Mode 2: Auto-Sync (Optional)**
```
- User enables "Auto-sync to Nostr"
- After each change: 5-second debounce
- Silently syncs to cloud
- Shows brief "Syncing..." indicator
- On success: Sync button shows checkmark briefly
- On failure: Error appears with retry option
```

**Mode 3: Manual (For Power Users)**
```
- No auto-sync
- User controls all sync timing
- "Sync Now" button in header
- Shows version info and last sync
- Useful for offline work or testing
```

#### 4. **Merge Strategy: "Local Wins" with Verification**

```typescript
When logging in on new device:

1. Get local budget state (if any)
2. Query Nostr for cloud version
3. Compare: local.lastModified vs cloud.created_at

Case A: Cloud is newer (cloud.created_at > local.lastModified)
  └─→ Show dialog:
      "Cloud version is newer (5 hours ago)"
      [Use Cloud] [Keep Local] [Compare Versions]

Case B: Local is newer (local.lastModified > cloud.created_at)
  └─→ Auto-sync local to cloud silently
      (User is working on new version)

Case C: Same timestamp
  └─→ Compare checksums
      If match: Same version, use it
      If different: Corrupted somehow, show error

Case D: No cloud version yet
  └─→ Publish current local version to cloud
      (First time syncing)
```

**Why "local wins with verification":**
- ✅ User's current work is primary source of truth
- ✅ Prevents accidental data loss
- ✅ Cloud is backup, not primary
- ✅ Can verify integrity with checksums
- ✅ Users control merges (see diff first)

#### 5. **Never Overwrite Without Asking**

```
DANGEROUS (Current):
  Cloud has version from 10:00
  Device has version from 9:50
  Auto-save silently replaces cloud with local
  → User loses 10 minutes of work from other device

SAFE (Proposed):
  Cloud has version from 10:00
  Device has version from 9:50
  System detects local is OLDER
  → Shows notification:
     "Cloud has newer version (10 minutes newer)"
     "Cloud version has 47 transactions"
     "Local version has 45 transactions"
     [Update to Cloud] [Keep Local]
```

### Implementation Approach

#### Phase 1: Bulletproof Manual Sync
```typescript
// User controls all sync timing
interface SyncState {
  localVersion: number;
  cloudVersion: number | null;
  lastLocalModified: number;
  lastCloudSync: number;
  status: 'synced' | 'dirty' | 'conflict' | 'error';
}

// User can:
1. "Push to Cloud" - Publish current local state
2. "Pull from Cloud" - Get latest cloud version
3. See version info and timestamps
4. Compare before pulling if different
5. See sync history (last 5 syncs)
```

**UI:**
```
┌─────────────────────────────────────┐
│ Cloud Sync Status                   │
├─────────────────────────────────────┤
│ Local Version: 42 (10 min ago)       │
│ Cloud Version: 41 (2 hours ago)      │
│ Status: Local is newer ✓             │
│                                     │
│ [Compare Versions] [Push to Cloud] │
│ [Pull from Cloud] [Sync History]   │
└─────────────────────────────────────┘
```

**Guarantees:**
- ✅ No data loss (manual control)
- ✅ User can see what's happening
- ✅ Can compare before pulling
- ✅ Can push when ready
- ✅ Transparent and safe

#### Phase 2: Smart Auto-Sync (When Manual Works)
Once manual sync is bulletproof:
```typescript
// Only enable after 2-3 months of manual use
// Gathers data on:
// - How often conflicts happen
// - User sync patterns
// - Device usage patterns
// - Error frequency

// When enabling auto-sync:
// 1. Show users what will happen
// 2. Clear opt-out process
// 3. Monitor for issues
// 4. Can disable any time
```

**Auto-sync Logic:**
```
On local change:
  ├─ Update local immediately
  ├─ Check if auto-sync enabled
  ├─ Wait 10 seconds (debounce, batch changes)
  ├─ Compare local vs cloud version
  │
  ├─ If no cloud version: publish new
  ├─ If cloud older: publish update
  ├─ If cloud newer: don't touch it!
  │   └─ Log and wait for user decision
  │
  └─ Show brief status indicator
```

## Handling Deletions Safely

### The Deletion Problem
```
Scenario: User deletes transaction
- Device 1: Delete transaction X
- Device 2: Still has transaction X (old version)
- Result: Transaction reappears when syncing

Why this happens:
- We're syncing full state snapshots
- If Device 2's version is older, it has the transaction
- Merging means deciding which is right
```

### The Solution: Deletion Events (Like Primal)

```
Primal's model:
- Post (kind 1): The actual content
- Delete (kind 5): "Delete this event" with event ID

Applied to budgets:
- Budget state (kind 30078): Full monthly budget
- Deletion (kind 30079): "This budget was deleted" or
                         "This transaction was deleted"
```

**Implementation:**
```json
// In budget state:
{
  "version": 42,
  "timestamp": 1712884800,
  "budgets": [...],
  "deletedItems": {
    "transactions": ["txn_id_1", "txn_id_2"],
    "lineItems": ["li_id_3"],
    "buckets": ["bucket_id_1"]
  }
}

// Or separate deletion event:
{
  "kind": 30079,
  "tags": [
    ['d', 'sat-sorter/deletions/2026-04'],
    ['e', 'budget-event-id'],  // References budget event
    ['deleted', 'transaction', 'txn_id_1'],
    ['deleted', 'lineItem', 'li_id_1'],
  ]
}
```

**When merging versions:**
```
Local version v10: Has transaction X marked as deleted
Cloud version v9: Has transaction X still present

Resolution:
1. Compare version numbers (v10 > v9)
2. Use local version (newer)
3. Transaction X stays deleted

If conflict (same version, different deletions):
- Merge deletedItems arrays
- User deleted X, other device deleted Y
- Result has both X and Y deleted
- No data loss
```

## User Experience Flow

### First Login (New Device)
```
1. User logs in with Nostr
2. App checks: "Any budget on cloud?"
3. If no cloud version:
   └─→ "No backup found. Start fresh?"
   └─→ Create new budget
   └─→ New edits will auto-sync

4. If cloud version exists:
   └─→ "Found your budget from 2 days ago"
   └─→ "Latest version: 42, 89 transactions"
   └─→ [Restore] [Start Fresh] [See Details]
```

### Editing (After Restored)
```
User edits budget on Device 1
├─→ Change saved to local immediately
├─→ "Draft" indicator shows locally
├─→ After 10 sec (debounce): Try to sync
│
├─ If auto-sync ON:
│  └─→ Silently syncs
│  └─→ Shows brief checkmark
│
└─ If auto-sync OFF:
   └─→ Shows "[Sync Now]" button
   └─→ User taps when ready
```

### Multi-Device (Most Important)
```
Device 1 (Desktop):
- Make budget edit 10:00 AM
- Auto-sync: Published to cloud 10:00:05
- Show: "Synced 5 seconds ago"

Device 2 (Phone, same user):
- User checks budget 10:01 AM
- On load: Pull latest from cloud
- Get version from Device 1 (10:00)
- Seamless: Sees latest version

Or if Device 2 made edits:
- Version 1: Device 1's edit (10:00)
- Version 2: Device 2's edit (10:05)
- When Device 2 syncs: Asks user
  "Cloud has older version (5 min old)"
  "Publish your changes?"
  [Yes] [Keep Syncing]
```

### Conflict Resolution
```
Worst case: Two people/devices edit simultaneously

Device 1: Edits from 10:00-10:10
- Version 5 published at 10:10

Device 2: Edits from 10:00-10:15
- Version 4 published at 10:15

Device 2 sees version 5 is newer:
├─→ Comparison:
│  "Version 5 (Device 1, 10:10)"
│  "Version 4 (This device, 10:15)"
│
├─→ Options:
│  [Use Version 5] - Replace my changes
│  [Keep Version 4] - Stick with my version
│  [Merge] - Combine both (if possible)
│  [See Diff] - What's different?
│
└─→ User decides
```

## Implementation Timeline

### Week 1: Manual Sync (Bulletproof)
- [ ] Add versioning to budget events
- [ ] Add checksum verification
- [ ] Manual sync UI (Push/Pull buttons)
- [ ] Version comparison view
- [ ] Sync history display
- [ ] Manual conflict resolution
- [ ] Thorough testing

### Week 2: Auto-Sync Infrastructure
- [ ] Auto-sync toggle setting
- [ ] Background sync logic
- [ ] Debounce implementation
- [ ] Status indicators
- [ ] Error handling and retry
- [ ] Offline detection

### Week 3: Safe Auto-Sync
- [ ] Deploy auto-sync to test users
- [ ] Monitor for issues
- [ ] Gather feedback
- [ ] Bug fixes
- [ ] Performance optimization

### Week 4: Budget Partners
- [ ] Multi-key encryption
- [ ] Partner invitations
- [ ] Permission system
- [ ] Activity logging

## Rollback Plan: If Something Goes Wrong

**If data gets corrupted:**
```
1. Access "Sync History" page
2. See list of recent versions
3. Pick a known-good version
4. Preview diff before restoring
5. Click "Restore Version X"
6. Immediately syncs to cloud
```

**If sync keeps failing:**
```
1. Disable auto-sync (toggle off)
2. Switch to manual mode
3. Can still use app offline
4. Try sync later when network better
5. Export to JSON as backup
6. Contact support with logs
```

**If lost budget data:**
```
1. Check "Sync History"
2. Try to restore previous version
3. Export as JSON for external backup
4. Check other devices for copy
5. Worst case: Recover from manual JSON export
```

## Testing Checklist (Critical)

Before any release:
- [ ] Manual sync doesn't lose data
- [ ] Multiple syncs don't corrupt state
- [ ] Deletions sync correctly
- [ ] Offline editing works
- [ ] No double-syncing (create duplicates)
- [ ] Version numbers increment correctly
- [ ] Checksums verify integrity
- [ ] Conflicts show merge dialog
- [ ] User can rollback without issues
- [ ] Cross-device sync matches expectations
- [ ] Page unload saves local changes
- [ ] Browser crash recovers gracefully
- [ ] Slow network doesn't break sync
- [ ] Large budgets (years of data) work
- [ ] Edge case: Same version synced twice
- [ ] Edge case: Sync during offline period
- [ ] Edge case: User on 3+ devices
- [ ] Edge case: Rapid fire edits
- [ ] Edge case: Delete during sync
- [ ] Permission: Works with view-only partners

## Why This Approach Works

✅ **No Data Loss**
- Local copy always exists
- Cloud is backup, not primary
- User controls merge decisions
- Can rollback anytime

✅ **Like Primal**
- Immutable snapshots (like posts)
- Versioning (like post edits)
- Simple conflict model
- Users understand it

✅ **Handles Deletions**
- Tracked in deletedItems
- Synced with versions
- No orphaned data

✅ **Safe for Beginners**
- Manual sync is bulletproof
- Auto-sync is optional
- Can disable any time
- Clear feedback

✅ **Scalable to Partners**
- Versioning helps merging
- Checksum prevents corruption
- Activity log works naturally
- Permissions on top of versions

## Conclusion

**This is NOT:**
- Streaming real-time sync (too complex for budgets)
- "Last write wins" (loses data)
- Silent auto-save (lost your budget before)
- Encrypted stream of changes (hard to rollback)

**This IS:**
- Snapshot-based versioning (like git commits)
- User-controlled by default (safe)
- Automatic when trusted (optional)
- Fully recoverable (history)
- Simple to understand (immutable states)
- Scalable to partners (built-in versioning)

**Result:** A sync system you can trust with your financial data.

---

Last Updated: April 11, 2026
