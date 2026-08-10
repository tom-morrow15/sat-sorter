# Subscription System Deployment Guide

## What's Been Implemented

✅ **Frontend Payment System**
- Payment dialog with tier selection ($1-5)
- QR code invoice display
- Copy-to-clipboard functionality
- Subscription status tracking
- Trial period for first month (unlimited buckets/items)

✅ **Backend (Cloudflare Worker)**
- D1 database with subscriptions, invoices, and zap verification tables
- Subscription creation and management
- Auto-expiry and revert to free tier
- Payment application endpoint
- Test code validation for development

✅ **Integration Points**
- AddBucketDialog bucket limit enforcement
- CopyMonthWithUpgrade for payment prompts when copying large budgets
- SubscriptionSettings component for user to view status

## Next Steps on Your Mac

### 1. Deploy Updated Worker

In your terminal, in the `sat-sorter` directory:

```bash
npx wrangler deploy --env=""
```

This deploys the updated `worker.ts` with:
- D1 database schema creation
- Subscription management
- Payment verification
- Test code validation

### 2. Verify Deployment

Test the health check:

```bash
curl https://sat-sorter-worker.satsorter.workers.dev/health
```

Should return: `{"status":"ok"}`

### 3. Test Invoice Creation

```bash
curl -X POST https://sat-sorter-worker.satsorter.workers.dev/api/subscription/create-invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 500000}'
```

Should return a Lightning invoice from Alby.

## What Still Needs Integration

### 1. Budget Partner Payment Logic

When a user is invited as a partner to a budget:
- They should inherit the owner's subscription tier
- They should have unlimited/free access based on owner's payment
- No payment required for the partner

**File to update**: `src/hooks/useBudget.ts` or similar
```typescript
// Check if user is a budget partner and if so, use owner's subscription
```

### 2. Real-Time Zap Detection

Currently relies on 5-second polling. For true real-time:
- Listen for Nostr zap receipts (kind 9735)
- Verify against your Lightning address
- Call `/api/subscription/apply-payment` immediately

**File to create**: `src/hooks/useZapListener.ts`

### 3. Test the Full Flow

1. Go to app and create a 6th budget bucket
2. Should show upgrade dialog
3. Select "$5 - Unlimited"
4. Scan QR code with Lightning wallet
5. Send payment (testnet sats or real sats if you want)
6. Wait for zap verification (should take 5 seconds max)
7. Subscription should auto-unlock

## Test Codes (Development Only)

For testing without paying real sats, you can use secret test codes in Subscription Settings.
**Codes are stored as Cloudflare Worker Secrets, NOT in the codebase.**

To set codes:
```bash
npx wrangler secret put VALID_TEST_CODES
# Paste: YOUR_CODE_1,YOUR_CODE_2,YOUR_CODE_3
```

Then enter any valid code in Subscription Settings → Test Access Code.

## Database Schema

The worker automatically creates these tables on first run:

### subscriptions
```
pubkey (PRIMARY KEY)
tier ('free', 'paid', 'trial')
buckets (number or Infinity)
items_per_bucket (number or Infinity)
expires_at (ISO timestamp)
payment_type ('none', 'monthly', 'yearly')
created_at, updated_at
```

### invoices
```
id (PRIMARY KEY)
pubkey (FOREIGN KEY)
amount (millisatoshis)
bolt11 (Lightning invoice)
status ('pending', 'paid')
created_at, expires_at, paid_at
```

### zap_verifications
```
id (PRIMARY KEY)
pubkey (FOREIGN KEY)
amount_msat
bolt11
zap_receipt_id (UNIQUE)
status
verified_at
created_at
```

## API Endpoints

### POST /api/subscription/create-invoice
Create a Lightning invoice

**Request:**
```json
{
  "amount": 500000,  // millisatoshis
  "comment": "Sat Sorter - Unlimited"
}
```

**Response:**
```json
{
  "invoice": {
    "pr": "lnbc5u1p...",
    "status": "OK"
  }
}
```

### GET /api/subscription/status?pubkey=...
Get user's subscription status

**Response:**
```json
{
  "pubkey": "...",
  "tier": "free|paid|trial",
  "buckets": 5,
  "items_per_bucket": 4,
  "expires_at": "2026-08-31T23:59:59.999Z",
  "payment_type": "none|monthly|yearly"
}
```

### POST /api/subscription/apply-payment
Apply a payment to upgrade subscription

**Request:**
```json
{
  "pubkey": "...",
  "amountMsat": 500000,
  "tier": "monthly"  // or "yearly"
}
```

### POST /api/subscription/apply-test-code
Apply a test code for unlimited access

**Request:**
```json
{
  "pubkey": "...",
  "testCode": "YOUR_SECRET_CODE"
}
```

## Payment Tiers

| Tier | Price | Buckets | Items/Bucket | Billing |
|------|-------|---------|--------------|---------|
| Free | N/A | 5 | 4 | N/A |
| Trial | N/A | ∞ | ∞ | First month only |
| +1 Bucket | $1 | 6 | 4 | Monthly |
| +2 Buckets | $2 | 7 | 4 | Monthly |
| +3 Buckets | $3 | 8 | 4 | Monthly |
| +4 Buckets | $4 | 9 | 4 | Monthly |
| Unlimited | $5 | ∞ | ∞ | Monthly |
| Yearly Unlimited | $50 | ∞ | ∞ | Yearly |

## Pricing Conversion

Approximate sats to USD (using $1 = 50,000 sats):
- $1 tier = 50,000 sats
- $2 tier = 100,000 sats
- $3 tier = 150,000 sats
- $4 tier = 200,000 sats
- $5 tier = 250,000 sats
- $50 yearly = 2,500,000 sats

## Monthly Expiration Logic

All monthly subscriptions expire at:
- **End of current calendar month**
- Regardless of when purchased (even if on the 28th, still expires on 30th/31st)
- User must repay to continue access next month
- On next month (e.g., Sept 1), they revert to free tier if not paid

## Yearly Subscription Logic

Yearly subscriptions expire:
- **End of month, 12 months from purchase**
- User is reminded 30 days before expiry
- Can renew yearly or switch to monthly

## Next Session TODO

1. Deploy worker changes to Cloudflare
2. Integrate budget partner payment inheritance
3. Implement real-time zap listener (optional, polling works for now)
4. Create end-to-end test flow
5. Generate test invoices and verify payment application
