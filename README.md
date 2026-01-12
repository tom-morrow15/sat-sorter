# Sat Sorter ⚡

**Zero-based budgeting on a Bitcoin standard. Give every sat a job.**

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=nostr%3A%2F%2Fnpub1acu2u940prfg429x4axskgu2e5auvjx4y6ejme8y8t4ns4tz82pqs5l3q0%2Fgit.shakespeare.diy%2Fsat-sorter)

## What is Sat Sorter?

Sat Sorter is a **privacy-first**, **open-source** budgeting app built for Bitcoiners. It uses the zero-based budgeting method — where every satoshi gets assigned a job before you spend it.

**🔗 Live App: [satsorter.com](https://satsorter.com)**

## ✨ Features

- **Zero-Based Budgeting** — Assign every sat to a category until income minus expenses equals zero
- **Sats or USD** — Toggle between viewing amounts in sats or dollars anytime
- **Lightning Wallet Import** — Connect Alby Hub via NWC for automatic transaction sync
- **CSV Import** — Import transactions from Phoenix, BlueWallet, Zeus, or bank exports
- **Cross-Device Sync** — Log in with Nostr to sync your encrypted budget across devices
- **100% Private** — Your data stays on your device. No accounts required.
- **Works Offline** — Full PWA support for app-like experience
- **Dark/Light Mode** — Easy on the eyes, day or night

## 🔒 Privacy & Data Ownership

**Your financial data belongs to you.** Here's how Sat Sorter protects it:

| Aspect | How It Works |
|--------|--------------|
| **Storage** | All data stored locally in your browser (IndexedDB/localStorage) |
| **No Servers** | We don't have servers that store your data. Period. |
| **No Analytics** | Zero tracking, telemetry, or analytics of any kind |
| **No Accounts** | Use the app without logging in — no email, no signup |
| **Encrypted Sync** | Cloud backup uses NIP-44 encryption with YOUR Nostr keys |
| **Open Source** | Verify the code yourself — nothing to hide |

### How Cloud Sync Works

When you log in with Nostr, your budget syncs using **Nostr relays** instead of a central server:

1. Your budget data is **encrypted with NIP-44** using your own private key
2. The encrypted blob is published to Nostr relays you choose
3. Only **you** can decrypt it — relays see only encrypted data
4. No single point of failure, true data ownership

## 🚀 Getting Started

### Use the Live App

Just visit **[satsorter.com](https://satsorter.com)** — no installation required!

You can also install it as a PWA:
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Install App
- **Desktop**: Look for the install icon in your browser's address bar

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/sat-sorter.git
cd sat-sorter

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🛠 Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type-safe JavaScript
- **Vite** — Fast build tool
- **Tailwind CSS** — Utility-first styling
- **shadcn/ui** — Accessible UI components
- **Nostrify** — Nostr protocol integration
- **TanStack Query** — Data fetching & caching

## 📱 Wallet Compatibility

### Auto-Import (NWC)
- **Alby Hub** ✅ Full support (recommended)

### CSV Import
- Phoenix Wallet
- BlueWallet
- Zeus
- Most bank CSV exports

### Manual Entry
- Works with any wallet or payment method

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 💜 Support

If Sat Sorter helps you manage your sats, consider:

- ⚡ **Donating via Lightning**: [getalby.com/p/satsorter](https://getalby.com/p/satsorter)
- 🌟 **Starring the repo** to help others find it
- 📣 **Sharing with friends** who budget in sats

## 🔗 Links

- **Website**: [satsorter.com](https://satsorter.com)
- **Nostr**: [Follow @satsorter](https://primal.net/p/npub1hq4rd0xalt9swws546kk9mm70uda4n64e30qc09uukvn9uz4dylqw6zqmg)
- **Source Code**: Available on this repository

---

*Fix the money, fix the world.* ₿
