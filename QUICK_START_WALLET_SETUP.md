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

### Is my wallet key stored safely?
**WebLN & LNbits:** Yes. Keys never leave your browser or node. Sat Sorter never sees them.  
**Direct Node:** Your macaroon is stored in browser localStorage (encrypted in lockdown mode).

### Can I use multiple wallets?
Yes! Configure as many as you want. Sat Sorter automatically uses the best one available.

### What if my internet goes down?
Transactions enter "Manual Entry" mode. You can record them and sync later.

### Can I change methods later?
Yes! Click Settings (⚙️) anytime to reconfigure or switch methods.

### Is there a way to test my connection?
Yes! Each method has a "Test & Connect" button. Use it before saving to verify everything works.

---

## Next Steps

1. **Choose your method:** WebLN (easiest) or LNbits/Node (more control)
2. **Follow the setup steps** above
3. **Test the connection** before relying on it
4. **Start using it:** Your transactions will sync automatically!

Need help? See the full documentation: `WALLET_INTEGRATION_IMPROVEMENTS.md`
