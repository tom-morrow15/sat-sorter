# Quick Start: Setting Up Your Wallet

This guide walks you through setting up payment methods for automatic Lightning transaction tracking in Sat Sorter.

## The Easy Way: WebLN (Recommended for Most Users)

### What is WebLN?
WebLN is a browser standard that lets websites safely interact with your Lightning wallet. It's like how websites can access your camera or location - but for Lightning payments.

### Setup (3 steps)

1. **Install a WebLN-Compatible Extension**
   - **Alby** (recommended) → https://getalby.com
   - Nos2x → https://nos2x.com
   - Nostrich → https://nostrich.app

2. **That's it!**
   - Sat Sorter automatically detects WebLN wallets
   - No configuration needed
   - Your wallet is ready to use

3. **Verify It Works**
   - Open Sat Sorter
   - Tap the Lightning ⚡ button (bottom right)
   - You should see "WebLN wallet detected"

### Why WebLN?
✅ Auto-detects browser extensions
✅ Zero configuration needed
✅ Works with Alby, Nos2x, Nostrich, and more
✅ Fastest connection method
✅ No keys needed to share

---

## Self-Hosted: LNbits Setup

### What is LNbits?
LNbits is a lightweight Lightning wrapper that lets you manage Lightning wallets easily. You can run it on your own server or use a public instance.

### Setup (3 steps)

1. **Get Your LNbits URL and Admin Key**
   - If using public: https://demo.lnbits.com
   - If self-hosted: Your own domain
   - Admin key: Found in Settings → API Keys → Admin Key (starts with `sk_`)

2. **Enter in Sat Sorter**
   - Open Lightning Wallet modal
   - Click Settings (⚙️) icon
   - Switch to "LNbits" tab
   - Enter URL: `https://your-lnbits.com`
   - Enter Admin Key: `sk_live_...`
   - Click "Test & Connect"

3. **Done!**
   - Once tested, your LNbits wallet is ready
   - Transactions sync automatically

### Example Configuration
```
URL: https://lnbits.example.com
Admin Key: sk_live_abc123def456...
```

---

## Power Users: Direct Node API

### What is This?
Connect directly to your Lightning node for maximum control. Supported nodes:
- **LND** (Lightning Network Daemon)
- **C-Lightning** (RBF-compatible Lightning)
- **Eclair** (Scala-based)

### Setup for LND (Most Common)

1. **Get Your Macaroon**
   ```bash
   # Run this on your node server
   cat ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon | base64
   ```
   This gives you a long base64 string - copy it.

2. **Get Optional TLS Certificate**
   ```bash
   # Also optional but more secure
   cat ~/.lnd/tls.cert | base64
   ```

3. **Enter in Sat Sorter**
   - Open Lightning Wallet modal
   - Click Settings (⚙️) icon
   - Switch to "Node" tab
   - Select: "LND (Lightning Network Daemon)"
   - Host: `localhost` (or your node IP)
   - Port: `10009`
   - Macaroon: Paste the base64 string
   - TLS Cert: (optional) Paste the certificate
   - Click "Configure & Connect"

4. **Done!**
   - Your node is now connected
   - You have full control over payments

---

## Payment Method Priority

Sat Sorter automatically uses the best available method in this order:

```
1. NWC (Nostr Wallet Connect)    ← Highest priority
2. WebLN (Browser Extensions)
3. LNbits (Self-hosted)
4. Direct Node API (Your node)
5. Manual Entry                   ← Fallback
```

If NWC is connected, it will be used first. If it fails, WebLN takes over, and so on.

---

## Troubleshooting

### "WebLN wallet detected" but payments aren't working
- Make sure Alby (or your extension) is unlocked
- Try refreshing the page
- Check that the extension has permission for the Sat Sorter domain

### LNbits connection test fails
- Double-check URL (include https://)
- Verify admin key is correct (starts with `sk_`)
- Try without the trailing `/` in URL
- Check network connectivity

### Node connection fails
- Verify host is reachable (use `ping` or `curl`)
- Check port is correct (default 10009 for LND)
- Macaroon must be base64 encoded (not binary)
- TLS cert is only needed if required by your node

### Multiple wallets configured - which one is used?
- Sat Sorter uses the highest priority available
- See "Payment Method Priority" above
- To use a different method, disconnect the others temporarily

---

## Frequently Asked Questions

### Connection & Setup Questions

#### How do I know which connection method to use?
Start with this decision tree:
- **Have Alby installed?** → Use WebLN (easiest!)
- **Running your own Lightning node?** → Use Direct Node (most control)
- **Want to self-host?** → Use LNbits (flexible)
- **Don't have any of the above?** → Use Manual Entry (always works)

#### What's the difference between NWC and WebLN?
- **NWC (Nostr Wallet Connect):** Uses a URI string, more complex setup, highly secure
- **WebLN:** Browser extension, simpler, auto-detected, recommended for most users
- **Bottom line:** Both work great. WebLN is easier if you have Alby.

#### Can I use multiple wallets at the same time?
Yes! You can configure:
- NWC + WebLN
- LNbits + Direct Node
- Any combination really

Sat Sorter tries them in priority order and uses the first available one. If your primary wallet fails, it automatically falls back to the next method.

#### What if I want to switch from one method to another?
Easy! Just open the Lightning Wallet modal, click Settings (⚙️), and:
- Configure the new method in its tab
- Test the connection
- That's it! The new method becomes available

You can keep both active or disconnect the old one - your choice.

#### Which method is most secure?
All three are secure:
- **WebLN:** Keys stay in your browser extension (Alby, Nos2x, etc.)
- **LNbits:** Keys stay on your server (if self-hosted)
- **Direct Node:** Macaroon is restricted (can't spend more than configured)

Choose based on what you control and trust.

#### Is my wallet key stored safely?
**WebLN & LNbits:** Yes. Keys never leave your browser or node. Sat Sorter never sees them.
**Direct Node:** Your macaroon is stored in browser localStorage (encrypted in lockdown mode).
**NWC:** Connection URI is encrypted in localStorage.

### General Questions

#### Can I use multiple wallets?
Yes! Configure as many as you want. Sat Sorter automatically uses the best one available.

#### What if my internet goes down?
Transactions enter "Manual Entry" mode. You can record them and sync later.

#### Can I change methods later?
Yes! Click Settings (⚙️) anytime to reconfigure or switch methods. No need to delete old configurations - Sat Sorter will use the first available one.

#### Is there a way to test my connection?
Yes! Each method has a "Test & Connect" button. Use it before saving to verify everything works. This way you know it's working before you rely on it.

#### What does "Browser extension" mean?
Browser extensions are small programs that live in your browser. Examples:
- **Alby** (recommended)
- **Nos2x**
- **Nostrich**

They provide a wallet in your browser and handle Lightning payments safely.

#### I have Alby but WebLN still says "Not Found" - why?
This can happen if:
- Alby is locked (unlock it and refresh the page)
- Alby wasn't given permission for this website (check Alby settings)
- You're using a private/incognito window (extensions often don't work there)

Try refreshing the page after unlocking Alby.

#### Can I use this on mobile?
Yes! But:
- **WebLN:** Only on mobile if you're using a browser with an installed Lightning wallet (like Alby on Firefox Android)
- **LNbits:** Works great on mobile
- **Direct Node:** Works on mobile (need your node accessible from internet)
- **Manual Entry:** Always works

---

## Connection Type Deep Dive

### WebLN (Browser Extensions)

**What it is:**
A browser standard that lets websites safely access your Lightning wallet. Think of it like how websites can access your camera or location.

**Setup:**
1. Install Alby (or Nos2x/Nostrich) from your browser's extension store
2. Create an account or import existing wallet
3. Sat Sorter automatically detects it

**Pros:**
- ✅ Zero configuration in Sat Sorter
- ✅ Auto-detection on launch
- ✅ Works across all sites supporting WebLN
- ✅ Very user-friendly

**Cons:**
- ❌ Requires installing a browser extension
- ❌ Only works in one browser (unless installed in multiple)
- ❌ Limited to devices where extension is available

**Best For:**
- Users who want zero setup
- Users who already use Alby for other apps
- Desktop users (easier to install extensions)

**Cost:**
Free (Alby has optional premium features, but basic WebLN is free)

**Security:**
Your keys stay in Alby. Sat Sorter never sees them. When you approve a payment, Alby signs it.

---

### LNbits (Self-Hosted)

**What it is:**
A lightweight Lightning wrapper that lets you manage a Lightning wallet easily. You can run it on your own server or use a public instance.

**Setup:**
1. Get a LNbits instance (your own or public like demo.lnbits.com)
2. Create a wallet
3. Get the admin key (starts with `sk_`)
4. Enter URL + key in Sat Sorter's LNbits tab
5. Click "Test & Connect"

**Pros:**
- ✅ Full control over your funds
- ✅ Self-hostable for privacy
- ✅ Works on any device with internet
- ✅ More features than WebLN
- ✅ Can be run on humble servers (Raspberry Pi, etc.)

**Cons:**
- ❌ More setup required
- ❌ Need to secure your server
- ❌ Public instances are still centralized (risk of downtime)

**Best For:**
- Users running Lightning infrastructure
- Self-hosted enthusiasts
- Users who want full control
- People who prefer privacy

**Cost:**
Free to self-host, or free with public instances

**Security:**
If self-hosted: Your keys are on your server. If using public: Same as giving someone your keys.

**Recommendation:**
Self-host if possible. Or use a public instance only for smaller amounts you're okay with losing.

---

### Direct Node API (LND, C-Lightning, Eclair)

**What it is:**
Direct connection to your own Lightning node. Maximum control and security.

**Setup:**

**For LND:**
```bash
# 1. SSH into your node
ssh user@your-node

# 2. Get the admin macaroon
cat ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon | base64

# 3. Optionally get TLS cert
cat ~/.lnd/tls.cert | base64

# 4. In Sat Sorter:
# - Node Type: LND
# - Host: localhost (or your node IP)
# - Port: 10009
# - Macaroon: paste base64 string
# - TLS Cert: optional but recommended
# - Click "Configure & Connect"
```

**For C-Lightning:**
```bash
# Similar process but:
# - Port: Usually 9735
# - No macaroon needed (just host + port)
```

**For Eclair:**
```bash
# Similar to LND but:
# - Check Eclair docs for exact config location
# - Usually needs TLS cert
```

**Pros:**
- ✅ Maximum security (direct node access)
- ✅ Maximum control
- ✅ No third parties
- ✅ Works offline if on local network
- ✅ Supports multiple node types

**Cons:**
- ❌ Requires running a Lightning node (complex)
- ❌ Need technical knowledge
- ❌ Node must be accessible from your device
- ❌ Complex setup and maintenance

**Best For:**
- Lightning node operators
- Power users
- People running their own infrastructure
- Maximum security seekers

**Cost:**
Free (but you're running a node, so cost of hardware/hosting)

**Security:**
Your keys never leave your node. Macaroon is restricted and read-only. Best possible security.

**Recommendation:**
Only use if you're already running a Lightning node. Not recommended for beginners.

---

### NWC (Nostr Wallet Connect)

**What it is:**
Nostr-based wallet connection using a connection URI. More secure than browser storage.

**Setup:**
1. Get connection URI from your wallet app
2. Scan QR code or paste URI
3. Approve in wallet app
4. Done!

**Pros:**
- ✅ Very secure (URI expires)
- ✅ Can specify permissions
- ✅ Works with Nostr wallets
- ✅ Supports multiple wallets

**Cons:**
- ❌ Requires compatible wallet
- ❌ One time setup per device
- ❌ Connection string to copy/paste

**Best For:**
- Nostr-native users
- Power users who want fine-grained permissions
- Wallet operators

**Cost:**
Free

**Security:**
Connection URI is specific to this app. Can be revoked anytime. Very secure.

---

## Connection Priority Explained

When you have multiple methods configured, Sat Sorter tries them in this order:

```
1. NWC              (Most specific, highest security)
2. WebLN            (Fast, auto-detected)
3. LNbits           (Flexible, self-hostable)
4. Direct Node      (Maximum control)
5. Manual Entry     (Always works)
```

**Why this order?**
- NWC is most secure and specific
- WebLN is fast for most users
- LNbits is good middle ground
- Direct Node gives maximum control
- Manual is the ultimate fallback

**Example scenarios:**

*Scenario 1: Have NWC + WebLN*
- App tries NWC first
- If NWC fails → tries WebLN
- WebLN works ✅

*Scenario 2: Have WebLN + LNbits*
- App tries WebLN first
- WebLN is down → tries LNbits
- LNbits works ✅

*Scenario 3: All configured*
- Tries in priority order
- Uses first available
- Completely transparent to you ✅

---

## Next Steps

1. **Choose your method:** WebLN (easiest) or LNbits/Node (more control)
2. **Follow the setup steps** above
3. **Test the connection** before relying on it
4. **Start using it:** Your transactions will sync automatically!

Need help? See the full documentation: `WALLET_INTEGRATION_IMPROVEMENTS.md`
