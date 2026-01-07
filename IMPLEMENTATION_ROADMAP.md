# Sat Sorter Implementation Roadmap

## Priority Issues to Address

### 🔴 HIGH PRIORITY (Breaking Issues)

#### 1. Mobile Dialog Scrolling Issues (Location & NWC)
**Problem**: Both Location and NWC dialogs scroll/disconnect when keyboard opens on mobile
**Current**: Uses Drawer component from bottom, still connected to scrollable content
**Solution**: Implement as modal Dialog with fixed positioning, like TransactionPanel
**Status**: Not started
**Files**: 
- `src/components/budget/LocationSetup.tsx`
- `src/components/budget/LocationSettingsDialog.tsx`
- `src/components/budget/WalletModalControlled.tsx`

#### 2. BTCMap Refresh Button Not Working
**Problem**: Refresh button triggers but doesn't actually reload merchants
**Current**: `forceRefetch()` in useBTCMap tries to invalidate cache but may have issues
**Status**: Needs debugging
**Files**: `src/hooks/useBTCMap.ts`

#### 3. Nostr Cloud Sync Not Working
**Problem**: Changes on one device don't sync to another device
**Current**: Uses NIP-78 (application-specific data) with NIP-44 encryption
**Root Cause**: Likely not actually saving/loading data, or encryption/decryption issues
**Status**: Needs investigation and testing
**Files**: `src/hooks/useBudgetSync.ts`, `src/components/budget/WalletModalControlled.tsx`

### 🟡 MEDIUM PRIORITY (Feature Requests)

#### 4. Zap Donations Feature
**Problem**: Users can't zap/donate to app developer
**Solution**: Implement Zap UI (already has ZapButton, ZapDialog components)
**Status**: Not started
**Implementation**: Add to sidebar or settings with fixed pubkey

#### 5. Nostr QR Code Login (Signer Device)
**Problem**: No QR code login for signing devices
**Current**: LoginArea exists but doesn't support QR login flow
**Status**: Needs investigation
**Related**: NIP-46 (Nostr Connect)

### 🟢 LOW PRIORITY (Not Yet Implemented)

#### 6. Monitor Bitcoin Address (Savings Wallet)
- Requires on-chain API integration (probably BlockChain.com or mempool.space)
- Show balance, ability to hide with shake gesture

#### 7. Umbrel App Packaging
- Package as Umbrel app for self-hosted deployment

#### 8. Keychat Integration
- Mini app integration with Keychat

#### 9. Cashu/eCash Integration
- Connect Cashu wallets, track ecash spending
- Would need Nutstack template instead

#### 10. On-Chain Wallet Tracking
- Monitor on-chain addresses for transactions
- Requires blockchain API integration

#### 11. Dual Login (Shared Budget)
- Allow two Nostr accounts to access same budget
- Probably needs NIP-26 delegation or shared relay management

#### 12. AI Spending Analysis
- Integrate with Routstr or PayPerQ for anonymous AI insights
- Probably has privacy implications

---

## Implementation Order

1. **First**: Fix mobile dialog scrolling (critical UX issue)
2. **Second**: Debug and fix BTCMap refresh button
3. **Third**: Fix Nostr cloud sync (feature depends on this)
4. **Fourth**: Add Zap donations feature
5. **Fifth**: Add QR code Nostr login
6. **Then**: Implement other features as requested

---

## Notes

### Mobile Dialog Architecture
The TransactionPanel works well because it's likely a Dialog component with fixed positioning, not a Drawer that's still connected to the scrollable page content. The Location and NWC dialogs should use the same pattern.

### Cloud Sync Architecture
Current approach uses:
- NIP-78 (Application-specific data): kind 30078
- NIP-44 (Encryption): encrypt/decrypt to self
- NIP-65 (Relay management): for where data is stored

Testing needed:
1. Check if events are actually being published
2. Check if decryption is working
3. Check if relay configuration allows writing
4. Test across different devices/browsers

### Nostr QR Login
Would need to implement NIP-46 (Nostr Connect) which allows signing via QR code from external devices. Requires:
1. QR code generation for auth request
2. Handling NCP (Nostr Connect Protocol) responses
3. Session management for signer device

### Zap Integration
The project already has:
- `ZapButton` component
- `ZapDialog` component
- `useZaps` hook
- `useWallet` hook for Lightning

Just needs:
1. Fix pubkey for donation recipient
2. Place in UI (sidebar, settings, or header)
3. Optional: configure amount suggestions
