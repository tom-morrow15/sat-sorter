# Sat Sorter Custom NIPs

This document describes the custom event kinds used by Sat Sorter for functionality not covered by existing NIPs.

## Kind 4001 - Budget Partner Invite

A regular event used to send encrypted partner invite notifications between Sat Sorter users. The content is encrypted using NIP-44 so only the intended recipient can read it.

### Purpose

When a budget owner adds a partner, an encrypted invite is published to Nostr. The invite contains the encrypted budget nsec, NOT a full budget snapshot. The recipient decrypts the budget nsec and uses it to subscribe to budget data directly from relays under the budget npub.

### Event Structure

**Kind**: 4001 (regular event)

**Content**: NIP-44 encrypted JSON payload:
```json
{
  "type": "invite" | "accept" | "decline",
  "inviteId": "unique-invite-id",
  "month": "YYYY-MM",
  "permission": "viewer" | "editor",
  "from": "hex-pubkey-of-sender",
  "fromName": "optional-display-name",
  "encryptedBudgetKey": "nip44-ciphertext-of-budget-nsec",
  "budgetNpub": "npub1..."
}
```

**Required Tags**:
- `["p", "<recipient-hex-pubkey>"]` - Recipient of the invite (indexable)
- `["t", "sat-sorter-invite"]` - Category tag for filtering (indexable)
- `["d", "<invite-id>"]` - Unique invite identifier
- `["budget", "<budget-npub>"]` - The budget's public identity
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

- Content is encrypted with NIP-44
- Only the recipient can decrypt the invite payload
- Public tags only reveal metadata (sender, recipient, budget npub)
- Event signatures verify authenticity of invites
- The budget nsec is shared peer-to-peer, never stored on relays

## Kind 30078 - Shared Budget Data (NIP-78)

Addressable events (kind 30078) are used for all budget data storage and synchronization. Each shared budget has its own Nostr identity (nsec/npub). All budget entries are signed and encrypted by the budget keypair, not by individual users.

### Purpose

When two users share a budget, they share a single Nostr keypair. All budget data (categories, line items, transactions, templates) is published as kind 30078 events authored by the budget npub. Both partners subscribe to the budget npub's events — one subscription covers everyone.

### Event Structure

**Kind**: 30078 (addressable / parameterized replaceable)

**Content**: NIP-44 encrypted JSON payload (MonthlyBudget or BudgetManifest)

**Format**: Split storage — one manifest + one small event per month:
- Manifest d-tag: `sat-sorter/budget-data`
- Per-month d-tags: `sat-sorter/budget-data/YYYY-MM`

**Required Tags**:
- `["d", "<identifier>"]` - Unique d-tag (see above)
- `["alt", "<description>"]` - Human-readable description (NIP-31)

### Publish and Subscribe

**Owner publishes**: Signs and encrypts budget entries with the budget keypair:
```typescript
const signer = new NSecSigner(budgetPrivateKey);
const encrypted = encryptWithBudgetKey(data, budgetPrivateKey, budgetPublicKey);
await publish({ kind: 30078, content: encrypted, tags: [['d', dTag], ...] });
```

**Partners subscribe**: Subscribe to the budget npub's events:
```json
{
  "kinds": [30078],
  "authors": ["<budget-npub-hex>"]
}
```

### Deduplication

Transactions are deduplicated by their `id` field. Applying the same entry twice is idempotent. No RemoteOriginTracker is needed because all events come from the same budget npub.

### Security

- Content is encrypted with NIP-44 using the budget keypair
- All data at rest on relays is opaque to non-participants
- The budget nsec is shared peer-to-peer (encrypted per-partner in the invite)
- Public tags only reveal that a budget npub has published budget data
- Event signatures verify the budget keypair's authenticity

### Comparison with Old Model

| Feature | Old (kind 4002) | New (kind 30078) |
|---------|-----------------|-------------------|
| Event kind | 4002 | 30078 |
| Encryption | Per-partner NIP-44 | Budget keypair NIP-44 |
| Publishing | One event per partner | One event total |
| Subscription | Multiple partner authors | Single budget npub |
| Echo prevention | RemoteOriginTracker | Transaction ID dedup |
| Invite payload | Full budget snapshot | Encrypted budget nsec |
