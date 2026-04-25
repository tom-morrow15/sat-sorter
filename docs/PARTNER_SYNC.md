# Budget Partner Real-Time Sync (v2)

## Overview

Real-time synchronization of budget transactions between partners. When one partner adds, updates, or deletes a transaction, all other partners see the change within seconds.

## Architecture

### Data Flow

```
Partner A adds a transaction
   │
   ▼
Local state updates (localStorage)
   │
   ▼
PartnerSyncWrapper detects the change
   │
   ▼
For EACH partner (accepted + pending):
   Encrypt transaction with NIP-44 (to partner's pubkey)
   Publish kind 4002 event with ["p", partner-pubkey]
   │
   ▼
Nostr relays propagate the event
   │
   ▼
Partner B's subscription receives events where #p = their pubkey
   │
   ▼
Decrypt using sender's pubkey (NIP-44 shared secret)
   │
   ▼
Mark transaction ID in globalRemoteTracker (echo prevention)
   │
   ▼
Update Partner B's local state
   │
   ▼
PartnerSyncWrapper sees the new transaction BUT finds it in
the remote tracker → skips re-publishing (prevents echo loop)
   │
   ▼
Partner B's UI renders the transaction ✓
```

### Why NIP-44 to partner's pubkey (not self)?

NIP-44 uses a **shared secret** derived from `(senderPrivKey, recipientPubKey)`. This same secret can be derived from the other side as `(recipientPrivKey, senderPubKey)`. So:

- Partner A encrypts to Partner B's pubkey → Partner B can decrypt using their own key + A's pubkey
- This is symmetric: works in both directions

If we encrypted to our own pubkey (self), only we could decrypt — defeating the purpose of sharing.

### Why one event per partner?

Each event is encrypted to a specific partner. If you have N partners, you publish N events (each encrypted differently). This is simple and scales fine for typical couple/family use.

## Components

### `usePartnerTransactionSync` hook (`/src/hooks/usePartnerTransactionSync.ts`)

- **Partners source**: Combines `usePartners` (Nostr kind 30078, owner-stored) with `state.partners` (localStorage, invitee-stored). This handles both sides of the sync.
- **Subscription**: Listens for kind 4002 events authored by any partner and tagged `#p = my-pubkey`.
- **Echo prevention**: Uses a global `remoteTracker` singleton. Before applying an incoming change to local state, it marks the transaction ID in the tracker so the wrapper knows not to re-publish it.
- **Publishing**: For each partner, encrypts the payload with NIP-44 to their pubkey and publishes a kind 4002 event.

### `PartnerSyncWrapper` component (`/src/components/budget/PartnerSyncWrapper.tsx`)

- **Change detection**: Each render, compares `fullState.budgets` against a snapshot in a ref. Detects added/updated/deleted transactions across all months.
- **Echo prevention**: Before publishing, checks the `remoteTracker`. If the change was caused by a received event, skips publishing and clears the marker.
- **Initialization**: On first run, just snapshots current state without publishing anything. This prevents the invitee's initial snapshot from being republished.

### `usePartnerInviteResponses` hook (`/src/hooks/usePartnerInviteResponses.ts`)

- **Purpose**: Watches for invite accept/decline responses (kind 4001 with `#t = sat-sorter-invite-response`) from pending partners.
- **Action**: When a response is received, updates the partner's status in the owner's `usePartners` list to match.

### `importBudgetState` updates (`/src/hooks/useBudget.ts`)

When the invitee accepts an invite:
1. The owner's budget snapshot is merged into local state
2. The `currentMonth` is set to **today's real current month** (not the imported month)
3. The owner is automatically added to the invitee's `state.partners` as `accepted` (so the invitee's sync subscription activates)

### `BudgetProvider` updates (`/src/contexts/BudgetContext.tsx`)

On initial app load, if `state.currentMonth` is stale (from a previous session or accepted invite), it's automatically reset to today's real current month. Users can still navigate to past/future months manually.

## Nostr Event (Kind 4002)

```json
{
  "kind": 4002,
  "content": "<NIP-44 encrypted JSON>",
  "tags": [
    ["p", "<recipient-pubkey>"],
    ["budget", "sat-sorter"],
    ["month", "2026-04"],
    ["type", "transaction-added"],
    ["version", "1"],
    ["alt", "Sat Sorter budget sync: transaction-added"]
  ]
}
```

### Decrypted content

```json
{
  "type": "transaction-added",
  "budgetMonth": "2026-04",
  "data": {
    "transaction": {
      "id": "...",
      "amount": 50000,
      "description": "Coffee",
      ...
    }
  },
  "timestamp": 1714050000,
  "version": 1
}
```

## Known Behaviors

### Pending partners

Before the owner sees the wife's accept response, her status is "pending". The sync system still works because:
- The owner publishes to both accepted AND pending partners
- The subscription filter includes both statuses
- Once `usePartnerInviteResponses` catches the accept event, her status auto-updates to "accepted"

### Month navigation

The app always opens to today's real current month. This prevents confusion when:
- The invitee accepts an invite sent months ago
- A device has stale localStorage state
- The user returns after not using the app for a while

### Initial snapshot vs. real-time sync

When the invitee accepts an invite, they receive a budget snapshot containing all existing transactions. Real-time sync only handles **new** changes from that point forward. If the owner made transactions before the invitee accepted, they come via the snapshot (not real-time events).

### Month not already existing

If a partner publishes a transaction for a month that the receiving side doesn't have a budget for yet, the receiver creates a new empty budget entry for that month and adds the transaction. This can happen if one partner navigates to a new month and adds a transaction before the other.

## Debugging

All sync-related logs are prefixed:
- `[PartnerSync]` — from the sync hook
- `[PartnerSyncWrapper]` — from the wrapper component
- `[PartnerInviteResponses]` — from the response listener
- `[BudgetProvider]` — from the context (month auto-correction)
- `[useBudget]` — from the budget hook (invite import)

To see all sync activity, filter browser console by `[Partner` or `[Budget`.
