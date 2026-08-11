/**
 * Cloudflare Worker for Sat Sorter Subscription Management
 * Handles invoice generation, payment verification, and subscription tracking
 *
 * Security model:
 * - Invoices are stored in D1 with the user's pubkey at creation time
 * - Payment verification calls Alby's verify endpoint to confirm payment
 * - Each invoice can only be used once (prevents replay attacks)
 * - The pubkey on the invoice must match the pubkey requesting verification
 *
 * Test codes:
 * - Stored as Cloudflare Worker Secret (VALID_TEST_CODES env variable)
 * - NOT in the codebase or git repo
 * - Set via: npx wrangler secret put VALID_TEST_CODES
 * - Format: comma-separated string like "CODE1,CODE2,CODE3"
 * - To add/remove codes, update the secret and redeploy
 */

interface CreateInvoiceRequest {
  amount: number; // Amount in millisatoshis
  comment?: string;
  pubkey: string; // User's Nostr pubkey (required for verification)
}

interface VerifyPaymentRequest {
  pubkey: string;
  invoiceId: string; // The D1 invoice ID returned at creation time
}

interface Subscription {
  pubkey: string;
  tier: 'free' | 'paid' | 'trial';
  buckets: number;
  items_per_bucket: number;
  expires_at: string | null;
  payment_type: 'none' | 'monthly' | 'yearly' | 'test';
  created_at: string;
}

const ALBY_ADDRESS = "satsorter@getalby.com";
const FREE_TIER_BUCKETS = 5;
const FREE_TIER_ITEMS = 4;
const UNLIMITED_SENTINEL = 999999; // Used instead of Infinity for SQLite compatibility

// Satoshis per dollar (approximate, used for tier calculation)
const SATS_PER_USD = 50000;

// Test codes for development — stored securely as Cloudflare Worker Secrets
// NOT in the codebase. Set via: npx wrangler secret put VALID_TEST_CODES
// Format: comma-separated string like "CODE1,CODE2,CODE3"
function getValidTestCodes(env: any): string[] {
  const raw = env.VALID_TEST_CODES || '';
  return raw.split(',').map((c: string) => c.trim()).filter(Boolean);
}

// Tier thresholds in millisatoshis
const TIER_THRESHOLDS = {
  PLUS_1: 1 * SATS_PER_USD * 1000,       // 50,000,000 msat
  PLUS_2: 2 * SATS_PER_USD * 1000,       // 100,000,000 msat
  PLUS_3: 3 * SATS_PER_USD * 1000,       // 150,000,000 msat
  PLUS_4: 4 * SATS_PER_USD * 1000,       // 200,000,000 msat
  UNLIMITED_MONTHLY: 5 * SATS_PER_USD * 1000,  // 250,000,000 msat
  YEARLY: 50 * SATS_PER_USD * 1000,      // 2,500,000,000 msat
};

// Helper: get end of current month (last day at 23:59:59.999)
function getMonthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Helper: get yearly expiry (same day last day of month, 12 months ahead)
function getYearlyExpiry(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 12, 0, 23, 59, 59, 999);
}

// Helper: CORS headers
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

// Helper: JSON response
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

// Initialize D1 database tables
async function initializeDatabase(db: any): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS subscriptions (pubkey TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'free', buckets INTEGER NOT NULL DEFAULT 5, items_per_bucket INTEGER NOT NULL DEFAULT 4, expires_at TEXT, payment_type TEXT NOT NULL DEFAULT 'none', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, amount_msat INTEGER NOT NULL, bolt11 TEXT NOT NULL, verify_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', tier_requested TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, paid_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS zap_verifications (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, amount_msat INTEGER NOT NULL, bolt11 TEXT NOT NULL, invoice_id TEXT, status TEXT NOT NULL DEFAULT 'verified', verified_at TEXT NOT NULL, created_at TEXT NOT NULL)`
  ];

  for (const stmt of statements) {
    try {
      await db.exec(stmt);
    } catch (e) {
      // Table might already exist, or exec might not support DDL
      // Try prepare as fallback
      try {
        await db.prepare(stmt).run();
      } catch (e2) {
        console.error("Failed to create table:", stmt.substring(0, 50), e2);
      }
    }
  }
}

// Get or create subscription for user
async function getOrCreateSubscription(db: any, pubkey: string): Promise<Subscription> {
  try {
    let sub = await db
      .prepare("SELECT * FROM subscriptions WHERE pubkey = ?")
      .bind(pubkey)
      .first();

    if (!sub) {
      // New user: create with trial (unlimited for rest of current month)
      const now = new Date();
      const trialExpires = getMonthEnd(now);

      await db
        .prepare(
          `INSERT INTO subscriptions (pubkey, tier, buckets, items_per_bucket, expires_at, payment_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          pubkey,
          'trial',
          UNLIMITED_SENTINEL,
          UNLIMITED_SENTINEL,
          trialExpires.toISOString(),
          'none',
          now.toISOString(),
          now.toISOString()
        )
        .run();

      sub = {
        pubkey,
        tier: 'trial',
        buckets: UNLIMITED_SENTINEL,
        items_per_bucket: UNLIMITED_SENTINEL,
        expires_at: trialExpires.toISOString(),
        payment_type: 'none',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    } else {
      // Check if subscription has expired
      const now = new Date();
      if (sub.expires_at && new Date(sub.expires_at) < now && sub.tier !== 'free') {
        // Trial or paid has expired: revert to free tier
        await db
          .prepare(
            `UPDATE subscriptions
             SET tier = 'free', buckets = ?, items_per_bucket = ?, payment_type = 'none', expires_at = NULL, updated_at = ?
             WHERE pubkey = ?`
          )
          .bind(FREE_TIER_BUCKETS, FREE_TIER_ITEMS, now.toISOString(), pubkey)
          .run();

        sub.tier = 'free';
        sub.buckets = FREE_TIER_BUCKETS;
        sub.items_per_bucket = FREE_TIER_ITEMS;
        sub.expires_at = null;
        sub.payment_type = 'none';
      }
    }

    return sub as Subscription;
  } catch (error) {
    console.error("Error getting/creating subscription:", error);
    return {
      pubkey,
      tier: 'free',
      buckets: FREE_TIER_BUCKETS,
      items_per_bucket: FREE_TIER_ITEMS,
      expires_at: null,
      payment_type: 'none',
      created_at: new Date().toISOString(),
    };
  }
}

// Determine tier from payment amount (in millisatoshis)
function determineTierFromAmount(amountMsat: number): {
  buckets: number;
  itemsPerBucket: number;
  paymentType: 'monthly' | 'yearly';
} {
  const satoshis = amountMsat / 1000;

  // Yearly: $50 = 2,500,000 sats
  if (satoshis >= 50 * SATS_PER_USD) {
    return {
      buckets: UNLIMITED_SENTINEL,
      itemsPerBucket: UNLIMITED_SENTINEL,
      paymentType: 'yearly',
    };
  }

  // Unlimited monthly: $5 = 250,000 sats
  if (satoshis >= 5 * SATS_PER_USD) {
    return {
      buckets: UNLIMITED_SENTINEL,
      itemsPerBucket: UNLIMITED_SENTINEL,
      paymentType: 'monthly',
    };
  }

  // Partial upgrades: $1-4 = 50,000-200,000 sats
  const dollars = Math.floor(satoshis / SATS_PER_USD);
  return {
    buckets: FREE_TIER_BUCKETS + dollars,
    itemsPerBucket: FREE_TIER_ITEMS,
    paymentType: 'monthly',
  };
}

// Apply a verified payment to a user's subscription
async function applyPayment(
  db: any,
  pubkey: string,
  amountMsat: number
): Promise<Subscription> {
  const now = new Date();
  const tierInfo = determineTierFromAmount(amountMsat);

  const expiresAt = tierInfo.paymentType === 'yearly'
    ? getYearlyExpiry(now)
    : getMonthEnd(now);

  // Ensure subscription exists first
  await getOrCreateSubscription(db, pubkey);

  await db
    .prepare(
      `UPDATE subscriptions
       SET tier = 'paid', buckets = ?, items_per_bucket = ?, expires_at = ?, payment_type = ?, updated_at = ?
       WHERE pubkey = ?`
    )
    .bind(
      tierInfo.buckets,
      tierInfo.itemsPerBucket,
      expiresAt.toISOString(),
      tierInfo.paymentType,
      now.toISOString(),
      pubkey
    )
    .run();

  console.log(`Payment applied for ${pubkey}: ${amountMsat / 1000} sats, tier: ${tierInfo.paymentType}, expires: ${expiresAt.toISOString()}`);

  return getOrCreateSubscription(db, pubkey);
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const db = env.DB;

    try {
      if (pathname !== "/health") {
        await initializeDatabase(db);
      }

      // ─── POST /api/subscription/init-db ─────────────────────────────────
      // Dedicated endpoint to initialize database tables (for debugging)
      if (pathname === "/api/subscription/init-db" && request.method === "POST") {
        await initializeDatabase(db);
        return json({ success: true, message: "Database initialization attempted" });
      }

      // ─── POST /api/subscription/create-invoice ───────────────────────────
      // Creates a Lightning invoice via proper LNURL flow (not Alby proxy).
      // This ensures the invoice is generated by the user's Hub, not Alby's custodial service.
      if (pathname === "/api/subscription/create-invoice" && request.method === "POST") {
        const body = (await request.json()) as CreateInvoiceRequest;
        const { amount, comment, pubkey } = body;

        if (!amount || amount <= 0) {
          return json({ error: "Invalid amount" }, 400);
        }

        if (!pubkey) {
          return json({ error: "Missing pubkey. You must be logged in to upgrade." }, 400);
        }

        try {
          // Step 1: Fetch LNURL pay details for the address
          // This resolves satsorter@getalby.com → LNURL pay endpoint
          const [username, domain] = ALBY_ADDRESS.split('@');
          const lnurlInfoUrl = `https://${domain}/.well-known/lnurlp/${username}`;
          
          const lnurlInfoResponse = await fetch(lnurlInfoUrl);
          if (!lnurlInfoResponse.ok) {
            console.error("Failed to fetch LNURL info:", lnurlInfoResponse.status);
            return json({ error: "Failed to resolve Lightning address" }, 502);
          }
          
          const lnurlInfo = await lnurlInfoResponse.json();
          
          if (lnurlInfo.status !== 'OK' || lnurlInfo.tag !== 'payRequest') {
            console.error("Invalid LNURL response:", lnurlInfo);
            return json({ error: "Invalid Lightning address" }, 502);
          }

          // Step 2: Get the callback URL from the LNURL details
          const callbackUrl = lnurlInfo.callback;
          if (!callbackUrl) {
            console.error("No callback URL in LNURL response");
            return json({ error: "Lightning address has no callback" }, 502);
          }

          // Step 3: Call the callback URL with the amount to get an invoice from the Hub
          const invoiceUrl = new URL(callbackUrl);
          invoiceUrl.searchParams.set('amount', amount.toString());
          if (comment) {
            invoiceUrl.searchParams.set('comment', comment);
          }

          const invoiceResponse = await fetch(invoiceUrl.toString());
          const invoiceData = await invoiceResponse.json();

          if (!invoiceResponse.ok || invoiceData.status !== 'OK' || !invoiceData.pr) {
            console.error("Invoice generation failed:", invoiceData);
            return json({ error: "Failed to create invoice" }, 500);
          }

          const bolt11 = invoiceData.pr as string;
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
          const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

          // Store invoice in D1 with the user's pubkey
          // Note: For Hub-generated invoices, there's no verify URL from Alby
          // We'll construct one from the Hub's verify endpoint if available
          const verifyUrl = invoiceData.verify || '';

          await db
            .prepare(
              `INSERT INTO invoices (id, pubkey, amount_msat, bolt11, verify_url, status, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
            )
            .bind(
              invoiceId,
              pubkey,
              amount,
              bolt11,
              verifyUrl,
              now.toISOString(),
              expiresAt.toISOString()
            )
            .run();

          return json({
            invoice: {
              pr: bolt11,
              verify: verifyUrl,
              status: 'OK',
            },
            invoiceId,
          });
        } catch (error) {
          console.error("Error creating invoice:", error);
          return json({ error: "Failed to create invoice" }, 500);
        }
      }

      // ─── GET /api/subscription/status ────────────────────────────────────
      // Returns the user's current subscription tier
      if (pathname === "/api/subscription/status" && request.method === "GET") {
        const pubkey = url.searchParams.get("pubkey");

        if (!pubkey) {
          return json({ error: "Missing pubkey parameter" }, 400);
        }

        const sub = await getOrCreateSubscription(db, pubkey);

        return json({
          pubkey: sub.pubkey,
          tier: sub.tier,
          buckets: sub.buckets,
          items_per_bucket: sub.items_per_bucket,
          expires_at: sub.expires_at,
          payment_type: sub.payment_type,
        });
      }

      // ─── POST /api/subscription/verify-payment ───────────────────────────
      // Verifies that a specific invoice was paid by calling Alby's verify endpoint,
      // then updates the user's subscription. This is the secure verification flow.
      if (pathname === "/api/subscription/verify-payment" && request.method === "POST") {
        const body = (await request.json()) as VerifyPaymentRequest;
        const { pubkey, invoiceId } = body;

        if (!pubkey || !invoiceId) {
          return json({ error: "Missing pubkey or invoiceId" }, 400);
        }

        // Look up the invoice in D1
        const invoice = await db
          .prepare("SELECT * FROM invoices WHERE id = ? AND pubkey = ?")
          .bind(invoiceId, pubkey)
          .first();

        if (!invoice) {
          return json({ error: "Invoice not found for this user" }, 404);
        }

        if (invoice.status === 'paid') {
          // Already paid and applied — return current subscription
          const sub = await getOrCreateSubscription(db, pubkey);
          return json({
            success: true,
            alreadyPaid: true,
            subscription: {
              tier: sub.tier,
              buckets: sub.buckets,
              items_per_bucket: sub.items_per_bucket,
              expires_at: sub.expires_at,
              payment_type: sub.payment_type,
            },
          });
        }

        // Call the verify endpoint to check if the invoice was actually paid
        // This works for both Alby custodial and self-hosted Hub invoices
        let verifyResult: any;
        try {
          const verifyResponse = await fetch(invoice.verify_url as string);
          verifyResult = await verifyResponse.json();
        } catch (err) {
          console.error("Failed to call verify endpoint:", err);
          return json({ error: "Failed to verify payment" }, 502);
        }

        // Handle different verify response formats
        // Alby returns { settled: true }
        // Hub may return { settled: true } or { status: "OK", paid: true }
        const isPaid = verifyResult?.settled === true || verifyResult?.paid === true || verifyResult?.status === 'OK' && verifyResult?.paid === true;

        if (!isPaid) {
          return json({
            success: false,
            paid: false,
            message: "Invoice has not been paid yet",
          });
        }

        // Payment confirmed! Apply it to the user's subscription
        const updatedSub = await applyPayment(db, pubkey, invoice.amount_msat as number);

        // Mark invoice as paid in D1
        const now = new Date();
        await db
          .prepare("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?")
          .bind(now.toISOString(), invoiceId)
          .run();

        // Log the verification
        const verifyLogId = `zap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await db
          .prepare(
            `INSERT INTO zap_verifications (id, pubkey, amount_msat, bolt11, invoice_id, status, verified_at, created_at)
             VALUES (?, ?, ?, ?, ?, 'verified', ?, ?)`
          )
          .bind(
            verifyLogId,
            pubkey,
            invoice.amount_msat,
            invoice.bolt11,
            invoiceId,
            now.toISOString(),
            now.toISOString()
          )
          .run();

        return json({
          success: true,
          paid: true,
          subscription: {
            tier: updatedSub.tier,
            buckets: updatedSub.buckets,
            items_per_bucket: updatedSub.items_per_bucket,
            expires_at: updatedSub.expires_at,
            payment_type: updatedSub.payment_type,
          },
        });
      }

      // ─── POST /api/subscription/apply-test-code ──────────────────────────
      // Applies a test code for unlimited access (development only)
      if (pathname === "/api/subscription/apply-test-code" && request.method === "POST") {
        const body = await request.json();
        const { pubkey, testCode } = body;

        if (!pubkey || !testCode) {
          return json({ error: "Missing required fields" }, 400);
        }

        if (!getValidTestCodes(env).includes(testCode)) {
          return json({ error: "Invalid test code" }, 401);
        }

        const now = new Date();
        const farFuture = new Date(2099, 11, 31);

        // Ensure subscription record exists
        await getOrCreateSubscription(db, pubkey);

        await db
          .prepare(
            `UPDATE subscriptions
             SET tier = 'paid', buckets = ?, items_per_bucket = ?, expires_at = ?, payment_type = 'test', updated_at = ?
             WHERE pubkey = ?`
          )
          .bind(
            UNLIMITED_SENTINEL,
            UNLIMITED_SENTINEL,
            farFuture.toISOString(),
            now.toISOString(),
            pubkey
          )
          .run();

        return json({
          success: true,
          message: "Test code applied successfully",
          subscription: {
            tier: 'paid',
            buckets: UNLIMITED_SENTINEL,
            items_per_bucket: UNLIMITED_SENTINEL,
            expires_at: farFuture.toISOString(),
            payment_type: 'test',
          },
        });
      }

      // ─── GET /health ─────────────────────────────────────────────────────
      if (pathname === "/health" && request.method === "GET") {
        return json({ status: "ok" });
      }

      // ─── 404 ─────────────────────────────────────────────────────────────
      return json({ error: "Not Found" }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  },
};
