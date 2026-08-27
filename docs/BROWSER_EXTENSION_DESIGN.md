# Sat Sorter Browser Extension — Design Document

**Status**: Design Phase — Ready for Implementation  
**Date**: August 27, 2026  
**Owner**: Devin  
**Related Docs**: `BUDGET_SYNC_STRATEGY.md`, `NOSTR_DIRECT_MESSAGES.md`, `NIP.md`

---

## 1. Executive Summary & Vision

The Sat Sorter browser extension brings **private, automatic fiat transaction import** to users who still make most purchases with credit/debit cards. It is the natural counterpart to the existing NWC auto-sync feature (Lightning-only) and is designed to give the same seamless experience that Plaid provides to traditional budgeting apps — without ever sending credentials or transaction data through a centralized third party.

**Core promise**:  
"Shop normally. When you complete a purchase, confirm the category in one tap. The transaction appears in your budget already assigned — fully private, fully under your control."

The extension is **not** a general-purpose scraper. It is narrowly scoped to detect purchase confirmations, present a beautiful in-extension budgeting moment, and publish an encrypted, device-signed Nostr event that Sat Sorter imports into the user's budget.

---

## 2. Problem & Opportunity

### The Cold-Start Problem
Every budgeting app faces the same friction: users abandon the tool within weeks because manual data entry feels like a chore. Plaid solved this for fiat apps by routing banking credentials through a centralized service. That model is fundamentally incompatible with Sat Sorter's privacy ethos.

### The Opportunity
Nostr + the user's existing private key gives us a **serverless, end-to-end encrypted transport layer** that no other budgeting tool has. Combined with careful detection and a trust-building confirmation flow, we can deliver Plaid-level convenience while keeping every byte of data under the user's control.

**Target users**:
- People transitioning from fiat to Bitcoin (still use credit cards for most purchases)
- Merchants who do not yet accept Lightning
- Nostr-native users who already have a private key and expect seamless device linking

---

## 3. Architecture Overview

### 3.1 Device-Key Linking Model (Preferred)

Instead of importing the user's main `nsec` into the extension, we use a **linked-device pattern** (similar to WhatsApp linked devices and the existing Budget Partners flow):

1. Extension generates a fresh keypair on first run (stored only in `chrome.storage.local`).
2. Sat Sorter shows a QR code / pairing flow containing the device's pubkey.
3. User approves the link inside Sat Sorter (already authenticated with their real key).
4. Sat Sorter records the device pubkey as an authorized importer.
5. Extension signs import events with its device key and NIP-44-encrypts the payload **to the user's main pubkey**.
6. Sat Sorter only accepts events that (a) come from an authorized device and (b) decrypt successfully.

**Benefits**:
- Real private key never touches the extension.
- Compromised device key can only spam the user's own review queue (easily revoked).
- Per-device revocation (no key rotation ceremony for the whole budget).
- Works identically for browser extension, future mobile share-sheet flow, and any future importer.

### 3.2 Nostr Transport

- Events use a custom addressable kind (TBD in `NIP.md`, suggested range 30078–30089).
- Deterministic `d` tag (hash of merchant + amount + timestamp + optional order-id) for idempotency.
- Payload contains: merchant, domain (or full URL if user opts in), fiat amount + currency, purchase timestamp, assigned bucket/line-item, device pubkey, schema version.
- Published to a **fixed, well-known relay set** (same pattern as Budget Partners) so the extension and web app always rendezvous regardless of the user's personal relay list.
- Sat Sorter subscribes from the same fixed relay set.

### 3.3 Purchase Detection Layers (in priority order)

1. **Structured data** (highest confidence)
   - Shopify `Shopify.checkout` object on thank-you pages
   - JSON-LD `schema.org/Order` markup (widely used for email receipts)
   - WooCommerce `order-received` pages

2. **URL + DOM language signals**
   - Paths: `/thank_you`, `/order-confirmation`, `/checkout/success`, `/order-received`
   - Keywords: "order confirmed", "thank you for your purchase", "order #"

3. **Regex near keywords** (fallback)
   - Currency patterns near "total", "charged", "paid"
   - Lowest confidence — the manual confirmation screen absorbs the error rate

**Key principle**: The confirmation UI is the safety net. Imperfect detection is acceptable because the user always sees and approves before import.

---

## 4. User Experience & Onboarding

### 4.1 Seamless Setup Flow (Proton Pass inspired)

1. **Onboarding slide** — "Automatically catch purchases as you shop" with one-click install button (detects browser, deep-links to store).
2. **Post-third-manual-transaction prompt** (highest-conversion moment) — "You've logged 3 purchases by hand. The extension can catch these automatically. Install now?"
3. **Two-click linking** — Extension opens → "Link to Sat Sorter" → handshake fires (externally_connectable on Chrome) → one approval → linked.
4. **Built-in demo purchase** — `/demo-checkout` page inside Sat Sorter. User completes a fake purchase; extension pops the confirmation UI. Zero risk, instant proof, teaches the flow.

### 4.2 In-Extension Budgeting Moment

Popup / in-page modal shows:
- Merchant + amount + date (pre-filled from detection)
- Dropdown of the user's actual buckets + line items (synced via encrypted replaceable Nostr event)
- "Import" button writes the transaction already assigned

### 4.3 Trust & Control Features

- Every import appears in a **pending review queue** inside Sat Sorter (not written directly to budget).
- "via extension" tag + Undo on every transaction.
- Per-site enable (extension starts inert; user enables on each new merchant).
- Device management screen (name devices, last seen, revoke).
- Quiet mode offered only after ~10 successful confirmations.

---

## 5. Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| Desktop Chrome / Chromium / Brave / Edge | Full native | Primary target. Externally-connectable handshake + content scripts. |
| Desktop Safari (macOS) | Supported via macOS app wrapper | Same Web Extension APIs; requires Xcode + Mac App Store review. |
| iOS / iPadOS Safari | Supported via iOS app wrapper | Requires native iOS app. In-page modal preferred over popup for UX. |
| Android Chrome | Not supported | No extension APIs. Use share-sheet fallback (user shares confirmation page → Sat Sorter parses). |

**Strategy**: Build for Chrome first. The Nostr protocol is platform-agnostic, so Safari and iOS implementations reuse the same event format and device-linking ceremony.

---

## 6. Integration With Existing Features

- **NWC Sync** — Extension is fiat-focused. Lightning checkouts are explicitly skipped with a helpful message ("NWC will catch this automatically").
- **CSV Import** — Same-merchant + same-amount + date window triggers a "possible duplicate — merge or keep both?" prompt.
- **Budget Partners** — Linking ceremony records which budget the device writes to (personal vs shared). Confirmation UI shows the target budget.
- **Manual Entry** — Extension never bypasses the pending queue, preserving the same review/undo safety net.

---

## 7. Non-Goals (Explicitly Documented)

- Recurring subscriptions (Netflix, etc.) — no confirmation page exists.
- Refunds/disputes in v1.
- Silent mode as default (confirm-first builds trust).
- Full-page URL capture by default (domain only; opt-in for full URL).
- Android Chrome extension support (share-sheet fallback instead).

---

## 8. Threat Model & Privacy

- Relay operators see event size/timestamps → shopping cadence leaks, contents do not. Documented and accepted.
- Compromised device key can only spam the owner's review queue (mitigated by pending queue + one-tap revoke).
- Store-account compromise ships malicious update → mitigations: minimal permissions, tiny dependency surface, open-source reproducible builds. Residual risk stated plainly in privacy policy.
- No servers, no analytics, no data leaves the user's browser except encrypted events they explicitly approve.

---

## 9. The 12 Locked Decisions

1. Device-key linking model (not main nsec import).
2. Event kind + deterministic `d` tag + payload schema v1 (domain-only default).
3. Which budget a device writes to is captured at linking time.
4. Lightning checkout skip rule (explicit message to user).
5. Possible-duplicate merge UX for CSV conflicts.
6. Fiat-first storage; sats conversion at import time.
7. Externally-connectable handshake primary; pairing-code fallback.
8. Parser packs distributed as Nostr events from dev key (no store review for parser fixes).
9. `storage.local` only; per-site enable default.
10. Offline queue + alarms retry; no standing websockets.
11. Pending-review queue in Sat Sorter (not direct-to-budget).
12. Non-goals explicitly listed above.

---

## 10. Next Steps Before Coding

1. Write `NIP.md` entry for the import event kind and payload schema.
2. Write `docs/BROWSER_EXTENSION_DETECTION.md` (detailed detection engine architecture + CSP/MAIN-world strategy).
3. Write `docs/BROWSER_EXTENSION_PROTOCOL.md` (device linking ceremony, event format, relay strategy).
4. Create extension directory skeleton + manifest with minimal permissions.
5. Build the demo checkout page + handshake flow as the first working milestone.

---

This document captures the complete vision, architecture, UX, security model, platform realities, and all explicit decisions made during the design phase. It serves as the single source of truth for anyone implementing or reviewing the feature in the future.