# Phase 1 Implementation Plan: Manual Sync with Versioning

## Confirmed Design Decisions

### User Preferences (Locked In)
✅ **Manual sync first** - User controls all sync timing
✅ **Merge dialog for conflicts** - Clear user choice when versions differ
✅ **Deletion confirmations** - Confirm before syncing deletions
✅ **Prioritize UX** - Best experience for users over complexity

### Architecture Decisions
✅ **Snapshot-based versioning** - Each budget state = complete snapshot
✅ **Checksum verification** - SHA-256 checksums ensure integrity
✅ **Version tracking** - Keep last N versions for rollback
✅ **Immutable versions** - Each version is read-only history
✅ **Explicit sync points** - Manual [Push/Pull] controls everything

## Implementation Phases

### Phase 1: Core Manual Sync (Weeks 1-2)

#### Week 1: Data Model & Infrastructure

**1.1: Extend BudgetState with Versioning**
```typescript
interface BudgetState {
  currentMonth: string;
  budgets: MonthlyBudget[];
  currency: 'sats' | 'usd';
  
  // NEW: Versioning
  version: number;  // Increments each save (1, 2, 3...)
  checksum: string; // SHA-256 of content
  lastModified: number; // Unix timestamp (local device time)
  lastNostrSync: number; // Unix timestamp of last cloud sync
}

// NEW: Separate deletions tracking
interface DeletionRecord {
  itemType: 'transaction' | 'lineItem' | 'bucket';
  itemId: string;
  deletedAt: number;
}
```

**1.2: Create Versioning Service**
```typescript
// src/lib/budgetVersioning.ts

export function calculateChecksum(state: BudgetState): string {
  // SHA-256 of JSON content
}

export function createSnapshot(state: BudgetState, deletions: DeletionRecord[]): BudgetSnapshot {
  return {
    ...state,
    version: state.version + 1,
    checksum: calculateChecksum(state),
    deletions: deletions,
    createdAt: Math.floor(Date.now() / 1000),
    previousVersion: state.checksum, // Link to prev version
  };
}

export function verifyIntegrity(snapshot: BudgetSnapshot): {valid: boolean; reason?: string} {
  // Verify checksum matches content
}

export function canMerge(local: BudgetSnapshot, cloud: BudgetSnapshot): {canMerge: boolean; conflicts?: Conflict[]} {
  // Detect if merge is possible without conflicts
}
```

**1.3: Update Nostr Event Structure**
```typescript
// New event structure for kind 30078
{
  "kind": 30078,
  "tags": [
    ["d", "sat-sorter/budget-data"],
    ["version", "42"],
    ["checksum", "sha256-hash"],
    ["previous", "sha256-of-previous"],
    ["alt", "Sat Sorter budget snapshot v42"],
  ],
  "content": "<encrypted-entire-budget-state>",
  "created_at": 1712884800,
}
```

#### Week 2: UI & Manual Sync

**2.1: Create Sync Status Component**
```typescript
// src/components/budget/SyncStatus.tsx

// Shows:
// - Local version #, timestamp
// - Cloud version #, timestamp  
// - Status: "Synced" | "Local newer" | "Cloud newer" | "Conflict"
// - [Compare] [Push to Cloud] [Pull from Cloud] [History] buttons

interface SyncStatusProps {
  localVersion: number;
  localTimestamp: number;
  cloudVersion: number | null;
  cloudTimestamp: number | null;
  status: SyncStatus;
  onCompare: () => void;
  onPush: () => void;
  onPull: () => void;
  onHistory: () => void;
}
```

**2.2: Create Merge Dialog**
```typescript
// src/components/budget/MergeConflictDialog.tsx

// Shows:
// - Local version info
// - Cloud version info
// - Diff preview
// - User chooses: [Use Local] [Use Cloud] [Manual Merge]

interface MergeDialogProps {
  localVersion: BudgetSnapshot;
  cloudVersion: BudgetSnapshot;
  onResolve: (choice: 'local' | 'cloud' | 'merge') => void;
}
```

**2.3: Update BackupRestoreDialog**
```typescript
// New section showing:
// - Sync controls (Push/Pull/Compare)
// - Version history
// - Checksum verification
// - Last sync info
```

**2.4: Create Sync Service Hook**
```typescript
// src/hooks/useManualSync.ts

export function useManualSync() {
  // pushBudgetToCloud(state) - Publish local version
  // pullBudgetFromCloud() - Download cloud version
  // compareVersions(local, cloud) - Show differences
  // getVersionHistory() - List past versions
  // rollbackToVersion(versionNum) - Restore old version
}
```

### Phase 2: Deletion Handling (Week 2)

**2.1: Deletion Confirmation**
```typescript
// When user deletes transaction/line item:
// Show dialog: "Delete 'Whole Foods $42'?"
//            "This will sync to all devices"
//            [Cancel] [Delete]

// Track deletion in deletions array
// Include in next sync
```

**2.2: Deletion Sync**
```typescript
// When pushing to cloud:
// Include deletedItems array in snapshot
// When pulling: Apply deletions to local

// Merge logic: 
// If both deleted same item: OK
// If local deleted, cloud has it: Use local (deletion wins)
// If cloud deleted, local has it: Use cloud (deletion wins)
```

### Phase 3: Testing & Refinement (Week 3-4)

**3.1: Unit Tests**
```
- Checksum calculation correct
- Version incrementing works
- Snapshot creation works
- Deletion tracking works
- Merge logic correct
- Conflict detection works
```

**3.2: Integration Tests**
```
- Manual sync doesn't corrupt
- Multiple syncs in a row work
- Deletions sync correctly
- Offline editing works
- Version history is accurate
- Rollback restores correctly
```

**3.3: Manual Testing**
```
Scenario 1: Single device, manual sync
  - Edit budget
  - Click [Push to Cloud]
  - Verify it synced
  - Close and reopen
  - Click [Pull from Cloud]
  - Verify same version

Scenario 2: Two devices (simulate)
  - Edit Device 1, push
  - Edit Device 2, check pull
  - Pull from Device 1's version
  - Verify Device 2 has correct version

Scenario 3: Delete and sync
  - Delete transaction on Device 1
  - Confirm deletion
  - Push to cloud
  - Pull on Device 2
  - Verify transaction gone

Scenario 4: Conflict
  - Device 1: Edit at 10:00, push
  - Device 2: Edit at 10:05 (newer)
  - Device 2: Try to pull from Device 1
  - See conflict dialog
  - Choose Device 2 version
  - Verify Device 1 gets Device 2's version

Scenario 5: Rollback
  - Make 5 edits and syncs
  - Access version history
  - Roll back to version 3
  - Verify old data is back
```

## Implementation Details

### Sync Flow Diagram

```
┌─────────────────────────────────────┐
│ User clicks [Push to Cloud]         │
└────────────┬────────────────────────┘
             │
             ├─→ Get current budget state
             ├─→ Calculate checksum
             ├─→ Create snapshot (v42)
             ├─→ Increment version number
             │
             ├─→ Encrypt with NIP-44
             ├─→ Publish to Nostr (kind 30078)
             │
             ├─→ Wait for confirmation
             │
             ├─ Success:
             │  ├─→ Update localSyncedVersion = 42
             │  ├─→ Show "✓ Synced version 42"
             │  └─→ Update sync status
             │
             └─ Failure:
                ├─→ Show error dialog
                └─→ Offer retry button
```

```
┌─────────────────────────────────────┐
│ User clicks [Pull from Cloud]       │
└────────────┬────────────────────────┘
             │
             ├─→ Query Nostr for latest
             ├─→ Decrypt cloud version
             ├─→ Verify checksum
             │
             ├─→ Compare local vs cloud:
             │
             ├─ Local newer:
             │  ├─→ Show warning
             │  ├─→ "Local v42 (10:00)"
             │  ├─→ "Cloud v40 (9:55)"
             │  ├─→ [Keep Local] [Use Cloud] [Compare]
             │
             ├─ Cloud newer:
             │  ├─→ Show merge dialog
             │  ├─→ Diff preview
             │  ├─→ User chooses version
             │
             ├─ Same version:
             │  ├─→ Show "Already synced"
             │
             └─ Success (after user chooses):
                ├─→ Update local state
                ├─→ Show "✓ Synced"
                └─→ Update UI
```

### Deletion Flow

```
┌─────────────────────────────────────┐
│ User deletes transaction            │
└────────────┬────────────────────────┘
             │
             ├─→ Show confirmation dialog
             │   "Delete 'Whole Foods $42'?"
             │   "This will be synced to cloud"
             │
             ├─ User confirms:
             │  ├─→ Remove from local state
             │  ├─→ Add to deletedItems array
             │  ├─→ Show "Ready to sync"
             │  └─→ [Push to Cloud] button highlighted
             │
             └─ User cancels:
                └─→ Keep item, no change
```

## File Structure

```
src/
├─ hooks/
│  ├─ useManualSync.ts (NEW)
│  └─ useBudgetSync.ts (modified)
│
├─ lib/
│  ├─ budgetVersioning.ts (NEW)
│  ├─ budgetTypes.ts (modified)
│  └─ utils.ts (modified for checksum)
│
├─ components/budget/
│  ├─ SyncStatus.tsx (NEW)
│  ├─ MergeConflictDialog.tsx (NEW)
│  ├─ VersionHistoryDialog.tsx (NEW)
│  ├─ BackupRestoreDialog.tsx (modified)
│  └─ SaveToNostrFAB.tsx (modified)
│
└─ pages/
   └─ Budget.tsx (modified to use manual sync)
```

## Success Criteria

### Must Have
- ✅ Manual [Push to Cloud] and [Pull from Cloud] work
- ✅ No data loss in any scenario
- ✅ Checksums verify integrity
- ✅ Conflict dialog shows clear choices
- ✅ Deletions sync safely
- ✅ Version history accessible
- ✅ Can rollback to old versions
- ✅ Works across browsers/devices
- ✅ Clear error messages

### Nice to Have
- ✓ Version diff view shows what changed
- ✓ Detailed sync history
- ✓ Undo/redo for local changes
- ✓ Cloud version preview before pulling

## Timeline

```
Week 1 (Days 1-5):
  - Mon-Tue: Data model & types
  - Wed: Versioning service
  - Thu-Fri: Sync service hook

Week 2 (Days 6-10):
  - Mon-Tue: UI components
  - Wed: Integration with Budget page
  - Thu: Deletion handling
  - Fri: Polish & refinement

Weeks 3-4 (Days 11-30):
  - Testing & bug fixes
  - Real-world usage feedback
  - Performance optimization
  - Documentation
```

## Deployment Strategy

**Phase 1 Deployment:**
1. Code review
2. Internal testing (multiple devices)
3. Beta testing with 5-10 users
4. Gather feedback
5. Bug fixes
6. Full release

**Monitoring:**
- Track sync success/failure rates
- Monitor checksum failures (corruption)
- Measure conflict frequency
- Check version history usage
- Performance metrics

## Rollback Plan

If issues found in Phase 1:
1. Disable manual sync UI (show warning)
2. Keep local storage working
3. Users can export JSON
4. Fix issues
5. Redeploy

## Next Steps

1. ✅ Design approved
2. ✅ Preferences confirmed
3. ⏳ Begin Week 1 implementation
4. ⏳ Complete Phase 1 (manual sync)
5. ⏳ Test extensively with real users
6. ⏳ Decide on Phase 2 (optional auto-sync)

---

**Status:** Implementation Plan Approved
**Start Date:** Ready to begin Week 1
**Estimated Completion:** 2-3 weeks
**Data Loss Risk:** Eliminated by design
**User Impact:** Manual sync adds 2-3 clicks per sync, but guarantees safety
