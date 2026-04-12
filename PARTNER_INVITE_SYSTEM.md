# Budget Partner Invite System - Implementation Guide

## Overview

This document describes the partner invite/accept system that enables the human-communication-first approach to shared budgets.

**Philosophy**: Real conversations about money are essential. The system should require and encourage active communication between partners.

---

## How It Works (The Conversation Flow)

### Step 1: Owner Initiates Sharing

**Owner's Actions:**
```
1. Opens Sat Sorter
2. Goes to Profile Icon → "Budget Partners"
3. Clicks "Add Partner"
4. Enters partner's npub/hex key
5. Selects permission (View Only / Can Edit)
6. Clicks "Add"
7. Partner appears as "Pending" in list
8. Clicks "Backup & Sync" to sync to Nostr
```

**Owner's View After Adding:**
```
Budget Partners
├─ Alice (alice@npub...)
│  Permission: Editor
│  Status: ⏳ Pending
│  (Waiting for Alice to accept)
```

### Step 2: Owner Communicates with Partner

**Owner Sends Message to Partner:**
```
"Hey Alice, I added you to my budget in Sat Sorter.
Can you log in and accept the invite?
I set you as an editor so you can add transactions too."
```

This forces the **real conversation to happen first** - no silent sharing.

### Step 3: Partner Receives Invite

**Partner's Experience:**
```
1. Gets message from Owner
2. Logs into own Sat Sorter account
3. Goes to Profile Icon → "Budget Partners"
4. Sees "Pending Invites" section
5. Shows: "[Owner] wants to share April 2026 budget (Edit access)"
6. Can see preview of budget
7. Clicks [Accept] or [Decline]
```

**Partner's View:**
```
Pending Budget Invites
├─ From: devin (npub...)
│  Budget: April 2026
│  Permission: Can Edit
│  [Accept]  [Decline]
```

### Step 4: Partner Accepts

**When Partner Clicks Accept:**
```
1. Invite status changes from "pending" to "accepted"
2. Status saved locally
3. Next time partner clicks "Backup & Sync":
   - Acceptance synced to Nostr
   - Owner sees update next time they reload/sync
```

**Owner Sees After Partner Accepts:**
```
Budget Partners
├─ Alice (alice@npub...)
│  Permission: Editor
│  Status: ✓ Accepted
│  (Alice has accepted and can now see your budget)
```

### Step 5: Both Can Now Collaborate

Once accepted:
```
Owner's Budget:
├─ Edits made by Owner
├─ Updates synced to Nostr
├─ Partner sees updates when they refresh
└─ Both can make changes

Partner's View:
├─ Sees Owner's budget in their list
├─ Can add transactions (if Edit permission)
├─ Can see Owner's updates
└─ Changes appear in Owner's view after sync
```

---

## Data Structures

### BudgetPartner (Owner's View)

```typescript
interface BudgetPartner {
  pubkey: string;              // Partner's Nostr pubkey
  name?: string;               // Partner's display name
  permission: 'view' | 'edit'; // Access level
  addedAt: number;             // When owner added them (unix timestamp)
  lastActive?: number;         // When partner last accessed
  status?: 'pending' | 'accepted' | 'declined';  // NEW
  acceptedAt?: number;         // When partner accepted invite
}
```

**Status Meanings:**
- `pending` - Owner invited, partner hasn't responded yet
- `accepted` - Partner clicked "Accept", can now access budget
- `declined` - Partner clicked "Decline", cannot access
- `undefined` - Legacy partners from before this system

### BudgetPartnerInvite (Partner's View)

```typescript
interface BudgetPartnerInvite {
  id: string;                  // Unique invite ID
  fromPubkey: string;          // Owner's pubkey
  budgetMonth: string;         // Which budget (YYYY-MM)
  permission: 'view' | 'edit'; // What access level
  createdAt: number;           // When owner sent invite
  status: 'pending' | 'accepted' | 'declined';
  acceptedAt?: number;         // When partner accepted
}
```

### BudgetState

```typescript
interface BudgetState {
  // ... existing fields ...
  partners?: BudgetPartner[];           // People added to YOUR budgets
  receivedInvites?: BudgetPartnerInvite[];  // NEW: Invites YOU received
}
```

---

## Hook Functions

### For Budget Owners

**Add a Partner:**
```typescript
const { addPartner } = useBudget();
addPartner('npub1...', 'edit'); // Adds partner
// Automatically marks them as 'pending'
```

**After adding, Owner marks as Pending:**
```typescript
const { sendPartnerInvite } = useBudget();
sendPartnerInvite(
  'npub1...',      // partner pubkey
  '2026-04',       // budget month
  'edit'           // permission level
);
// Changes status from "new" to "pending"
```

**See Partner Status:**
```typescript
const { partners } = useBudget();
partners.forEach(p => {
  console.log(`${p.name}: ${p.status}`);
  // Output:
  // Alice: pending
  // Bob: accepted
  // Carol: declined
});
```

### For Budget Partners

**Receive an Invite:**
```typescript
const { receivePartnerInvite } = useBudget();
receivePartnerInvite(
  'owner_pubkey',  // Owner's pubkey
  '2026-04',       // Which budget
  'edit'           // Permission offered
);
// Invite appears in receivedInvites list
```

**Accept an Invite:**
```typescript
const { acceptPartnerInvite } = useBudget();
acceptPartnerInvite('invite_id_123');
// Changes status from "pending" to "accepted"
// Now you have access to budget
```

**Decline an Invite:**
```typescript
const { declinePartnerInvite } = useBudget();
declinePartnerInvite('invite_id_123');
// Changes status to "declined"
// Removes budget from your view
```

---

## UI Implementation

### Owner's View: Partner List

```
Budget Partners

Alice (alice@npub...)
├─ Permission: Editor
├─ Status: ⏳ Pending
│  (Waiting for Alice to accept)
└─ [Remove] [Edit Permission]

Bob (bob@npub...)
├─ Permission: Viewer
├─ Status: ✓ Accepted
│  (Bob is viewing your budget)
└─ [Remove] [Edit Permission]

Carol (carol@npub...)
├─ Permission: Editor
├─ Status: ✗ Declined
│  (Carol doesn't have access)
└─ [Remove] [Retry]
```

### Partner's View: Pending Invites

```
Pending Invites

From: Alice (alice@npub...)
├─ Budget: April 2026
├─ Permission: Can Edit
├─ Added: 2 hours ago
└─ [Accept] [Decline]

From: Bob (bob@npub...)
├─ Budget: March 2026
├─ Permission: View Only
├─ Added: 1 day ago
└─ [Accept] [Decline]
```

### Status Badges

```
⏳ Pending (amber)  - Waiting for partner acceptance
✓ Accepted (green) - Partner has accepted
✗ Declined (red)   - Partner declined
(none)             - Legacy/confirmed partner
```

---

## Communication Flow

### The Conversation Is Required

```
Timeline:

T=0:   Owner: "I added you to my budget!"
T=5:   Partner: "I'll check it out"

T=10:  [Owner clicks Backup & Sync]
T=15:  [Partner logs in]
       Partner: "I see the pending invite"

T=20:  [Partner clicks Accept]
T=25:  [Owner sees "Accepted" status on next sync]

T=30:  Both: "Ready to collaborate!"
```

**Key Points:**
- Both people know what's happening
- Active consent required (click Accept)
- No automatic silent sharing
- Owner can see acceptance status
- Perfect for couples managing finances together

---

## Sync Strategy

### Local Storage

All partner invites stored locally first:
```
localStorage['sat-sorter-budget']
├─ partners: [...]           // People YOU added
├─ receivedInvites: [...]    // Invites YOU got
└─ userRole: 'owner'
```

### Nostr Sync (Manual for Now)

When owner clicks "Backup & Sync":
```
1. Budget + partner list → Nostr
2. Partner list includes status (pending/accepted/declined)
3. When partner next syncs: they get latest statuses
4. If partner accepted: they can decrypt budget
```

**Future: Auto-Sync**
```
- Every change auto-saves (2 second debounce)
- Status changes visible in real-time
- No manual sync button needed
```

---

## Multi-Budget Scenario

Partner can receive invites from multiple owners:

**Partner's Dashboard Shows:**
```
Your Budgets

From Alice:
├─ April 2026 (Edit)     ✓ Accepted
├─ March 2026 (View)     ⏳ Pending
└─ February 2026 (View)  ✗ Declined

From Bob:
├─ April 2026 (Edit)     ✓ Accepted
└─ May 2026 (View)       ⏳ Pending (New!)
```

---

## Error Scenarios

### Partner Already Invited
```
Owner: "I'll add Alice"
[Tries to add alice@npub again]
Dialog: "Alice is already a partner on this budget"
```

### Partner Revokes Access
```
Owner sees Alice as "Accepted"
Owner: [Clicks Remove]
Confirmation: "Remove Alice from this budget?"
[Confirms]
Next sync: Alice sees budget disappears from view
```

### Partner Doesn't Accept
```
Owner sees Alice as "Pending" after 3 days
Owner: [Clicks "Check Status" or "Send Reminder"]
Could show tooltip: "No response since invited"
```

---

## Security Considerations

### What This Doesn't Prevent
- ❌ Won't stop sender from sharing pubkey with wrong person
- ❌ Won't prevent forwarding budget data to others
- ❌ Won't track if partner shares with third party

### What This Enables
- ✅ Explicit consent (accept/decline)
- ✅ Clear visibility of who has access
- ✅ Easy revocation (remove partner)
- ✅ Audit trail (who accepted when)
- ✅ Required conversation (human layer)

**Philosophy**: Encryption handles technical security. Conversation handles human trust.

---

## Implementation Status

### ✅ Completed
- Data structures (BudgetPartner.status, BudgetPartnerInvite)
- State management (accept/decline/send/receive functions)
- Partner list UI (shows status badges)
- Local storage persistence

### 🔨 Next Steps
- Create "Pending Invites" dialog component
- Show notifications when invited
- Create accept/decline buttons
- Integrate into main Budget page
- Test multi-user flow

### 🚀 Future
- Auto-sync instead of manual
- Nostr DM notifications
- Activity log showing who changed what
- Multi-recipient encryption for real-time sharing

---

## Testing Checklist

- [ ] Owner can add partner
- [ ] Partner shows as "Pending"
- [ ] Owner clicks Sync
- [ ] Partner logs in
- [ ] Partner sees pending invite
- [ ] Partner clicks "Accept"
- [ ] Status changes to "Accepted"
- [ ] Partner can now see budget
- [ ] Partner clicks "Decline"
- [ ] Budget disappears from view
- [ ] Owner can "Remove" partner
- [ ] Partner can reject after accepting

---

## Summary

This invite system embodies the philosophy:
- **Intentional**: Both users actively participate
- **Transparent**: Status visible at all times
- **Communicative**: Requires real conversation
- **Reversible**: Easy to accept, decline, or remove
- **Trustworthy**: Clear audit trail

The system treats **human communication as a feature**, not something to hide behind slick UX.

When managing finances together, talking about it is the whole point.
