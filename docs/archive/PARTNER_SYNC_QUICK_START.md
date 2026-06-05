# Partner Sync Quick Start Guide

## What Was Fixed

**Problem**: When budget partners added transactions, they weren't synced in real-time. Each partner only saw their own transactions.

**Solution**: New real-time sync system that publishes transactions to Nostr as they're added, allowing all partners to see changes immediately.

## How to Use

### Setting Up Budget Partners

1. **Open Budget** → Go to header
2. **Click "Partners"** button
3. **Enter Partner's Nostr ID** (npub or pubkey)
4. **Select Permission** → "View" or "Edit"
5. **Send Invite** → Partner receives notification
6. **Partner Accepts** → Status changes to "Accepted"

### Using the Feature

**You add a transaction**:
```
1. Click "Quick Add" button (+)
2. Enter amount and description
3. Select category
4. Click "Save"
↓
✅ Instantly saved to your budget
✓ Automatically published to partners
✓ Partners see it within 1-2 seconds
```

**Partner adds a transaction**:
```
1. Partner does the same steps
2. Their transaction saves locally
3. Published to Nostr
↓
✅ You see it appear in real-time
✓ Budget totals update
✓ All devices stay in sync
```

## Real-World Example

**You and your roommate are managing shared expenses**

**Scenario**: Both have the budget app open for January 2024

```
Time 10:00 AM - You add: $50 for groceries
              ↓ (published to Nostr)
              → Partner sees it within 2 seconds
              ✓ January total updates

Time 10:05 AM - Partner adds: $120 for rent
              ↓ (published to Nostr)  
              → You see it within 2 seconds
              ✓ January total updates

Time 10:10 AM - Partner updates their transaction: $100 (mistake)
              ↓ (published to Nostr)
              → You see the update immediately
              ✓ Your totals recalculate

Result: Both of you always see the latest budget data
        No need to reload, save, or sync manually
```

## How It Works (Technical Overview)

### The Flow

```
You add transaction
     ↓
Budget component detects change
     ↓
PartnerSyncWrapper intercepts it
     ↓
Publishes to Nostr (encrypted, kind 4002)
     ↓
Partner's subscription receives it
     ↓
Partner auto-applies to their local budget
     ↓
Partner's screen updates
```

### What Gets Synced

- ✅ New transactions
- ✅ Updated transactions (amount, description, category)
- ✅ Deleted transactions
- ✅ Month and category assignments

### What Doesn't Get Synced (Yet)

- Bucket/category structure changes (add/delete/rename categories)
- Budget templates
- Partner list changes (must be added through invite)

These might be synced in future versions.

## Common Questions

### Q: Do I need to click "Save to Nostr"?

**A**: No! The partner sync is automatic and separate from the main save button. Transactions are published immediately. The "Save to Nostr" button in the bottom navigation saves your full budget state.

### Q: Will both partners see the exact same budget?

**A**: Almost! Each partner has their own local copy. If you're offline, you still see your transactions locally. When you go online, new partner transactions are synced in automatically.

### Q: What if we're both editing at the same time?

**A**: Both changes are published. If you both edit the same transaction, the version with the latest timestamp wins. This is rare in practice since you're usually tracking different transactions.

### Q: Can I undo a transaction?

**A**: Yes! Delete button works normally. The deletion is also published to your partner.

### Q: What if my internet connection drops?

**A**: 
- Transactions still save locally ✓
- Changes won't be published until reconnected
- Once reconnected, they publish automatically
- Your partner will see them shortly after

### Q: How private is this?

**A**: Very private! All transactions are encrypted with NIP-44 before being published to Nostr. Even if someone sees the event on the relay, they can't decrypt it. Only budget partners can decrypt because it's encrypted to each user's own key.

## Troubleshooting

### Transactions not appearing on partner's device?

1. **Check connectivity**: Both devices have internet?
2. **Check relationship**: Is the person marked as an "Accepted" partner?
3. **Wait a moment**: Real-time sync takes 1-10 seconds depending on relay latency
4. **Check month**: Are you viewing the same month?
5. **Refresh**: Press F5 to reload the page
6. **Check console**: Open browser DevTools (F12), look for errors

### See the same transaction twice?

This is very rare, but can happen if:
- Multiple relays send the same event
- Page was refreshed during sync

The system has safeguards to prevent this. Just refresh the page if it happens.

### Partner can't accept the invite?

1. Share your npub (not your nsec!)
   - Find it in the Budget header where it shows your name
   - It starts with "npub1..."
2. They log in with their own account (different nsec)
3. They add YOU as a partner to see your budget
4. Accept each other's invites

### Still having issues?

1. Check the detailed guide: `/docs/PARTNER_SYNC.md`
2. Look at console logs (F12 → Console tab)
   - Filter by "PartnerSyncWrapper" or "usePartnerTransactionSync"
3. Try the manual save button in the bottom navigation
4. Refresh both devices and try again

## Behind the Scenes

### What Nostr Event Kind is Used?

Kind 4002 (custom) - Budget Partner Transaction Sync

Each transaction is published as an encrypted Nostr event that only partners can read.

### How Often Are Updates Sent?

Every time you add/update/delete a transaction:
- ✓ Immediately saved locally
- ✓ Published to Nostr (within milliseconds)
- ✓ Partners receive in 1-10 seconds

### What's Actually Published?

The transaction data:
```json
{
  "id": "unique-id",
  "amount": 50,
  "description": "Groceries",
  "date": "2024-01-15T10:00:00Z",
  "isIncome": false,
  "lineItemId": "...",
  "bucketId": "..."
}
```

All encrypted, so Nostr relays can't see your data.

## Next Steps

1. **Add a budget partner** → Follow "Setting Up Budget Partners" above
2. **Test it**: Open the budget on two devices, both logged in
3. **Add a transaction** on one device
4. **Watch it appear** on the other device within 2 seconds!
5. **Enjoy** automatic sync!

## For Developers

Want to understand the implementation?

1. **Start**: `/docs/PARTNER_SYNC.md` - Detailed technical documentation
2. **Hook**: `/src/hooks/usePartnerTransactionSync.ts` - Real-time sync logic
3. **Component**: `/src/components/budget/PartnerSyncWrapper.tsx` - Intercepts changes
4. **Events**: `/NIP.md` - Nostr event format (kind 4002)

## Support

If you find issues:

1. Check the troubleshooting section above
2. Enable debug logging: `localStorage.setItem('debug:partner-sync', 'true')`
3. Take a screenshot of the console errors (F12 → Console)
4. Create an issue with details about what happened

---

**Quick wins to verify it works**:
- ✓ Add partner successfully
- ✓ Partner sees your transactions within 2 seconds
- ✓ You see their transactions within 2 seconds
- ✓ Budget totals are always in sync
