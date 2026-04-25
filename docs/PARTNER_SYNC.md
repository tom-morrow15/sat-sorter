# Budget Partner Real-Time Sync

## Overview

The budget partner sync system enables real-time synchronization of transactions between budget partners. When one partner adds, updates, or deletes a transaction, all other partners see the changes immediately in their budget view.

## How It Works

### Architecture

```
Partner A's Device          Nostr Network         Partner B's Device
================           ============           ================
Add Transaction
     |
     v
Save locally ✓
     |
     v
Publish to Nostr (encrypted)
                           ---event kind 4002---->
                                                  Receive in real-time
                                                        |
                                                        v
                                                  Decrypt and apply
                                                        |
                                                        v
                                                  Update local state
                                                        |
                                                        v
                                                  User sees transaction ✓
```

### Event Flow

1. **User Action**: Partner adds a transaction in their budget
2. **Local Save**: Transaction is saved to local browser storage immediately
3. **Nostr Publish**: PartnerSyncWrapper detects the change and publishes it
4. **Encryption**: Transaction is encrypted with NIP-44 before publishing
5. **Distribution**: Nostr relays broadcast the event to all subscribers
6. **Partner Receives**: Other partners' real-time subscription receives the event
7. **Decryption**: Partner decrypts with their own key to self
8. **Apply**: Transaction is added to their local budget automatically
9. **UI Update**: Partner's device shows the new transaction in real-time

## Implementation Details

### Components

#### `usePartnerTransactionSync` Hook

Located in `/src/hooks/usePartnerTransactionSync.ts`

**Purpose**: Manages real-time transaction sync between partners

**Key Methods**:
- `publishTransactionAdd(transaction)` - Publish a new transaction
- `publishTransactionUpdate(transaction)` - Publish a transaction update
- `publishTransactionDelete(transactionId)` - Publish a transaction deletion
- Automatically subscribes to partner events on mount
- Real-time listener receives updates from all partners

**State Management**:
- Tracks received updates by partner pubkey
- Marks processed events to prevent duplicates
- Maintains sync timestamps

#### `PartnerSyncWrapper` Component

Located in `/src/components/budget/PartnerSyncWrapper.tsx`

**Purpose**: Intercepts budget transactions and publishes changes automatically

**How it works**:
1. Compares current transactions with previous render
2. Detects additions, updates, and deletions
3. Publishes each change via `usePartnerTransactionSync`
4. Tracks publishing to prevent duplicate publishes

**Placement**: Wraps the Budget page at `/src/pages/Budget.tsx`

### Nostr Event Structure (Kind 4002)

```json
{
  "kind": 4002,
  "content": "nip44-encrypted-json",
  "tags": [
    ["p", "user-pubkey"],
    ["budget", "sat-sorter"],
    ["month", "2024-01"],
    ["type", "transaction-added"],
    ["version", "1"],
    ["alt", "Sat Sorter budget sync: transaction-added"]
  ]
}
```

**Encrypted Content**:
```json
{
  "type": "transaction-added",
  "budgetMonth": "2024-01",
  "data": {
    "transaction": {
      "id": "...",
      "amount": 1000,
      "description": "Coffee",
      "date": "2024-01-15T10:30:00Z",
      "lineItemId": "...",
      "bucketId": "...",
      "isIncome": false
    }
  },
  "timestamp": 1705315800,
  "version": 1
}
```

## User Experience

### Real-Time Sync Workflow

**Scenario**: You and your partner both have the app open, working on January 2024 budget

**Your Partner's View**:
```
1. Partner adds: $10 coffee expense
2. Clicks to categorize: "Food & Dining"
3. Saves transaction locally (instant)
4. Your screen automatically updates (within seconds)
5. You see: "$10 - Coffee" in the Food & Dining category
```

**Your View**:
```
1. You add: $150 monthly income
2. Categorizes to: "Salary"
3. Saves locally (instant)
4. Partner's screen automatically updates (within seconds)
5. Partner sees: "$150 - Salary" in the Income category
```

### Conflict Resolution

**Design**: Local changes always take precedence until synced

If both partners edit the same transaction simultaneously:
1. Each gets their own version locally
2. Next sync publishes their version
3. Later timestamp wins (last write wins)
4. Users can resolve conflicts manually if needed

## Technical Design Decisions

### Why Publish Every Transaction?

- **Pros**: Immediate synchronization, no conflicts, simple logic
- **Cons**: More Nostr events published
- **Decision**: Prioritize user experience (real-time) over bandwidth

### Why NIP-44?

- Provides per-message encryption
- Each user encrypts to themselves (privacy)
- More secure than NIP-04
- Event is readable but not decryptable by others

### Why Kind 4002?

- Regular kind in custom range (4000-4999)
- Each event is independent (no replaceable complexity)
- Simple subscription model
- Easy to query by author/month

### Processed Events Tracking

Prevents duplicate imports when:
- Subscription gets same event multiple times
- User reloads page
- Multiple relays return same event

Uses Set of event IDs for O(1) lookups.

## Error Handling

### Network Issues

If publishing fails:
- Transaction still saves locally (user sees it)
- Error logged to console
- Retry happens on next change
- User continues working normally

### Decryption Failures

If partner cannot decrypt:
- Event is logged but ignored
- User's local state unchanged
- Can be manually synced later via "Save to Nostr" button

### Missing Partner Data

If partner pubkey not available:
- Subscription simply won't see their events
- No errors raised
- User can re-add them as partner

## Future Enhancements

### Planned Features

1. **Conflict UI**: Show conflicts when same transaction edited simultaneously
2. **Sync Status Indicator**: Show "synced" vs "pending" in UI
3. **Batch Operations**: For bulk uploads from other sources
4. **Selective Sync**: Choose which transactions to sync
5. **Sync History**: See who changed what and when
6. **Undo/Redo**: With multi-user awareness

### Performance Optimizations

1. **Debounce Publishing**: Wait X ms before publishing changes
2. **Delta Sync**: Only send changed fields, not full transactions
3. **Compression**: Compress encrypted payloads for bandwidth
4. **Selective Subscription**: Only subscribe to current month

## Testing the Feature

### Manual Test Scenario

1. **Setup**:
   - Two users (Alice and Bob)
   - Add each other as budget partners (edit permission)
   - Both open budget for same month in separate browsers/devices

2. **Alice's Actions**:
   - Add transaction: "$50 groceries"
   - Categorize to "Food"

3. **Expected Result**:
   - Bob sees transaction appear in real-time
   - Bob's budget totals update
   - No refresh needed

4. **Bob's Actions**:
   - Update Alice's transaction: "$55 (receipt fixed)"

5. **Expected Result**:
   - Alice sees amount updated
   - Both users' local state matches

### Debugging

**Enable verbose logging**:
```javascript
// In browser console
localStorage.setItem('debug:partner-sync', 'true');
// Look for [usePartnerTransactionSync] and [PartnerSyncWrapper] logs
```

**Monitor Nostr events**:
```javascript
// Find events in relay responses
// Kind 4002 = partner sync events
// Look for kind in relay messages
```

## Troubleshooting

### Transactions Not Appearing

**Checklist**:
1. Both users logged in with Nostr? ✓
2. Same budget month? ✓
3. Partner status "accepted"? ✓
4. Internet connection stable? ✓
5. Check console for errors
6. Wait a few seconds (network latency)
7. Try manual refresh

### Duplicates or Out of Order

**Known Issues**:
- Multiple relay subscriptions might show same transaction twice
  - Fix: Processed events tracking handles this
- Clock skew between devices affects ordering
  - Limitation: Timestamps are server-based on events

### One Partner Isn't Receiving

**Debugging**:
1. Check subscription was established (console log)
2. Verify partner pubkey is correct
3. Try manually triggering another transaction
4. Check partner's device is still connected
5. Look for Nostr relay connection errors

## Security Considerations

### Privacy

- Only budget partners can see transactions
- Encrypted with NIP-44 (unreadable to observers)
- Relays see only metadata (timing, participant info)

### Data Integrity

- Event signatures prove authenticity
- Version numbers help detect tampering
- Checksums could be added in future

### Permissions

- Only partners with "edit" permission can trigger changes
- Viewers should not be able to add transactions (UI hides button)
- Ownership is immutable (owner is always budget creator)

## Performance Metrics

### Expected Latency

- Local save: < 100ms
- Publish to Nostr: 1-3 seconds
- Relay propagation: 1-5 seconds
- Partner receives: 1-10 seconds total
- **User perception**: "Instant" (< 2 seconds on good connection)

### Network Usage

- Average transaction: ~500 bytes encrypted
- Per transaction: 1 Nostr event
- Monthly: ~50-100 events (depends on usage)

## Documentation Files

For more information:
- `NIP.md` - Formal event definition for kind 4002
- `/src/hooks/usePartnerTransactionSync.ts` - Hook implementation
- `/src/components/budget/PartnerSyncWrapper.tsx` - Component implementation
