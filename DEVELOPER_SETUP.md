# Developer Setup & Configuration Guide

## Quick Configuration

### Setting Up Zap Donations

Sat Sorter is a great app, and users should be able to support its development. Here's how to set up zap donations:

#### Step 1: Get Your Nostr Pubkey
You'll need your Nostr public key (npub or hex format).

- Get your hex format pubkey from any Nostr client or NIP-05 provider
- Example: `ee38ae16af08d28aa8a6af4d0b238acd3bc648d526b32de4e43aeb3855623a82`

#### Step 2: Update BudgetHeader.tsx
Find this line in `src/components/budget/BudgetHeader.tsx`:

```typescript
// App developer's pubkey for donations - will be set by project maintainer
// For now, we'll note that this should be configured
const DEVELOPER_PUBKEY = ''; // TODO: Replace with actual developer pubkey for zaps
```

Replace the empty string with your pubkey:

```typescript
const DEVELOPER_PUBKEY = 'ee38ae16af08d28aa8a6af4d0b238acd3bc648d526b32de4e43aeb3855623a82';
```

#### Step 3: Uncomment Zap Button (When Implemented)
Once the Zap feature is fully implemented, uncomment this in the menu:

```typescript
// In DropdownMenuContent, add:
<DropdownMenuItem onClick={() => setShowDonate(true)}>
  <Heart className="h-4 w-4 mr-2" />
  Support Developer
</DropdownMenuItem>
```

---

## Environment Configuration

### Relay Configuration
Cloud sync stores data on Nostr relays. Users can configure which relays to use.

Default relays (from AppProvider):
```typescript
const relays = [
  'wss://relay.ditto.pub',
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
];
```

Users can change these in Settings > Relay Settings

### Lightning Network Configuration
NWC (Nostr Wallet Connect) allows automatic transaction tracking.

Default wallets supported:
- Alby
- Zeus
- Primal
- Any wallet supporting NWC

### API Configuration
BTCMap uses the public API (`https://api.btcmap.org/v2/elements`)
- No API key required
- Rate limited (but generous)
- Caches locally for 30 minutes

---

## Customization Guide

### Changing Default Values

#### Default Location Search Radius
File: `src/hooks/useBTCMap.ts`
```typescript
const DEFAULT_LOCATION_SETTINGS: LocationSettings = {
  // ...
  radiusMiles: 25, // Change this number
};
```

#### Default Currency
File: `src/pages/Budget.tsx`
```typescript
// Users can toggle, but you can change the default here
```

#### Default Relay Configuration
File: `src/components/AppProvider.tsx`
```typescript
const defaultConfig: AppConfig = {
  relayMetadata: {
    relays: [
      // Add/remove relays here
    ],
  },
};
```

---

## Testing Cloud Sync

### Prerequisites
- Nostr account (get one at primal.net, nos.lol, or use a signing extension)
- Two browsers/devices to test on

### Test Scenario 1: Basic Sync
1. **Device A**: Log in with Nostr, create budget, add some transactions
2. **Device B**: Log in with same Nostr account
3. **Result**: Budget should appear on Device B without manual sync
4. **Success**: Both devices show identical budget

### Test Scenario 2: Automatic Updates
1. **Device A**: Edit a transaction amount
2. **Watch Device A header**: Should show "Syncing..." → "Synced!"
3. **Switch to Device B**: Refresh the page or wait for auto-sync
4. **Result**: Changes should appear on Device B

### Test Scenario 3: Multiple Devices
1. **Device A, B, C**: All logged in with same Nostr account
2. **Device A**: Add a new expense category
3. **Result**: Should sync to B and C within 1-2 seconds (depending on network)

### Test Scenario 4: Poor Connection
1. **Device A**: Disconnect internet (or enable airplane mode after login)
2. **Make changes**: Add transactions, create buckets, etc.
3. **Reconnect**: Turn internet back on
4. **Result**: Changes should sync to cloud (may take a few seconds)

---

## Troubleshooting

### Cloud Sync Not Working

#### Check 1: User is Logged In
```typescript
// In Browser console:
// Should NOT be null
window.location.pathname // Should show /budget (not /login)
```

#### Check 2: Relays Are Connected
User can check Settings > Relay Settings to see configured relays

#### Check 3: NIP-44 Support
User's signer must support NIP-44 encryption
- Alby: ✅ Supported
- Primal: ✅ Supported
- Extension signers: ✅ Usually supported

#### Check 4: Browser Console
Open DevTools (F12) and check for errors:
```javascript
// Should see:
// "[Budget] Loaded budget from cloud"
// or
// "[Budget] Budget synced to cloud"
```

### Mobile Dialogs Not Working

#### Check 1: Is it a Dialog or Drawer?
The Location and NWC dialogs should use `<Dialog>`, not `<Drawer>`

#### Check 2: Fixed Positioning
Mobile dialogs should have `max-h-[90vh]` to prevent scrolling

#### Check 3: Keyboard Behavior
Test on actual mobile device (not just browser emulator)
- Different Android/iOS keyboards behave differently

---

## Deployment Considerations

### Before Production Release

- [ ] Set developer pubkey for zap donations
- [ ] Test cloud sync thoroughly on real devices
- [ ] Test mobile dialogs on real phones (iOS and Android)
- [ ] Document any relay requirements
- [ ] Update README with new features
- [ ] Add troubleshooting guide to docs

### Performance Considerations

**Cloud Sync**:
- Debounced to 1 second (prevents excessive syncing)
- Only syncs when budget changes (not on every keystroke)
- ~1-2KB encrypted JSON per sync

**BTCMap**:
- Fetches ~12KB of merchant data
- Caches for 30 minutes
- Filters locally (no server-side filtering)

**Memory Usage**:
- Budget data: ~5-100KB depending on months/transactions
- Merchant cache: ~12KB
- Total typical usage: <500KB

---

## Contributing & Maintenance

### Code Style
- Uses TypeScript for type safety
- Follows React hooks patterns
- Uses Tailwind CSS for styling
- Uses shadcn/ui for components

### Adding New Features
1. Check Nostr protocol (NIPs) for relevant standards
2. Use existing patterns (hooks + components)
3. Add tests if modifying critical paths
4. Document new configuration options
5. Update this guide

### Reporting Issues
Include:
- Device type (mobile/desktop)
- Browser type
- Steps to reproduce
- Expected vs. actual behavior
- Browser console errors

---

## Security Checklist

- [ ] Never store private keys in code
- [ ] Always use NIP-44 for sensitive data
- [ ] Validate user inputs
- [ ] Sanitize Nostr event data
- [ ] Use HTTPS for all external API calls
- [ ] Test encryption/decryption thoroughly
- [ ] Document security considerations
- [ ] Keep dependencies updated

---

## Resources

- **Nostr Protocol**: https://github.com/nostr-protocol/nips
- **NIP-78** (Encrypted App Data): https://github.com/nostr-protocol/nips/blob/master/78.md
- **NIP-44** (Encryption): https://github.com/nostr-protocol/nips/blob/master/44.md
- **NIP-65** (Relay Configuration): https://github.com/nostr-protocol/nips/blob/master/65.md
- **BTCMap API**: https://api.btcmap.org
- **Nostr Tools**: https://github.com/nbd-wtf/nostr-tools

---

## Getting Help

If you need help with Sat Sorter development:
1. Check the documentation files in this repo
2. Review existing code patterns
3. Check Nostr NIPs for protocol questions
4. Test thoroughly before releasing changes
