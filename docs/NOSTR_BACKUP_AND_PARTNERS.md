# Sat Sorter - Nostr Backup and Budget Partners

## Overview

This document describes the Nostr backup system and budget partner sharing feature for Sat Sorter. It explains how budgets are saved to Nostr, restored across devices, and shared with trusted partners.

## Table of Contents

1. [Current System](#current-system)
2. [Data Protection](#data-protection)
3. [Auto-Save Strategy](#auto-save-strategy)
4. [Conflict Resolution](#conflict-resolution)
5. [Budget Partners Feature](#budget-partners-feature)
6. [Nostr Event Structure](#nostr-event-structure)
7. [User Experience](#user-experience)

---

## Current System

### How It Works Today

**Local-First Architecture:**
- All budget data is stored in browser IndexedDB by default
- Users can manually export to JSON files for backup
- Users can manually upload to Nostr via "Save to Nostr" button
- Only users with Nostr login (NIP-07 compatible) can use cloud sync

**Nostr Storage:**
- Budget data is encrypted using NIP-44 (end-to-end encryption)
- Stored as NIP-78 application-specific events
- Identifier: `sat-sorter/budget-data`
- Kind: 30078 (replaceable addressable event)
- Only the user's own pubkey can read it (self-encrypted)

### Risk Assessment

**Without Nostr Backup:**
- ❌ Device/browser data loss = budget loss
- ❌ Browser cache clear = data loss
- ❌ Multiple devices = out of sync
- ❌ No disaster recovery
- ✅ Complete privacy (data never leaves device)

**With Nostr Backup:**
- ✅ Data survives device loss
- ✅ Access from any device/browser
- ✅ Redundancy (multiple relays store copies)
- ⚠️ Data on Nostr relays (encrypted, only you can decrypt)
- ✅ Pair with file backups for maximum safety

---

## Data Protection

### Encryption Strategy

**NIP-44 Encryption (Current)**
```
1. User enables Nostr backup
2. Local budget state is serialized to JSON
3. JSON is encrypted using NIP-44 to self
4. Encrypted content is published as NIP-78 event
5. Event stored on Nostr relays (encrypted)
6. Only user's private key can decrypt
```

**Why This Works:**
- ✅ User never sends plaintext to relays
- ✅ Private key stays in signer/browser
- ✅ Encryption happens client-side
- ✅ Relays can't read budget contents
- ✅ Even relay operators can't see data

### Data Sensitivity

**What's in a budget backup:**
- Monthly budgets and categories
- Line items and planned amounts
- Transaction history
- Spending patterns
- Merchant associations
- Custom settings

**Privacy Level:** **HIGH**
- Financial data should not be readable by third parties
- Only you and authorized partners can see
- NIP-44 provides this guarantee

---

## Auto-Save Strategy

### Problem with Manual Save

Users might forget to save, leading to data loss:
- ✅ Make change to budget
- ✅ Close browser tab
- ❌ Forgot to click "Save to Nostr"
- ❌ Data lost on another device or if browser crashes

### Solution: Auto-Save

**When to Auto-Save:**
1. After adding/editing line items (2 second debounce)
2. After adding/editing transactions (1 second debounce)
3. After category changes (1 second debounce)
4. Before page unload (if any unsaved changes)
5. Every 5 minutes if user is still active (safety net)

**How It Works:**
```typescript
// Debounced auto-save whenever budget state changes
const autoSaveBudget = useMemo(
  () => debounce(async () => {
    if (user && canSync) {
      const success = await uploadBudget(currentBudget);
      // Silent success, only show errors
      if (!success && hasRecentChanges) {
        showWarning('Budget sync failed');
      }
    }
  }, 2000),
  [user, canSync, currentBudget]
);
```

**User Experience:**
- No visual interruption during normal editing
- Subtle indicator shows when last sync occurred
- Errors appear as non-intrusive warnings
- Manual save button still available for explicit control

### Auto-Download on Login

When user logs in with Nostr:
1. Check if remote backup exists on Nostr
2. Compare timestamps with local data
3. If remote is newer:
   - Show dialog: "Newer version found on cloud"
   - Offer: [Download] [Keep Local] [Merge?]
4. If local is newer:
   - Auto-sync local to cloud (with notification)

---

## Conflict Resolution

### Multi-Device Scenarios

**Scenario 1: Last-write-wins (Current)**
```
Device A:  Updates budget at 14:00 → Saves to Nostr
Device B:  Updates budget at 14:05 → Saves to Nostr (overwrites A's changes)
Result:    Device A's changes are lost
```

**Better Approach: Timestamp Comparison**
```
Device A:  Updates at 14:00 → Created_at: 14:00
Device B:  Updates at 14:05 → Created_at: 14:05
Device C:  Loads budget   → Gets version from 14:05 (newest)
```

**Implementation:**
```typescript
// In BudgetState
interface BudgetState {
  currentMonth: string;
  budgets: MonthlyBudget[];
  currency: 'sats' | 'usd';
  lastModified: number; // Unix timestamp (local device time)
  lastSyncedToNostr: number; // Unix timestamp of Nostr event creation_at
  syncConflictMode: 'last-write-wins' | 'merge-manual' | 'merge-auto';
}

// When downloading, check versions
if (remoteTimestamp > state.lastSyncedToNostr) {
  // Remote is newer
  showMergeDialog(localBudget, remoteBudget);
}
```

### Manual Merge UI

When conflicts detected:
```
┌─────────────────────────────────────┐
│ Budget Sync Conflict                │
│                                     │
│ You have different budgets on your  │
│ devices. Choose which to keep:      │
│                                     │
│ Local (This Device)                 │
│ • Last updated: 2 hours ago         │
│ • 3 months, 45 transactions         │
│ [Keep Local]                        │
│                                     │
│ Cloud (From Nostr)                  │
│ • Last updated: 30 minutes ago      │
│ • 3 months, 47 transactions         │
│ [Use Cloud]                         │
│                                     │
│ [Merge Manually...] [View Diff]     │
└─────────────────────────────────────┘
```

---

## Budget Partners Feature

### What Are Budget Partners?

**Definition:** Trusted people who can view/edit your budget with you

**Use Cases:**
- Couples managing joint finances
- Business partners splitting costs
- Family members tracking shared expenses
- Accountability partners for spending goals
- Committee/team budget management

### Permission Levels

**View-Only (Recommended for trusted observers)**
- ✅ See all categories and amounts
- ✅ View transaction history
- ✅ See monthly reports
- ❌ Cannot add/edit/delete line items
- ❌ Cannot add transactions
- ❌ Cannot delete data

**Edit (For active budget collaborators)**
- ✅ Do everything View-Only can do
- ✅ Add/edit line items
- ✅ Add transactions
- ✅ Move transactions between categories
- ❌ Cannot delete line items or transactions
- ❌ Cannot remove partners
- ❌ Cannot export/import

**Full Control (For budget owner - you)**
- ✅ All Edit permissions
- ✅ Delete line items and transactions
- ✅ Manage partners (add/remove)
- ✅ Change permissions
- ✅ Delete entire budget
- ✅ Export and backup

### Partner Invitation Flow

**Step 1: Owner initiates sharing**
```
1. Open Budget → Menu → Sharing
2. Click "Add Partner"
3. Enter their Nostr username/pubkey
4. Select permission level (View/Edit)
5. Click "Send Invitation"
```

**Step 2: Invitation sent via Nostr DM**
```
Event Type: NIP-04/NIP-17 Direct Message
From: Budget owner
To: Partner
Content: 
{
  "type": "budget_partner_invite",
  "budgetMonth": "2026-04",
  "budgetId": "...",
  "permission": "edit",
  "inviteCode": "...",
  "expiresAt": 1234567890
}
```

**Step 3: Partner receives notification**
```
Dashboard shows:
┌─────────────────────────┐
│ New Budget Invitation   │
│                         │
│ Alice wants to share    │
│ their April 2026 budget │
│ with you (Edit access)  │
│                         │
│ [Accept] [Decline]      │
└─────────────────────────┘
```

**Step 4: Partner accepts**
```
1. Partner clicks [Accept]
2. Partner's key added to partners list
3. Budget events now encrypted to multiple recipients
4. Partner can now see budget
5. Notification sent back to owner
```

### Partner Data Sharing

**Current Problem:**
- Budget encrypted to: `owner_pubkey`
- Partner can't decrypt (only owner can)

**Solution: Multi-Recipient Encryption**
```
Option 1: Multiple copies of same event
- Publish one event encrypted to partner A
- Publish one event encrypted to partner B
- (Wasteful, relays might limit)

Option 2: Hierarchical encryption (RECOMMENDED)
- Publish master event encrypted to owner
- Share encryption key via NIP-04 DM to each partner
- Partner receives plaintext key separately
- Partners can decrypt master event
- (Efficient, private key exchange over DM)

Option 3: Shared key via event tags
- Store shared decryption key in NIP-44 encrypted tag
- Each partner has access to tag
- (Complex, less tested)
```

**Recommended: Option 2 (Hierarchical)**

```typescript
// When publishing with partners
const partners = [
  { pubkey: "partner_a_pubkey", permission: "edit" },
  { pubkey: "partner_b_pubkey", permission: "view" }
];

// 1. Encrypt budget to owner (as before)
const ownerEncrypted = await signer.nip44.encrypt(
  ownerPubkey, 
  JSON.stringify(budgetState)
);

// 2. Publish event to relays
const event = await publish({
  kind: 30078,
  content: ownerEncrypted,
  tags: [
    ['d', `sat-sorter/${budgetMonth}/${budgetId}`],
    ['partners', JSON.stringify(partners)],
    ['alt', 'Shared budget data']
  ]
});

// 3. Send decryption key to each partner via DM
for (const partner of partners) {
  await sendDirectMessage(partner.pubkey, {
    type: 'budget_share_key',
    eventId: event.id,
    encryptionKey: ownerEncrypted, // They'll need this to decrypt
    permission: partner.permission
  });
}
```

### Activity Log for Accountability

Track who changed what and when:

```typescript
interface BudgetActivity {
  id: string;
  timestamp: number;
  actor: string; // pubkey of who made change
  actorName: string; // display name
  action: 'line_item_added' | 'transaction_added' | 'amount_changed' | 'partner_added';
  details: {
    lineItemId?: string;
    transactionId?: string;
    oldValue?: number;
    newValue?: number;
    partnerPubkey?: string;
  };
}
```

**In UI:**
```
Activity Log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10:45  Alice added "$150" to Groceries
10:30  Bob added transaction "Whole Foods $42"
10:15  Alice changed Rent from "$2280" to "$2300"
 9:45  Bob accepted budget invitation
```

---

## Nostr Event Structure

### Budget Event (Kind 30078)

```json
{
  "kind": 30078,
  "tags": [
    ["d", "sat-sorter/2026-04"],
    ["alt", "Shared April 2026 budget"],
    ["partners", "[{\"pubkey\":\"...\",\"permission\":\"edit\"}]"]
  ],
  "content": "<encrypted-nip44-budget-json>",
  "created_at": 1712884800,
  "pubkey": "<owner-pubkey>"
}
```

### Budget Invitation Event (via DM - NIP-04/NIP-17)

```json
{
  "kind": 4,  // or 17 for NIP-17
  "tags": [["p", "<recipient-pubkey>"]],
  "content": "<encrypted: {
    \"type\": \"budget_partner_invite\",
    \"budgetMonth\": \"2026-04\",
    \"ownerName\": \"Alice\",
    \"permission\": \"edit\",
    \"expiresAt\": 1712971200,
    \"note\": \"Let's track our shared April expenses!\"
  }>",
  "created_at": 1712884800,
  "pubkey": "<owner-pubkey>"
}
```

### Partner Activity Event (Kind 30078 with activity tag)

```json
{
  "kind": 30078,
  "tags": [
    ["d", "sat-sorter/2026-04/activity"],
    ["eventType", "activity"],
    ["alt", "Budget activity log"]
  ],
  "content": "<encrypted-activity-list>",
  "created_at": 1712884800,
  "pubkey": "<owner-pubkey>"
}
```

---

## User Experience

### Guests (No Nostr Login)

```
Budget Page
├─ Budget data saved locally (IndexedDB)
├─ Alert: "Your data is local only"
├─ Export option (download JSON)
└─ "Log in with Nostr to sync and share"
```

**Risks communicated:**
- ⚠️ Loss of browser data = loss of budget
- ⚠️ Works only on this device/browser
- ⚠️ No backup

### Logged In (Nostr User)

```
Budget Page
├─ Budget auto-saved to Nostr
├─ Indicator: "✓ Synced 2 min ago"
├─ Manual Save button (still available)
└─ Menu:
   ├─ Backup & Sync (export/import)
   ├─ Add Partner (invite to share)
   └─ Manage Partners (view/edit/remove)
```

**Protection:**
- ✅ Auto-saved every 2 seconds
- ✅ Accessible from any device
- ✅ Can be shared with partners
- ✅ Activity logged
- ✅ Encrypted end-to-end

### Family/Household Budget (With Partners)

```
Shared Budget: "Household April 2026"

Partners:
├─ Alice (Edit) - Last active 10 min ago
└─ Bob (View) - Last active 2 hours ago

Shared Categories:
├─ 💰 Household Income
│  ├─ Salary (Alice)
│  └─ Salary (Bob)
├─ 🏠 Housing
│  ├─ Rent
│  └─ Utilities
└─ 🍔 Groceries
   └─ Whole Foods (Updated by Alice 10 min ago)

Activity:
├─ 10:45 Alice added $50 to Groceries
└─ 10:30 Bob viewed budget
```

---

## Implementation Roadmap

### Phase 1: Robust Single-User Sync (CURRENT)
- ✅ NIP-44 encryption working
- ⏳ Auto-save with debouncing
- ⏳ Conflict resolution UI
- ⏳ Better sync status indicators

### Phase 2: Multi-User Infrastructure
- ⏳ Partner model in BudgetState
- ⏳ Multi-recipient encryption
- ⏳ Activity logging
- ⏳ Partner management UI

### Phase 3: Budget Sharing
- ⏳ Invitation system via DM
- ⏳ Partner permissions
- ⏳ Shared budget views
- ⏳ Collaborative editing

### Phase 4: Advanced Features
- ⏳ Budget templates for sharing
- ⏳ Budget comments/annotations
- ⏳ Spend notifications for partners
- ⏳ Scheduled reports

---

## Security Considerations

### What's Protected
- ✅ Budget data encrypted with NIP-44
- ✅ Private keys stay in signer
- ✅ No central server
- ✅ No plaintext on relays

### What's Not Protected
- ⚠️ Metadata (who has a budget, who partners with whom)
- ⚠️ Relay sees timestamps and event kinds
- ⚠️ Partner pubkeys visible in tags (if implementation uses them)

### Best Practices for Users
1. **Always use Nostr backup** for any important budget
2. **Export manually** quarterly for archival
3. **Trust partners carefully** (they'll see all spending)
4. **Review activity log** regularly for unauthorized changes
5. **Remove inactive partners** to reduce exposure
6. **Use View-Only for observers** (don't give Edit unless necessary)

---

## Testing Strategy

### Unit Tests
- Encryption/decryption works correctly
- Partner permissions enforced
- Activity logging captures all changes
- Conflict resolution picks correct version

### Integration Tests
- Auto-save triggers appropriately
- Multi-device sync works
- Partner invitation flow complete
- Shared events decrypt properly

### User Testing
- Partners can see shared budget
- Edit permissions actually restrict UI
- Conflict dialog is understandable
- Activity log is accurate

---

## Troubleshooting

### "Budget won't sync"
1. Check internet connection
2. Verify Nostr login active
3. Check signer supports NIP-44
4. Look at error in console
5. Try manual save

### "Partner can't see budget"
1. Confirm partner accepted invitation
2. Check encryption keys were shared
3. Verify partner has current Nostr app
4. Try re-inviting partner

### "Lost budget data"
1. Check Nostr backup (Backup & Sync menu)
2. Check local backups (JSON exports)
3. Check other devices for data
4. Ask partner if they have copy

---

## Future Enhancements

- [ ] Deterministic conflict merging (combine both versions)
- [ ] Budget versioning and history
- [ ] Time-travel (view budget at past date)
- [ ] Audit reports (who spent what)
- [ ] Permission expiration dates
- [ ] Budget templates library
- [ ] Smart notifications for partners
- [ ] Dark Web relay support
- [ ] Backup to IPFS
- [ ] Timelock encryption for future budgets

---

**Last Updated:** April 2026
**Status:** Documentation for planned implementation
