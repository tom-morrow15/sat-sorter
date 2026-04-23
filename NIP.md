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
