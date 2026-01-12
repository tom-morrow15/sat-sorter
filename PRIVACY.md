# Privacy Policy

**Last updated: January 2026**

## TL;DR

**We don't collect, store, or have access to your data. Period.**

Sat Sorter is designed from the ground up to be privacy-first. Your financial data belongs to you and only you.

---

## How Sat Sorter Works

### Local-First Architecture

Sat Sorter is a **client-side application** that runs entirely in your web browser. There is no Sat Sorter server that processes or stores your data.

- **All data is stored locally** in your browser's storage (localStorage/IndexedDB)
- **No account required** — you can use the app without logging in
- **Works offline** — once loaded, the app works without an internet connection

### What We DON'T Collect

- ❌ **No personal information** — we don't ask for email, name, or any identifying info
- ❌ **No financial data** — we never see your income, expenses, or transactions
- ❌ **No analytics or tracking** — no Google Analytics, no Mixpanel, no telemetry
- ❌ **No cookies for tracking** — we use browser storage only for your data
- ❌ **No third-party data sharing** — there's nothing to share because we have nothing

### Verification

Since Sat Sorter is **100% open source**, you can verify these claims yourself:

1. **View the source code** — Every line is available for inspection
2. **Check network requests** — Open your browser's DevTools and see that no data is sent to external servers
3. **Search the codebase** — Look for "analytics", "tracking", or "telemetry" — you won't find any

---

## Optional Cloud Sync (Nostr)

If you choose to log in with Nostr, you can sync your budget across devices. Here's how it works:

### How Nostr Sync Works

1. **Your data is encrypted** using NIP-44 encryption with YOUR Nostr private key
2. **The encrypted blob is published** to Nostr relays (which you can choose)
3. **Relays cannot read your data** — they only see encrypted ciphertext
4. **Only you can decrypt it** — your private key never leaves your device

### Technical Details

- **Encryption**: NIP-44 (ChaCha20-Poly1305 based)
- **Event kind**: 30078 (NIP-78 Application-specific data)
- **Identifier**: `sat-sorter/budget-data`
- **Key derivation**: Self-encryption (encrypted to your own pubkey)

### What Relays See

```
{
  "kind": 30078,
  "pubkey": "your-public-key",
  "content": "AQI...encrypted-binary-data...",
  "tags": [["d", "sat-sorter/budget-data"]]
}
```

The `content` field is encrypted ciphertext that only your private key can decrypt.

---

## Wallet Connections (NWC)

If you connect a Lightning wallet via Nostr Wallet Connect (NWC):

- **Direct connection** — Data flows directly from your wallet to your browser
- **No intermediary** — Sat Sorter does not proxy or store wallet data
- **Your keys** — The NWC connection string stays in your browser's local storage
- **Transaction data** — Imported transactions are stored locally, never sent anywhere

---

## Third-Party Services

Sat Sorter connects to the following external services:

### Bitcoin Price Data
- **Service**: CoinGecko API (via proxy)
- **Data sent**: None (read-only price request)
- **Purpose**: Display sats/USD conversion rates

### Nostr Relays (optional)
- **Service**: User-selected Nostr relays
- **Data sent**: Encrypted budget data (only if logged in)
- **Purpose**: Cross-device sync

### BTCMap (optional)
- **Service**: BTCMap API
- **Data sent**: Approximate location (if enabled)
- **Purpose**: Show nearby Bitcoin-accepting merchants

---

## Your Rights

You have complete control over your data:

- **Export** — Download your budget data anytime (Menu → Export & Backup Data)
- **Delete** — Clear your browser's local storage to delete all data
- **Portability** — Your data is in standard JSON format
- **Self-hosting** — Run your own instance of Sat Sorter

---

## Contact

If you have privacy concerns or questions:

- **Nostr**: [npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg](https://primal.net/p/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg)
- **Source Code**: Review the codebase yourself

---

## Summary

| Question | Answer |
|----------|--------|
| Do you collect my data? | **No** |
| Do you have access to my budget? | **No** |
| Do you use analytics/tracking? | **No** |
| Can you see my transactions? | **No** |
| Is cloud sync encrypted? | **Yes**, with YOUR keys |
| Can relays read my data? | **No**, it's encrypted |
| Is the code open source? | **Yes**, MIT licensed |

**Your sats. Your budget. Your privacy.**
