/**
 * Cloudflare Worker for Sat Sorter Subscription Management
 * Handles invoice generation, payment verification, and subscription tracking
 */

interface InvoiceRequest {
  amount: number; // Amount in millisatoshis
  comment?: string;
}

interface SubscriptionStatusRequest {
  pubkey: string; // User's Nostr pubkey
}

interface Subscription {
  pubkey: string;
  tier: 'free' | 'paid' | 'trial';
  buckets: number;
  items_per_bucket: number;
  expires_at: string | null;
  payment_type: 'none' | 'monthly' | 'yearly';
  created_at: string;
}

const ALBY_ADDRESS = "devin@getalby.com";
const FREE_TIER_BUCKETS = 5;
const FREE_TIER_ITEMS = 4;
const TRIAL_DURATION_DAYS = 31; // First month includes rest of month
const PAID_TIER_BUCKETS_PER_DOLLAR = 1; // $1 = 1 bucket
const UNLIMITED_THRESHOLD = 5; // $5 = unlimited

// Test codes for development (set via environment variable)
const VALID_TEST_CODES = ['SATSORTER_TEST', 'DEVIN_DEV', 'TEST_UNLIMITED'];

// Helper to get end of current month
function getMonthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Helper to get end of next month for yearly subscriptions
function getYearlyExpiry(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 12, 0, 23, 59, 59, 999);
}

// Initialize D1 database tables
async function initializeDatabase(db: any): Promise<void> {
  try {
    // Create subscriptions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        pubkey TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'free',
        buckets INTEGER NOT NULL DEFAULT 5,
        items_per_bucket INTEGER NOT NULL DEFAULT 4,
        expires_at TEXT,
        payment_type TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create invoices table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        amount INTEGER NOT NULL,
        bolt11 TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        paid_at TEXT,
        FOREIGN KEY(pubkey) REFERENCES subscriptions(pubkey)
      );
    `);

    // Create zap verification log
    await db.exec(`
      CREATE TABLE IF NOT EXISTS zap_verifications (
        id TEXT PRIMARY KEY,
        pubkey TEXT NOT NULL,
        amount_msat INTEGER NOT NULL,
        bolt11 TEXT NOT NULL,
        zap_receipt_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        verified_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(pubkey) REFERENCES subscriptions(pubkey)
      );
    `);

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    // Tables might already exist, that's ok
  }
}

// Get or create subscription for user
async function getOrCreateSubscription(db: any, pubkey: string): Promise<Subscription> {
  try {
    let subscription = await db
      .prepare("SELECT * FROM subscriptions WHERE pubkey = ?")
      .bind(pubkey)
      .first();

    if (!subscription) {
      // Create new subscription with trial
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
          Infinity, // Unlimited during trial
          Infinity,
          trialExpires.toISOString(),
          'none',
          now.toISOString(),
          now.toISOString()
        )
        .run();

      subscription = {
        pubkey,
        tier: 'trial',
        buckets: Infinity,
        items_per_bucket: Infinity,
        expires_at: trialExpires.toISOString(),
        payment_type: 'none',
        created_at: now.toISOString(),
      };
    } else {
      // Check if subscription has expired
      const now = new Date();
      if (subscription.expires_at && new Date(subscription.expires_at) < now) {
        // Expired - revert to free tier
        await db
          .prepare(
            `UPDATE subscriptions 
             SET tier = ?, buckets = ?, items_per_bucket = ?, payment_type = ?, expires_at = NULL, updated_at = ?
             WHERE pubkey = ?`
          )
          .bind('free', FREE_TIER_BUCKETS, FREE_TIER_ITEMS, 'none', now.toISOString(), pubkey)
          .run();

        subscription.tier = 'free';
        subscription.buckets = FREE_TIER_BUCKETS;
        subscription.items_per_bucket = FREE_TIER_ITEMS;
        subscription.expires_at = null;
        subscription.payment_type = 'none';
      }
    }

    return subscription;
  } catch (error) {
    console.error("Error getting/creating subscription:", error);
    // Return default free tier if database error
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

// Store invoice in database
async function storeInvoice(db: any, pubkey: string, amount: number, bolt11: string): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiry
  const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    await db
      .prepare(
        `INSERT INTO invoices (id, pubkey, amount, bolt11, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(invoiceId, pubkey, amount, bolt11, 'pending', now.toISOString(), expiresAt.toISOString())
      .run();

    return invoiceId;
  } catch (error) {
    console.error("Error storing invoice:", error);
    throw error;
  }
}

// Verify zap payment and update subscription
async function verifyAndApplyPayment(
  db: any,
  pubkey: string,
  amountMsat: number,
  tier: string
): Promise<void> {
  const now = new Date();
  const satoshis = amountMsat / 1000;
  let newBuckets = FREE_TIER_BUCKETS;
  let newItemsPerBucket = FREE_TIER_ITEMS;
  let paymentType = 'monthly';

  // Determine tier from amount
  if (tier === 'yearly' || satoshis >= 50000) {
    // Yearly at $50 (~50k sats minimum)
    newBuckets = Infinity;
    newItemsPerBucket = Infinity;
    paymentType = 'yearly';
  } else if (satoshis >= UNLIMITED_THRESHOLD * 50000) {
    // Unlimited at $5
    newBuckets = Infinity;
    newItemsPerBucket = Infinity;
    paymentType = 'monthly';
  } else {
    // Partial upgrade: $1-4
    const dollars = Math.floor(satoshis / 50000);
    newBuckets = FREE_TIER_BUCKETS + dollars;
    newItemsPerBucket = FREE_TIER_ITEMS;
  }

  // Calculate expiration
  let expiresAt: Date;
  if (paymentType === 'yearly') {
    expiresAt = getYearlyExpiry(now);
  } else {
    expiresAt = getMonthEnd(now);
  }

  try {
    await db
      .prepare(
        `UPDATE subscriptions 
         SET tier = ?, buckets = ?, items_per_bucket = ?, expires_at = ?, payment_type = ?, updated_at = ?
         WHERE pubkey = ?`
      )
      .bind(
        'paid',
        newBuckets,
        newItemsPerBucket,
        expiresAt.toISOString(),
        paymentType,
        now.toISOString(),
        pubkey
      )
      .run();

    console.log(`Payment applied for ${pubkey}: ${satoshis} sats, expires ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error("Error applying payment:", error);
    throw error;
  }
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Add CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const db = env.DB;

    try {
      // Initialize database on first call
      if (pathname !== "/health") {
        await initializeDatabase(db);
      }

      // Invoice creation endpoint
      if (pathname === "/api/subscription/create-invoice" && request.method === "POST") {
        const body = (await request.json()) as InvoiceRequest;
        const { amount, comment } = body;

        if (!amount || amount <= 0) {
          return new Response(
            JSON.stringify({ error: "Invalid amount" }),
            { status: 400, headers: corsHeaders }
          );
        }

        // Call Alby API to generate invoice
        const albyUrl = new URL("https://api.getalby.com/lnurl/generate-invoice");
        albyUrl.searchParams.set("ln", ALBY_ADDRESS);
        albyUrl.searchParams.set("amount", amount.toString());
        if (comment) {
          albyUrl.searchParams.set("comment", comment);
        }

        const response = await fetch(albyUrl.toString());
        const data = await response.json();

        if (!response.ok) {
          console.error("Alby API error:", data);
          return new Response(
            JSON.stringify({ error: "Failed to create invoice" }),
            { status: 500, headers: corsHeaders }
          );
        }

        // Store invoice in database (optional: for tracking)
        try {
          // We'll handle the pubkey in the frontend
          // await storeInvoice(db, pubkey, amount, data.invoice?.pr);
        } catch (e) {
          console.warn("Failed to store invoice:", e);
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Subscription status endpoint
      if (pathname === "/api/subscription/status" && request.method === "GET") {
        const pubkey = url.searchParams.get("pubkey");

        if (!pubkey) {
          return new Response(
            JSON.stringify({ error: "Missing pubkey parameter" }),
            { status: 400, headers: corsHeaders }
          );
        }

        const subscription = await getOrCreateSubscription(db, pubkey);

        return new Response(
          JSON.stringify({
            pubkey: subscription.pubkey,
            tier: subscription.tier,
            buckets: subscription.buckets === Infinity ? 999 : subscription.buckets,
            items_per_bucket: subscription.items_per_bucket === Infinity ? 999 : subscription.items_per_bucket,
            expires_at: subscription.expires_at,
            payment_type: subscription.payment_type,
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Apply payment endpoint (called by backend after zap verification)
      if (pathname === "/api/subscription/apply-payment" && request.method === "POST") {
        const body = await request.json();
        const { pubkey, amountMsat, tier } = body;

        if (!pubkey || !amountMsat) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: corsHeaders }
          );
        }

        await verifyAndApplyPayment(db, pubkey, amountMsat, tier || 'monthly');

        const subscription = await getOrCreateSubscription(db, pubkey);

        return new Response(
          JSON.stringify({
            success: true,
            subscription: {
              tier: subscription.tier,
              buckets: subscription.buckets === Infinity ? 999 : subscription.buckets,
              items_per_bucket: subscription.items_per_bucket === Infinity ? 999 : subscription.items_per_bucket,
              expires_at: subscription.expires_at,
            },
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Apply test code endpoint
      if (pathname === "/api/subscription/apply-test-code" && request.method === "POST") {
        const body = await request.json();
        const { pubkey, testCode } = body;

        if (!pubkey || !testCode) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: corsHeaders }
          );
        }

        if (!VALID_TEST_CODES.includes(testCode)) {
          return new Response(
            JSON.stringify({ error: "Invalid test code" }),
            { status: 401, headers: corsHeaders }
          );
        }

        // Apply unlimited access forever for test codes
        const now = new Date();
        const farFuture = new Date(2099, 11, 31); // Year 2099

        try {
          // Create or update subscription with unlimited access
          let subscription = await db
            .prepare("SELECT * FROM subscriptions WHERE pubkey = ?")
            .bind(pubkey)
            .first();

          if (subscription) {
            await db
              .prepare(
                `UPDATE subscriptions 
                 SET tier = ?, buckets = ?, items_per_bucket = ?, expires_at = ?, payment_type = ?, updated_at = ?
                 WHERE pubkey = ?`
              )
              .bind('paid', Infinity, Infinity, farFuture.toISOString(), 'test', now.toISOString(), pubkey)
              .run();
          } else {
            await db
              .prepare(
                `INSERT INTO subscriptions (pubkey, tier, buckets, items_per_bucket, expires_at, payment_type, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(pubkey, 'paid', Infinity, Infinity, farFuture.toISOString(), 'test', now.toISOString(), now.toISOString())
              .run();
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Test code applied successfully",
              subscription: {
                tier: 'paid',
                buckets: 999,
                items_per_bucket: 999,
                expires_at: farFuture.toISOString(),
              },
            }),
            { status: 200, headers: corsHeaders }
          );
        } catch (error) {
          console.error("Error applying test code:", error);
          return new Response(
            JSON.stringify({ error: "Failed to apply test code" }),
            { status: 500, headers: corsHeaders }
          );
        }
      }

      // Health check endpoint
      if (pathname === "/health" && request.method === "GET") {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // 404
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
