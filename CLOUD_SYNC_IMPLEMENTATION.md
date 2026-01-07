# Cloud Sync Implementation Guide

## Current State

The project has a `useBudgetSync` hook that:
- Uses NIP-78 (Application-specific data) with kind 30078
- Encrypts budget data with NIP-44 to self
- Has methods to upload and download budget data
- **BUT**: Is not actually integrated into the Budget page!

## Why Cloud Sync Isn't Working

1. **No Integration**: The `useBudgetSync` hook exists but is never called
2. **No Automatic Syncing**: There's no effect that periodically syncs data
3. **No Conflict Resolution**: If user edits on two devices, there's no merge strategy
4. **No Loading from Cloud**: When app opens, it doesn't check if there's newer data on Nostr

## Implementation Plan

### Phase 1: Basic Cloud Sync Integration (This PR)
- [ ] Add `useBudgetSync` to Budget.tsx
- [ ] Load budget from cloud when user logs in
- [ ] Auto-save budget to cloud when it changes
- [ ] Show sync status in UI (last sync time, syncing indicator)

### Phase 2: Conflict Resolution (Future)
- [ ] Detect conflicts when local timestamp differs from cloud
- [ ] Present merge dialog to user
- [ ] Implement merge strategy (latest-wins, manual merge, etc.)

### Phase 3: Offline Support (Future)
- [ ] Queue sync operations when offline
- [ ] Retry syncing when back online
- [ ] Show warning when data may be out of sync

## Security Considerations

The current implementation encrypts data with NIP-44 to self (same pubkey), which means:
- ✅ **Good**: Data is encrypted on the relay, relay can't read it
- ✅ **Good**: Only the user can decrypt it (they own the private key)
- ⚠️ **Limitation**: Can't easily share budget with another account (dual login feature)

For dual login (shared budget), would need:
- NIP-26 (Event Delegation) to allow wife's account to modify husband's data
- Or encrypt with shared key derived from both pubkeys
- Or implement proper access control

## Technical Notes

### NIP-78 Event Structure
```json
{
  "kind": 30078,
  "tags": [
    ["d", "sat-sorter/budget-data"],
    ["alt", "Sat Sorter budget data (encrypted)"]
  ],
  "content": "[encrypted JSON stringified BudgetState]"
}
```

### Encryption Flow
1. `BudgetState` object is JSON stringified
2. Stringified JSON is encrypted with NIP-44 (user's pubkey)
3. Encrypted string is stored in event content
4. Event is published to relays

### Decryption Flow
1. Query for kind 30078 events with `d: sat-sorter/budget-data`
2. Get the most recent event (by created_at)
3. Decrypt the content with NIP-44
4. Parse JSON to get `BudgetState`

## Testing Checklist

- [ ] Create budget on Device A, login Device B, verify it appears
- [ ] Edit budget on Device A, verify changes sync to Device B
- [ ] Edit budget on both devices simultaneously, verify no data loss
- [ ] Log out and back in, verify budget loads from cloud
- [ ] Test with multiple relays, verify data syncs across all
