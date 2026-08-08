# Security

This document describes Sat Sorter's security architecture, the protections in place, and the known limitations that users should be aware of.

## Architecture Overview

Sat Sorter is a **client-side-only** application. There are no servers. All data lives in your browser (localStorage + IndexedDB) and on Nostr relays (encrypted). Your private keys never leave your device.

### Data Flow

```
User input → localStorage (encrypted with device key) → IndexedDB (NIP-49 encrypted session)
                                                    ↘ Nostr relays (NIP-44 encrypted events)
```

## Cryptographic Primitives

### Private Key Generation
- **Mnemonic**: BIP39 with 128 bits of entropy (12 words), generated via `crypto.getRandomValues()` — the browser's CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- **Derivation**: BIP32 hierarchical deterministic derivation using NIP-06 path `m/44'/1237'/0'/0/0` (Nostr key derivation)
- **Curve**: secp256k1 via `@bitcoinerlab/secp256k1` (Bitcoin's elliptic curve)
- **Encoding**: bech32 (nsec/npub format) via `@scure/base`

### Key Encryption at Rest (Session Store)
- **Algorithm**: NIP-49 ncryptsec format
- **Key derivation**: scrypt (N=2^16, r=8, p=1) with a random 16-byte salt
- **Encryption**: XChaCha20-Poly1305 with a random 24-byte nonce
- **Storage**: IndexedDB (not localStorage) — harder to scrape than localStorage
- **Password**: Random 32-byte hex string generated per-session via `crypto.getRandomValues()`

### Budget Data Encryption (Nostr Sync)
- **Algorithm**: NIP-44 (ChaCha20 + HKDF-SHA256 + HMAC)
- **Conversation key**: Derived from the budget keypair (not the user's personal key)
- **Storage**: Nostr relays store encrypted events; only budget partners can decrypt

### NWC Connection Strings
- **Encryption**: XChaCha20-Poly1305 with the device key
- **Storage**: localStorage (encrypted) — these contain wallet authorization secrets
- **Validation**: Only `nostr+walletconnect://` and `nostrwalletconnect://` URIs are accepted

### API Keys (Maple/PPQ)
- **Encryption**: XChaCha20-Poly1305 with the device key
- **Storage**: localStorage (encrypted)
- **Migration**: Legacy hardcoded-secret format (ncryptsec1:) is auto-migrated on first load

### Device Encryption Key
- **Generation**: Random 32 bytes via `crypto.getRandomValues()`
- **Storage**: IndexedDB (not localStorage)
- **Scope**: Per-device, per-origin — clearing browser data generates a new key

## What We Protect Against

### ✅ Browser Extension Scraping
Sensitive data in localStorage (budget nsec, NWC connection strings, API keys) is encrypted with the device key. An extension that reads localStorage sees ciphertext, not plaintext.

### ✅ XSS (Cross-Site Scripting)
- React's JSX escapes all content by default — no `dangerouslySetInnerHTML` except the chart component which generates CSS (not HTML)
- No `eval()`, `Function()`, `innerHTML`, or `document.write()` anywhere in the codebase
- User input is never injected into HTML

### ✅ Input Validation
- NWC URIs are validated against the expected protocol prefix
- Nostr pubkeys are validated and normalized (npub → hex conversion)
- File uploads are validated for type (images only) and size (5MB max)
- Amount inputs use `type="number"` with `inputMode="decimal"` and `min="0"`

### ✅ Network Security
- All API calls use HTTPS
- Nostr relays communicate over WSS (WebSocket Secure)
- No sensitive data is transmitted in URLs (all in request bodies or encrypted event content)
- Budget data is encrypted with NIP-44 before being sent to relays

### ✅ Budget Partner Security
- Shared budget nsec is encrypted per-partner using NIP-44 before being sent as an invite
- Budget events are signed and encrypted with the budget keypair (not individual user keys)
- Only budget partners hold the budget nsec — even the app can't decrypt budget data without it
- Invites verify the budget npub matches the decrypted nsec before storing

### ✅ Zaps and Payments
- Lightning invoices are validated as strings before being passed to the wallet
- Payment amounts are validated (must be > 0)
- NWC payments use the active connection's client (created from the connection string, never stored in state)
- Payment timeouts prevent hanging (15 seconds)
- The zap endpoint URL is fetched from the author's Nostr profile (kind 0 metadata), not from user input

## Known Limitations (By Design)

### ⚠️ NostrLoginProvider stores nsec in localStorage
When a user signs in with an nsec, Nostrify's `NostrLoginProvider` stores the raw private key in localStorage (under the key `nostr:login`). This is required for Nostr event signing — the signer needs the key to sign events.

**Mitigation:**
- The key is also encrypted in IndexedDB via NIP-49 (sessionStore), which serves as a backup if localStorage is cleared
- localStorage is cleared on sign-out (`removeLogin` + `clearSession`)
- We recommend NIP-07 browser extensions for high-value keys — they store keys in a separate security context and never expose the raw secret to the page

**Why we can't fully eliminate this:** Nostr signing requires the raw key. The alternative is NIP-07 extensions, which handle signing in a separate security context. We support both — the extension is the safer option.

### ⚠️ Auto-login password stored in IndexedDB
The session password (used to decrypt the ncryptsec) is stored alongside the encrypted key in IndexedDB. This enables auto-login without prompting the user each time.

**Mitigation:**
- The password is randomly generated per session and never exposed in localStorage
- IndexedDB is harder to scrape than localStorage (requires explicit API access)
- Users who need stronger security should use NIP-07 extensions instead of nsec logins

### ⚠️ Device encryption key is extractable
The device key (used to encrypt localStorage data) is stored in IndexedDB. An attacker with full browser access can extract it.

**Mitigation:**
- The key is generated per-device and never leaves the device
- This prevents casual localStorage scraping (the primary attack vector for browser extensions)
- For maximum security, users should use NIP-07 extensions for their keys

### ⚠️ Budget data is encrypted but events are public
Nostr relays can see the metadata (kind, tags, timestamps, pubkey) of budget events. They cannot see the content (encrypted with NIP-44).

**Mitigation:**
- Content is always encrypted before publishing
- Tags are minimal (only `d`, `alt`, `t` — no financial data in tags)
- The budget keypair is separate from personal identities, providing additional privacy

## Dependencies

All cryptographic dependencies are well-audited, widely-used libraries:

| Library | Purpose | Source |
|---------|---------|--------|
| `bip39` | Mnemonic generation | bitcoinjs |
| `bip32` | HD key derivation | bitcoinjs |
| `@bitcoinerlab/secp256k1` | Elliptic curve operations | bitcoinerlab |
| `@noble/hashes` | scrypt, SHA-256 | noble |
| `@noble/ciphers` | XChaCha20-Poly1305 | noble |
| `@scure/base` | bech32 encoding | scure |
| `nostr-tools` | NIP-19, NIP-44, NIP-57 | nostr-tools |
| `@nostrify/nostrify` | Nostr protocol client | nostrify |
| `@getalby/sdk` | NWC (Nostr Wallet Connect) | getalby |

## Responsible Disclosure

If you discover a security vulnerability, please report it responsibly. Do not open a public issue. Instead, contact the maintainers directly.

## Recommendations for Users

1. **Use NIP-07 extensions for high-value keys** — Browser extensions (nos2x, Alby, etc.) store your private key in a separate security context and never expose it to the page.

2. **Download your backup phrase** — When creating an account, always download your 12-word seed phrase and store it securely offline. This is the only way to recover your account.

3. **Don't use the same key for high-value and low-value purposes** — If your Nostr key has Bitcoin funds, consider using a separate key for Sat Sorter.

4. **Enable ZDR for PPQ** — If using PPQ as your AI provider, enable Zero Data Retention so your prompts are not stored.

5. **Keep your browser updated** — Security fixes in browsers protect against known exploits that could compromise client-side storage.
