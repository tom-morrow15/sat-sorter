# Testing NWC Cloud Sync - Step by Step

This guide walks you through testing that your NWC wallet connections now sync across devices.

## Prerequisites

Before you start, make sure you have:
- A Nostr account (you can get one at primal.net, amethyst.social, or other Nostr clients)
- Alby Hub or another NWC-compatible wallet installed
- Access to at least 2 devices or browsers (desktop + iPhone, or 2 browsers)

## Step 1: Device 1 - Login to Sat Sorter

1. Go to **satsorter.com** on your first device (e.g., desktop)
2. Click **Log In** or **Sign Up** if needed
3. Connect your Nostr account
   - If you have a browser extension (Alby, nos2x, etc.), click "Sign in with Extension"
   - Or use your Nostr username/email if supported
4. Confirm you're logged in
   - You should see your Nostr profile name/avatar in the UI
   - Make note of your `npub` (shown as `npub1...` in settings)

## Step 2: Device 1 - Connect Your Wallet

1. Click **Settings** (⚙️ icon)
2. Find the **Wallet** or **NWC** section
3. Click **Connect Wallet** or **Add NWC Connection**
4. Scan/paste your Alby Hub NWC URI
   - In Alby Hub: Settings → Nostr Wallet Connect → Show URI
   - Copy the URI that starts with `nostr+walletconnect://`
5. Give it a name like "Alby Hub Desktop"
6. Click **Connect**
7. You should see a success message: "Wallet connected successfully"

**What's happening in the background:**
- Connection saved to browser localStorage (instant)
- Since you're logged into Nostr, it's also being encrypted and uploaded to Nostr relays
- Look at browser console (Ctrl+Shift+J) for: `[NWCSync] Sync complete` or `[NWC Debug] Saving connections`

## Step 3: Device 2 - Login with Same Nostr Account

Now switch to a different device or open a new browser:

1. Go to **satsorter.com** on your second device
2. Click **Log In**
3. **IMPORTANT**: Log in with the **SAME Nostr account** as Device 1
   - Must be the same `npub` / account
4. Wait 5-10 seconds for the app to load fully
5. **Watch for**: A notification that says
   - "Cloud sync: Restored 1 wallet connection" 
   - or similar message showing wallets were restored

## Step 4: Device 2 - Verify Wallet is Restored

1. Click **Settings** (⚙️ icon)
2. Go to **Wallet** or **NWC** section
3. **You should see your "Alby Hub Desktop" connection already listed!**
4. Try using it - it should work without any re-connection

**Success indicators:**
- ✅ Wallet name appears in the list
- ✅ Status shows "Connected" or similar
- ✅ Toast notification appeared on login
- ✅ No need to re-scan or re-enter the NWC URI

## Step 5: Check the Console Logs (For Debugging)

If the wallet didn't appear, check what happened in the console:

### On Device 2 (where you expected to see the wallet restored):

1. Open Browser Console:
   - **Desktop (Chrome/Firefox)**: Ctrl+Shift+J
   - **Safari on Mac**: Cmd+Option+J
   - **Safari on iPhone**: Settings → Safari → Advanced → Web Inspector (then connect from Mac)

2. Look for these logs (in order):
   ```
   [NWC] Downloading NWC connections from cloud...
   [NWC] Cloud query returned 1 connection events
   [NWC] Decrypting cloud connections...
   [NWC] Found 1 cloud connections
   [NWC] Adding cloud connection: Alby Hub Desktop
   ```

3. **If you see these logs → Success!** The wallet was synced from cloud

4. **If you see different logs:**

   - `Cloud query returned 0 connection events` → The upload didn't work
     - Check Device 1: Was the wallet saved?
     - Check Device 1 console for errors like `[NWCSync] Failed to upload`
   
   - `Cloud download skipped: hasUser: false` → You're not logged in
     - Make sure you logged in with Nostr on Device 2
   
   - `Failed to decrypt cloud connections` → Something is wrong with encryption
     - Make sure you're using the SAME Nostr account on both devices
     - Your private key must be the same (same npub = same key)

## Step 6: Test Adding a Second Wallet

Now test that new wallets also sync:

1. On Device 2, add a second wallet (if you have one) or create a test
2. Name it something unique like "Test Wallet 2"
3. Watch the console for: `[NWCSync] Sync complete`
4. Switch to Device 1 and reload the page
5. You should see "Test Wallet 2" appear in your wallet list

## Troubleshooting

### Wallet appears on Device 1 but not Device 2

**Check these:**
1. **Same Nostr Account?** 
   - Device 1 Settings: Check your npub
   - Device 2 Settings: Check your npub
   - They MUST match exactly

2. **Relays Connected?**
   - Make sure both devices can reach Nostr relays
   - Try Settings → Relays/Network to check connection status
   - Try adding a different relay if the default is slow

3. **Wait Longer**
   - Nostr syncs in the background
   - Wait 10-30 seconds on Device 2 before checking
   - Reload the page to force a fresh load

4. **Check Console**
   - Follow Step 5 above to see detailed logs
   - Look for error messages that explain what went wrong

### Wallet appears on both, but then disappears

**This might mean:**
1. **localStorage was cleared** - Browser cleared storage, but cloud sync will restore on reload
2. **Different tabs/incognito** - Make sure you're using normal tabs, not private/incognito
3. **Cloud sync delay** - Reload the page to trigger the download again

### Connection says "isConnected: false"

**This is fine:**
- It just means it hasn't validated the connection yet
- It will work when you try to use it
- The connection string is still valid

## Advanced: Reading the Cloud Data

If you're curious and want to see your encrypted cloud data:

1. Open a Nostr client like Primal or Amethyst
2. Search for events with kind `30079`
3. You'll see your encrypted wallet connections (you won't be able to read them - they're encrypted!)
4. This proves the data was uploaded to the cloud successfully

## Performance Notes

**Expected timings:**
- Upload to cloud: Happens within 1-2 seconds of adding a wallet
- Download from cloud: Happens within 5-10 seconds of login
- Display update: Immediate once connections are loaded

If uploads/downloads are taking 30+ seconds:
- Your relays might be slow
- Try checking Settings → Relays to add faster relays
- Or wait a bit longer and try again

## Success Checklist

After following these steps, you should be able to check off:

- [ ] Logged into same Nostr account on both devices
- [ ] Connected wallet on Device 1
- [ ] Saw "Cloud sync: Restored X wallet" on Device 2
- [ ] Wallet appears in Settings → Wallet on Device 2
- [ ] Can use the wallet on Device 2 without reconnecting
- [ ] Browser console shows successful cloud sync logs
- [ ] Added a new wallet on Device 2 and it synced back to Device 1

If all of these are checked ✅, your NWC cloud sync is working perfectly!

## Getting Help

If something still isn't working:

1. **Check the console logs** - They usually tell you exactly what went wrong
2. **Verify Nostr login** - Double-check you're logged in with the same account
3. **Try a different relay** - Slow relays can cause timeouts
4. **Reload the page** - Sometimes a fresh load helps
5. **Clear localStorage and retry** - As a last resort, clear everything and reconnect

Good luck! 🚀
