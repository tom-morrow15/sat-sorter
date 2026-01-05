# Strike Integration Guide

This guide explains how to set up and use the Strike integration for automatic spending tracking in Sat Sorter.

## Overview

The Strike integration allows you to automatically import transactions from your Strike account into your Sat Sorter budget. This is especially useful for:

- **Bill Pay tracking**: Monitor your bill payment spending automatically
- **Merchant spending**: Track purchases made through Strike merchants
- **Expense categorization**: Automatic categorization based on merchant data
- **Duplicate prevention**: Intelligent duplicate detection across syncs

## Setup

### 1. Get Your Strike API Key

1. Log in to your [Strike account](https://strike.me)
2. Go to **Settings** → **API** (or **Developer Settings** depending on your region)
3. Create a new API token if one doesn't exist
4. Copy the API key to your clipboard

### 2. Connect Strike in Sat Sorter

1. Navigate to your Budget page
2. Look for the "Connect Strike" button in the alerts section (appears for logged-in users)
3. Click the button to open the Strike connection dialog
4. Paste your API key into the field
5. Optionally enter your Strike username for easier identification
6. Click "Connect Strike"
7. If successful, you'll see a "Strike Connected" confirmation

## Features

### Automatic Transaction Import

Once connected, you can sync your Strike transactions:

1. Click the **"Sync Strike"** button in the blue banner at the top of your budget
2. The system will:
   - Fetch all completed transactions from Strike since your last sync
   - Convert them to the Sat Sorter format (converting BTC to sats)
   - Auto-detect merchant categories
   - Check for duplicates to prevent re-importing

### Merchant Categorization

The system automatically categorizes transactions based on merchant data. Supported categories include:

- **Food & Dining**: Starbucks, grocery stores, restaurants, food delivery
- **Transportation**: Uber, Lyft, gas stations, airlines
- **Utilities & Housing**: Electric, water, internet, rent
- **Healthcare**: Pharmacies, hospitals, doctors
- **Subscriptions**: Netflix, Spotify, Apple Music, etc.
- **Savings & Investments**: Bitcoin exchanges, crypto platforms
- **Bill Pay**: Strike bill pay transactions

### Manual Assignment

Even with auto-categorization, you can:

1. Assign transactions to different buckets and line items
2. Edit transaction descriptions
3. Move transactions between categories
4. Delete unwanted transactions

## How It Works

### Data Flow

```
Strike Account
    ↓
API Fetch (completed transactions only)
    ↓
BTC → Sats Conversion (×100,000,000)
    ↓
Merchant Categorization
    ↓
Duplicate Detection
    ↓
Import to Budget
    ↓
Manual Assignment (optional)
```

### Duplicate Prevention

The system prevents importing the same transaction twice by checking:

1. **Date**: Exact ISO date match
2. **Amount**: Exact satoshi amount match
3. **Source**: Must be marked as 'strike' source
4. **Merchant**: Exact merchant name match

Transactions marked as duplicates are skipped during sync and don't affect your imported count.

## Merchant Matching Rules

The following merchants are automatically detected:

### Food & Dining
- **Groceries**: Whole Foods, Trader Joe's, Kroger, Safeway, Albertsons
- **Restaurants**: Generic restaurants, pizza, sushi, burgers, grills
- **Coffee**: Starbucks, cafes
- **Delivery**: DoorDash, Uber Eats, GrubHub

### Transportation
- **Rideshare**: Uber, Lyft, taxis
- **Gas**: Chevron, Shell, Exxon, BP, Mobil
- **Vehicle**: Tesla, Ford, Chevy, Toyota, Honda payments
- **Airlines**: United, Delta, American, Southwest

### Utilities
- Electric, water, gas companies
- Internet providers: Verizon, AT&T, Comcast, Xfinity

### Healthcare
- Pharmacies: CVS, Walgreens
- Medical facilities: Hospitals, clinics, doctors

### Subscriptions
- **Streaming**: Netflix, Hulu, Disney+, Spotify, Apple Music, YouTube
- **Music**: Spotify, Apple Music, YouTube
- **Fitness**: Gym, yoga, Peloton

### Savings
- Bitcoin exchanges: Coinbase, Kraken
- Crypto platforms

## Sync Frequency

- **Manual Sync**: Click the "Sync Strike" button anytime
- **Last Sync Date**: Stored automatically, future syncs only fetch new transactions
- **Frequency**: You can sync as often as needed (no rate limiting imposed by Sat Sorter)

## Troubleshooting

### "Authentication failed" Error

**Cause**: Your API key is invalid or expired

**Solution**:
1. Check that you copied the key correctly
2. Verify the key hasn't expired in Strike settings
3. Try disconnecting and reconnecting with a new key

### No transactions imported

**Possible causes**:
- You have no completed transactions in Strike yet
- All recent transactions have already been imported
- Your Strike account has no transaction history

**Solution**:
- Create a test transaction in Strike
- Wait a few minutes and sync again
- Check the sync feedback message

### Duplicate transactions showing up

**Cause**: Transactions from the same source shouldn't duplicate, but manual entries might

**Solution**:
- The system has built-in duplicate detection for Strike transactions
- If you see a duplicate, delete one manually
- Future syncs won't re-import that transaction

### Transactions missing merchant data

**Cause**: Some Strike transactions may not include merchant information

**Solution**:
- You can edit the description in Sat Sorter after import
- The transaction will still be categorized based on available data
- Consider adding a description when paying

## Privacy & Security

- **API Key Storage**: Your API key is stored locally in your browser's localStorage
- **No Server Upload**: All data stays on your device
- **Read-Only Access**: The integration only reads transaction history
- **You Control Sync**: You manually trigger each sync

### To Disconnect Strike

1. Open the Strike connection dialog
2. Click "Disconnect Strike"
3. Your API key will be removed from local storage

## Advanced: Customizing Merchant Rules

If you want to add custom merchant categorization rules, you can edit the `MERCHANT_RULES` array in `/src/lib/strikeUtils.ts`:

```typescript
const MERCHANT_RULES: MerchantCategory[] = [
  // Add new rule:
  { 
    pattern: /your-merchant-name/i, 
    bucket: 'Your Bucket Name', 
    lineItem: 'Your Line Item' 
  },
  // ... existing rules
];
```

Rules are checked in order, so add more specific patterns first.

## Future Enhancements

Potential features for future versions:

- [ ] Recurring transaction detection (identify monthly bills)
- [ ] Spending alerts and notifications
- [ ] Custom merchant categorization rules UI
- [ ] Bill Pay specific tracking and analysis
- [ ] Automatic budget recommendations
- [ ] Integration with other payment platforms

## Support

For issues or questions:

1. Check this documentation first
2. Review the error messages in Sat Sorter
3. Verify your API key is valid in Strike settings
4. Try disconnecting and reconnecting

## API Reference

### Strike API Endpoints Used

- `POST https://api.strike.me/v1/me` - User authentication check
- `GET https://api.strike.me/v1/transactions` - Fetch transaction history

### Transaction Fields Captured

From Strike, we capture:
- `id`: Transaction ID (stored as `paymentHash`)
- `createdAt`: Transaction date (ISO format)
- `btcAmount.amount`: Amount in BTC (converted to sats)
- `type`: Transaction type (send/receive/payment)
- `status`: Transaction status (completed/pending/failed)
- `counterparty.name`: Recipient/sender name
- `description`: Transaction description (fallback)
