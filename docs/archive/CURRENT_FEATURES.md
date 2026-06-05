# Sat Sorter - Current Features ✨

## Overview

Sat Sorter is a **Bitcoin-native budget app** built with Nostr integration. It helps you track spending in sats and manage your Bitcoin finances.

---

## Core Features

### 📊 Budget Management

**Create & Manage Budgets**
- Monthly budgeting (YYYY-MM format)
- Switch between months
- View previous/future budgets
- Auto-create for current month

**Budget Categories (Buckets)**
- Pre-built default categories:
  - 💰 Income
  - 🏠 Housing (Rent, Utilities, Insurance)
  - 🚗 Transportation (Gas, Car Payment, Insurance)
  - 🍔 Food (Groceries, Restaurants)
  - 🎮 Lifestyle (Entertainment, Subscriptions)
  - 💳 Savings (Emergency Fund, Bitcoin Stack)

**Add Custom Categories**
- Click "Add Category" button
- Name your category
- Choose color and icon
- Add line items within category
- Custom icons from Lucide icon set

**Line Items**
- Create line items within each bucket
- Set planned amounts for each
- Track against actual spending
- Organize by importance

### 💵 Transaction Tracking

**Manual Entry**
- Click "Add Transaction" in sidebar
- Enter date, description, amount
- Assign to bucket and line item
- Track income or expenses

**Transaction Management**
- Edit transaction details
- Reassign to different categories
- Delete transactions
- See full transaction history
- View in Transactions Panel (right sidebar)

**Smart Categorization**
- Recognizes 20+ merchant types:
  - Starbucks → Food/Restaurants
  - Whole Foods → Food/Groceries
  - Uber → Transportation
  - Netflix → Subscriptions
  - Bitcoin exchanges → Savings
  - And more!
- Manual override always available

### 👛 Wallet Integration

**Lightning Wallet Support**
- Connect Nostr Wallet Connect (NWC)
- Connect WebLN wallets
- Manage multiple wallets
- Set active wallet

**Zaps & Payments**
- Send zaps to creators
- Track Lightning payments
- View zap history
- Integration with Nostr profiles

**Payment Methods**
- NWC (Nostr Wallet Connect)
- WebLN (Browser extension wallets)
- Manual invoice handling
- Fallback QR code option

### 🌍 Nostr Integration

**Login & Authentication**
- Nostr login (NIP-07 compatible)
- Multiple account support
- Account switching
- Nostr sync capabilities

**Profile Management**
- Edit profile metadata
- Upload avatar
- Add bio and details
- NIP-05 support

**Direct Messaging**
- NIP-04 & NIP-17 protocols
- Real-time messaging
- Encrypted conversations
- Message history

### 📈 Spending Analytics

**Budget vs Actual**
- See planned vs spent amounts
- Color-coded status (over/under budget)
- Category-level breakdown
- Line item tracking

**Visual Feedback**
- Spending summaries
- Category totals
- Income tracking
- Remaining to budget calculation

**Multiple Views**
- Monthly overview
- Category breakdown
- Line item details
- Transaction list

### 💱 Currency Support

**Dual Currency Display**
- Toggle between sats and USD
- Real-time conversion
- Consistent formatting
- Choose preferred default

**Bitcoin Native**
- All internal amounts in sats
- USD just for display
- Bitcoin-standard mindset
- No crypto hedging needed

### 🗺️ Location Services

**BTC Map Integration**
- Find merchants accepting Bitcoin
- See merchant ratings
- Filter by category
- Support Bitcoin economy

### 🎨 User Interface

**Responsive Design**
- Works on desktop, tablet, mobile
- Beautiful dark mode
- Light mode option
- Accessible components

**Navigation**
- Clear menu structure
- Intuitive layout
- Quick access to features
- Breadcrumb support

**Data Persistence**
- Local storage in browser
- Survives page refreshes
- Secure on your device
- No server synchronization (yet)

---

## How to Use

### Getting Started

1. **Log in with Nostr**
   - Click Login button
   - Authorize with your wallet
   - Profile is ready

2. **Create Budget**
   - Set up categories
   - Add line items
   - Set planned amounts

3. **Track Spending**
   - Add transactions manually
   - Assign to categories
   - See spending vs budget

4. **Manage Wallet**
   - Connect Lightning wallet (optional)
   - Send zaps to creators
   - Track payments

### Daily Usage

**Morning:**
- Check daily spending
- See what's left in each category

**Throughout Day:**
- Add transactions as you spend
- Reassign if category was wrong

**End of Month:**
- Review spending patterns
- Plan next month
- Adjust categories if needed

---

## Data & Privacy

### What's Stored
- ✅ Budget data (local, encrypted)
- ✅ Transaction history
- ✅ Profile metadata
- ✅ Wallet connections
- ✅ Category preferences

### Where It's Stored
- 🏠 **Locally in your browser** (IndexedDB)
- 🔐 **Not on any server**
- 🚫 **Not sent anywhere without permission**
- ✅ **Under your complete control**

### Privacy Features
- No tracking
- No analytics
- No data selling
- No ads
- No central database
- Pure local-first architecture

### Export/Import
- Can export budget data
- Can backup to file
- Can restore from backup
- Git sync available (optional)

---

## Technical Details

### Built With
- React 18.x
- TypeScript
- TailwindCSS
- Shadcn/UI
- Nostrify
- IndexedDB

### Compatibility
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

### Performance
- ⚡ Fast load times
- 📦 Optimized bundle
- 🎯 Efficient rendering
- 💾 Minimal storage

---

## Future Features (Planned)

### Potential Additions
- CSV transaction import
- Recurring transaction templates
- Spending forecasts
- Budget alerts
- Tax reporting
- Multi-user budgets
- Cloud backup (optional)
- Advanced analytics

### Strike Integration (On Hold)
- Automatic transaction sync
- Bill pay tracking
- Bitcoin purchase tracking
- Will be re-enabled once API is available

---

## Roadmap

### Q1 2024: Core Stability
- ✅ Budget management
- ✅ Transaction tracking
- ✅ Lightning integration
- ✅ UI refinement

### Q2 2024: Enhanced Features
- CSV import
- Recurring transactions
- Better analytics
- Mobile optimization

### Q3 2024: Integrations
- Strike API (when available)
- Bank connections (if possible)
- Multi-account support
- Cloud backup

### Q4 2024: Advanced
- Tax reporting
- Spending forecasts
- Budget sharing
- Community features

---

## Getting Help

### Documentation
- This file: Current features
- QUICK_START_IMPORT.md: CSV import guide
- CSV_IMPORT_GUIDE.md: Detailed import help

### In-App Help
- Hover over elements for tooltips
- Clear error messages
- Helpful hints throughout

### Support
- Check the docs first
- Look at example budgets
- Review transaction examples

---

## Tips & Tricks

### Best Practices
1. **Review weekly** - Stay on top of spending
2. **Categorize immediately** - Don't let transactions pile up
3. **Set realistic budgets** - Base on actual spending
4. **Use multiple line items** - More granular tracking
5. **Check BTC Map** - Support Bitcoin merchants

### Advanced Usage
1. **Color coding** - Use colors to identify category type
2. **Icon selection** - Match icons to category meaning
3. **Rebalancing** - Adjust budgets mid-month if needed
4. **Historical review** - Compare months to see trends
5. **CSV export** - Back up important data regularly

### Optimization
1. **Mobile first** - Use on phone for quick entry
2. **Home screen** - Add to home screen for quick access
3. **Dark mode** - Better for late night budgeting
4. **Keyboard shortcuts** - Coming soon!

---

## What Makes It Special

### Bitcoin Native 🪙
- Built for sats, not fiat
- Bitcoin-standard budgeting
- No crypto conversion headaches
- Align finances with Bitcoin

### Privacy First 🔐
- All data stays local
- No surveillance
- No ads
- No tracking

### Nostr Integrated 👥
- Use your Nostr identity
- Direct messages built-in
- Decentralized architecture
- Community-driven

### Open Source 📖
- Transparent code
- Community contributions welcome
- No hidden fees
- Sustainable funding

---

## Limitations

### Current (By Design)
- ⏳ Manual transaction entry only
- 🏠 Local storage (single device)
- 🔌 No automatic sync
- 📱 No native mobile app

### Planned for Future
- ✅ CSV import (in progress)
- ✅ Cloud sync (optional)
- ✅ Automatic transaction sources
- ✅ Mobile app (possibly)

---

## Success Stories

### Typical User Journey
```
Day 1: Create budget with categories
Day 2: Add first transactions
Week 1: See spending patterns emerge
Month 1: Adjust categories based on real data
Month 2: Better budgeting with learned insights
Month 3+: Optimize spending, hit financial goals
```

### Common Achievements
- ✅ First time seeing real spending breakdown
- ✅ Identifying unnecessary expenses
- ✅ Staying within budget
- ✅ Building savings habit
- ✅ Bitcoin-standard finances

---

## Summary

Sat Sorter is a **complete, functional Bitcoin budget app** that:

✅ Lets you create budgets in sats
✅ Tracks every transaction
✅ Categorizes merchant spending
✅ Integrates with Lightning wallets
✅ Keeps all data private & local
✅ Works on any device
✅ Looks beautiful
✅ Is completely free

**Perfect for anyone who:**
- Wants to track Bitcoin spending
- Cares about privacy
- Uses Nostr
- Loves Bitcoin
- Wants full control of their data

---

## Get Started Now

1. **Go to Budget page**
2. **Log in with Nostr**
3. **Create your first budget**
4. **Start tracking spending**
5. **Watch patterns emerge**

**That's it!** Welcome to Bitcoin-native budgeting. 🚀

---

**Questions?** Features working great! Improvements coming soon! 💪
