# Developer Donation Feature Added

## What Was Added

A professional donation feature that allows users to support the development of Sat Sorter!

## How It Works

### From User Perspective

1. User opens the app
2. Clicks the hamburger menu (≡) icon
3. Sees **"Support Developer"** option
4. Clicks it
5. Beautiful donation dialog appears with:
   - Explanation of how donations help
   - Your Lightning address: `devin@primal.net`
   - Copy-to-clipboard button
   - List of benefits from support
   - Grateful message

### Simple Flow
```
Hamburger Menu → Support Developer → See Lightning Address → Copy → Send Sats!
```

## What Information You Provided

✅ Lightning Address: `devin@primal.net`

This is perfect for receiving donations because:
- Fast (Lightning Network - instant)
- Low fees
- Simple for users (just copy-paste)
- Very Bitcoin-native
- Easy to use from mobile

## The Dialog

The donation dialog includes:

1. **Clear Title**: "Support Sat Sorter Development"
2. **Explanation**: Why donations help
3. **Lightning Address**: `devin@primal.net` with copy button
4. **Why Support?**:
   - Keep app free for everyone
   - Fund new features
   - Support maintenance
   - Help with infrastructure
5. **Appreciation**: "Every sat counts" message

## Features

✅ **Easy to Use**
- Click button → copy address → paste in wallet → send sats
- One-click copy-to-clipboard

✅ **Professional Design**
- Fits with app aesthetic
- Clear hierarchy
- Friendly tone

✅ **Separate Menu Items**
- "Support Developer" - helps Sat Sorter
- "Other Bitcoin Projects" - helps other open-source projects
- Both easily accessible from menu

## Technical Implementation

### Files Modified
- `src/components/budget/BudgetHeader.tsx`
  - Added "Support Developer" menu item
  - Created donation dialog with your Lightning address
  - Created separate dialog for other projects

### How Users Get the Address
1. Click hamburger menu
2. Click "Support Developer"
3. Dialog shows: `devin@primal.net`
4. Click "Copy Lightning Address" button
5. Address copied to clipboard
6. User pastes into their wallet
7. Sends any amount

## Menu Structure

```
Hamburger Menu (≡)
├── About Sat Sorter
├── Learn About Bitcoin
├── Support Developer ← NEW!
├── Other Bitcoin Projects ← NEW!
└── Backup & Sync
```

## Testing

### Test the Feature
1. Open app
2. Click hamburger menu (three horizontal lines)
3. Click "Support Developer"
4. Dialog appears with:
   - ✅ Your Lightning address visible
   - ✅ Copy button works
   - ✅ Clear instructions
   - ✅ Professional appearance

### Test Copy Button
1. Open donation dialog
2. Click "Copy Lightning Address"
3. Address should be in clipboard
4. Paste somewhere to verify

## Optional Enhancements (Future)

If you want to add more donation methods later:
- Bitcoin address (on-chain)
- Nostr Zap (needs your pubkey)
- Payment processors (if you choose)

For now, Lightning address is perfect!

## Benefits for You

✅ **Users can easily support development**
- Simple Lightning address
- One-click copy
- Professional interface
- Easy to share

✅ **Ongoing sustainability**
- Users who benefit can contribute
- Helps fund:
  - Server costs
  - Domain registration
  - Development time
  - New features

✅ **Professional appearance**
- Shows users you're serious about the project
- Gives supporters a clear way to help
- Easy to access from menu

## Commit Info

```
Commit: 1c531df
Message: Add developer donation feature to app menu
Files: 1 changed
```

---

**Status: READY** ✅

Users can now easily support Sat Sorter development!

Just click: Menu → Support Developer → Copy → Send Sats! 🎉

**Your Lightning Address**: devin@primal.net
