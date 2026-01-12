# NWC Cloud Sync Fix

## Issue Resolved
Your NWC (Alby Hub) wallet connections now sync across devices and browsers when you're logged into Nostr.

## How It Works

### The Problem
Previously, NWC connections were stored **only in browser localStorage**, which meant:
- Connecting on iPhone didn't save the connection for desktop
- Switching browsers required reconnecting
- No cross-device sync existed

### The Solution
NWC connections now have **automatic cloud sync** via Nostr:

1. **Connect Wallet on iPhone**
   - Connection saved to local storage
   - If logged into Nostr, automatically encrypted and published to Nostr relays
   - Uses NIP-44 encryption (only you can decrypt)

2. **Login on Desktop/Different Browser**
   - Automatically downloads your saved connections from Nostr
   - Decrypts them using your Nostr private key
   - Restores all your previously connected wallets
   - Toast notification shows "Cloud sync: Restored X wallet connection(s)"

3. **Subsequent Uses**
   - Whenever you add a new wallet, it syncs to cloud automatically
   - Open the app on any device/browser while logged in → your wallets are there

## Testing the Fix

### Setup on Device 1 (e.g., Desktop)
1. Open satsorter.com
2. Log in with Nostr
3. Go to Settings → Wallet
4. Connect your Alby Hub wallet
5. See it saved locally

### Test on Device 2 (e.g., iPhone)
1. Open satsorter.com on different browser/device
2. Log in with the **same Nostr account**
3. Wait 5-10 seconds
4. You should see: "Cloud sync: Restored 1 wallet connection"
5. Go to Settings → Wallet
6. Your Alby Hub connection should be there!

### What If It Doesn't Show Up?
Check the browser console (Ctrl+Shift+J on desktop, or use Safari Developer Tools on iPhone):
- Look for `[NWC] Downloading NWC connections from cloud...`
- Look for `[NWC] Found X cloud connections`
- If you see errors, make sure you're logged into Nostr with the correct account

## Technical Details

### Storage Mechanism
- **Local**: Browser localStorage (fast, instant access)
- **Cloud**: Nostr kind 30079 (encrypted application-specific data)
- **Encryption**: NIP-44 (your private key only)

### Automatic Behavior
- **Upload**: Triggers when you add/remove wallet connections (if logged in)
- **Download**: Triggers when you log into Nostr or reload the app
- **No Manual Action**: Everything happens automatically in the background

### Security
- Connection strings are **encrypted end-to-end** with NIP-44
- Only you can decrypt them (requires your Nostr private key)
- Nostr relays see only encrypted data
- No passwords or secrets transmitted unencrypted

## Compatibility

This fix works with:
- ✅ Alby Hub (recommended)
- ✅ Any NWC-compatible wallet
- ✅ Multiple wallet connections (all sync)
- ✅ Cross-device sync
- ✅ Cross-browser sync
- ✅ iOS, Android, Desktop

## Still Need Help?

If your NWC connection still isn't appearing on your iPhone:

1. **Check Nostr Login**: Make sure you're logged into the SAME Nostr account on both devices
   - Go to Settings → Nostr
   - Verify your npub matches on both devices

2. **Check Network**: Make sure both devices can reach Nostr relays
   - Check Settings → Git/Relays if available
   - Try a different relay if needed

3. **Check Console**: Look at browser console for errors
   - Desktop: Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac)
   - iPhone: Enable Safari Developer Tools in Settings → Safari → Advanced

4. **Manual Reconnect**: If cloud sync doesn't work automatically
   - Disconnect the wallet on iPhone Settings
   - Reconnect it (will sync again to cloud)

5. **Clear and Re-sync**:
   - Logout and login again to force cloud download
   - This will refresh the connection restore process
