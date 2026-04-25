# Sat Sorter Custom NIPs

This document describes the custom event kinds used by Sat Sorter for functionality not covered by existing NIPs.

## Kind 4001 - Budget Partner Invite

A regular event used to send encrypted partner invite notifications between Sat Sorter users. The content is encrypted using NIP-04 (with NIP-44 as fallback) so only the intended recipient can read it.

### Purpose

When a user adds a partner to their budget, an encrypted invite is published to Nostr. The recipient's Sat Sorter app queries for these events and shows them as pending invites that can be accepted or declined.

### Event Structure

**Kind**: 4001 (regular event)

**Content**: NIP-04 encrypted JSON payload:
```json
{
  "type": "invite" | "accept" | "decline" | "revoke",
  "inviteId": "unique-invite-id",
  "budgetMonth": "YYYY-MM",
  "permission": "view" | "edit",
  "fromPubkey": "hex-pubkey-of-sender",
  "fromName": "optional-display-name"
}
```

**Required Tags**:
- `["p", "<recipient-hex-pubkey>"]` - Recipient of the invite (indexable)
- `["t", "sat-sorter-invite"]` - Category tag for filtering (indexable)
- `["d", "<invite-id>"]` - Unique invite identifier
- `["month", "YYYY-MM"]` - Budget month reference
- `["perm", "view" | "edit"]` - Permission level
- `["alt", "<description>"]` - Human-readable description (NIP-31)

### Response Events

Acceptance and decline responses use the same kind with:
- `["t", "sat-sorter-invite-response"]` - Response category tag
- `["status", "accepted" | "declined"]` - Response status

### Querying

Recipients query for their invites using:
```json
{
  "kinds": [4001],
  "#p": ["<user-pubkey>"],
  "#t": ["sat-sorter-invite"]
}
```

### Security

- Content is encrypted with NIP-04 (with NIP-44 fallback)
- Only the recipient can decrypt the invite payload
- Public tags only reveal metadata (sender, recipient, invite category)
- Event signatures verify authenticity of invites

## Kind 4002 - Budget Partner Transaction Sync

A regular event used to sync transactions and budget updates between budget partners in real-time. Each partner publishes their own changes, which other partners can subscribe to for real-time synchronization.

### Purpose

When a partner adds a transaction, updates a line item, or makes other budget changes, they publish a sync event that all other partners can subscribe to. This enables real-time synchronization of budget data across all partners' devices without needing to manually save or reload.

### Event Structure

**Kind**: 4002 (regular event)

**Content**: NIP-44 encrypted JSON payload:
```json
{
  "type": "transaction-added" | "transaction-updated" | "transaction-deleted" | "budget-updated",
  "budgetMonth": "YYYY-MM",
  "data": {
    // For transaction-added/updated:
    "transaction": { /* Transaction object */ },
    // For transaction-deleted:
    "transactionId": "transaction-id",
    // For budget-updated:
    "snapshot": { /* Full budget state or delta */ }
  },
  "timestamp": 1234567890,
  "version": 1
}
```

**Required Tags**:
- `["p", "<owner-hex-pubkey>"]` - Budget owner (indexable)
- `["budget", "sat-sorter"]` - Budget category tag (indexable)
- `["month", "YYYY-MM"]` - Budget month reference
- `["type", "transaction-sync" | "budget-update"]` - Event type
- `["alt", "<description>"]` - Human-readable description (NIP-31)

### Data Format

All transaction and budget data is encrypted with NIP-44 so only the budget participants can read it.

### Querying

Partners query for budget updates using:
```json
{
  "kinds": [4002],
  "#p": ["<budget-owner-pubkey>"],
  "#budget": ["sat-sorter"],
  "#month": ["YYYY-MM"]
}
```

### Real-Time Subscription

Partners maintain open subscriptions to budget owner and co-partner events:
```json
{
  "kinds": [4002],
  "#p": ["<owner-pubkey>", "<partner-pubkey>"],
  "#budget": ["sat-sorter"]
}
```

### Merge Strategy

When receiving updates from multiple partners:
1. Apply transaction updates in order of timestamp
2. Use version numbers to detect out-of-order updates
3. Mark conflicts with timestamps for user review
4. Local changes always take precedence within a session (until explicitly synced)

### Security

- Content is encrypted with NIP-44 (each participant's key to self)
- Only budget participants can decrypt their own events
- Public tags reveal budget participation but not data
- Event signatures verify authenticity of updates
