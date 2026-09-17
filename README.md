# Sat Sorter

**Zero-based budgeting on a Bitcoin standard. Give every sat a job.**

Sat Sorter is a private, secure budgeting app built for Bitcoin. Instead of
fiat envelopes, you allocate your sats — every sat gets a job — while your
financial data stays on your own device.

## Features

- **Zero-based budgeting** — allocate every satoshi across your spending
  categories, down to zero unassigned
- **Private by design** — your keys are derived on your device (NIP-06) and
  your data is encrypted locally with XChaCha20-Poly1305; there is no server
  holding your budget
- **Works offline** — installable as a Progressive Web App; your budget is
  available wherever you are
- **Nostr-native** — sign in with a Nostr identity (NIP-07 browser extension,
  nsec, or NIP-98 auth) and interact with the Nostr ecosystem
- **Lightning-friendly** — connect via Alby and other Lightning wallets

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS · Nostr Tools · IndexedDB

## Run it locally

```bash
npm install
npm run dev      # dev server on http://localhost:8080
npm test         # type-check, lint, unit tests, production build
```

## Deployment

Sat Sorter is deployed to [satsorter.com](https://satsorter.com) via Netlify.

## Source code & philosophy

The primary repository lives on **Nostr** (signed, censorship-resistant, no
central authority) and is mirrored to GitHub for accessibility:

- Nostr: `nostr://devin@primal.net/sat-sorter` — browse at
  [NostrHub](https://nostrhub.io/devin@primal.net/sat-sorter)

## License

[MIT](./LICENSE) © Tom Morrow
