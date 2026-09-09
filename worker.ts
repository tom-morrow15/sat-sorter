/**
 * Cloudflare Worker for Sat Sorter Subscription Management
 * Handles invoice generation, payment verification, and subscription tracking
 *
 * Security model:
 * - NIP-98 HTTP Auth required on all mutating endpoints (create-invoice,
 *   verify-payment, apply-test-code). The client signs a kind 27235 event
 *   with the request URL and method; the worker verifies the signature.
 * - Pubkeys are validated as 64-char hex before any DB operation.
 * - Rate limiting: simple in-memory per-IP counter (resets on worker restart).
 * - Invoices are stored in D1 with the user's pubkey at creation time.
 * - Payment verification calls Alby's verify endpoint to confirm payment.
 * - Each invoice can only be used once (prevents replay attacks).
 * - The pubkey on the invoice must match the pubkey requesting verification.
 * - Error responses never leak internal error details.
 *
 * Test codes:
 * - Stored as Cloudflare Worker Secret (VALID_TEST_CODES env variable)
 * - NOT in the codebase or git repo
 * - Set via: npx wrangler secret put VALID_TEST_CODES
 * - Format: comma-separated string like "CODE1,CODE2,CODE3"
 * - To add/remove codes, update the secret and redeploy
 * - Rate limited: max 5 attempts per IP per 10 minutes
 */

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateInvoiceRequest {
  amount: number; // Amount in millisatoshis
  comment?: string;
  pubkey: string; // User's Nostr pubkey (hex, 64 chars)
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

// ─── Constants ───────────────────────────────────────────────────────────────

const ALBY_ADDRESS = "satsorter@getalby.com";
const FREE_TIER_BUCKETS = 5;
const FREE_TIER_ITEMS = 4;
const UNLIMITED_SENTINEL = 999999; // Used instead of Infinity for SQLite compatibility

// Satoshis per dollar (approximate, used for tier calculation)
const SATS_PER_USD = 50000;

// Rate limiting: max requests per window per IP
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 30; // general limit
const RATE_LIMIT_TEST_CODE_MAX = 5; // stricter for test code attempts

// NIP-98 auth: max clock skew (seconds) for the signed event timestamp
const NIP98_MAX_SKEW_SECONDS = 60;

// ─── Validation ──────────────────────────────────────────────────────────────

/** Validate that a string is a 64-character lowercase hex Nostr pubkey. */
function isValidPubkey(pubkey: string | null | undefined): pubkey is string {
  if (!pubkey || typeof pubkey !== 'string') return false;
  return /^[0-9a-f]{64}$/.test(pubkey);
}

// ─── Rate Limiting (in-memory, per-isolate) ──────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/** Check rate limit for an IP + endpoint category. Returns true if allowed. */
function checkRateLimit(ip: string, category: string, max: number): boolean {
  const key = `${ip}:${category}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= max;
}

/** Get client IP from request (best-effort on Cloudflare Workers). */
function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Real-IP') ||
    'unknown';
}

// ─── NIP-98 HTTP Auth Verification ──────────────────────────────────────────

/**
 * Verify a NIP-98 HTTP Auth event from the Authorization header.
 *
 * NIP-98 spec: https://github.com/nostr-protocol/nips/blob/master/98.md
 *
 * The client signs a kind 27235 event with:
 * - u tag: the full request URL
 * - method tag: the HTTP method (GET, POST, etc.)
 *
 * The worker verifies:
 * - The event is kind 27235
 * - The signature is valid (secp256k1 Schnorr)
 * - The u tag matches the request URL
 * - The method tag matches the request method
 * - The created_at is within the acceptable clock skew
 *
 * Returns the verified pubkey, or null if verification fails.
 */
async function verifyNip98Auth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Nostr ')) {
    return null;
  }

  const token = authHeader.slice(6).trim();
  let event: any;
  try {
    event = JSON.parse(atob(token));
  } catch {
    return null;
  }

  // Basic structural validation
  if (!event || event.kind !== 27235) return null;
  if (!event.pubkey || !event.sig || !event.id || !event.created_at) return null;

  // Validate pubkey format
  if (!isValidPubkey(event.pubkey)) return null;

  // Check timestamp freshness
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - event.created_at) > NIP98_MAX_SKEW_SECONDS) return null;

  // Verify u tag matches the request URL
  const tags = event.tags || [];
  const uTag = tags.find((t: string[]) => t[0] === 'u');
  const methodTag = tags.find((t: string[]) => t[0] === 'method');

  if (!uTag || !uTag[1]) return null;
  if (!methodTag || !methodTag[1]) return null;

  // The u tag should match the request URL (at minimum, same origin + path)
  try {
    const requestUrl = new URL(request.url);
    const tagUrl = new URL(uTag[1]);
    // Allow same path (the URL might differ in query params for GET requests)
    if (tagUrl.origin !== requestUrl.origin || tagUrl.pathname !== requestUrl.pathname) {
      return null;
    }
  } catch {
    return null;
  }

  // Verify method matches (case-insensitive)
  if (methodTag[1].toUpperCase() !== request.method.toUpperCase()) {
    return null;
  }

  // Verify the Nostr event signature (Schnorr/BIP-340 on secp256k1)
  // Uses nostr-tools' verifyEvent which is already a project dependency
  const isValid = await verifyNostrSignature(event);
  if (!isValid) return null;

  return event.pubkey;
}

/**
 * Verify a Nostr event signature using nostr-tools.
 * nostr-tools is already a project dependency and works in Cloudflare Workers.
 */
async function verifyNostrSignature(event: any): Promise<boolean> {
  try {
    // Dynamic import of nostr-tools for signature verification.
    // nostr-tools provides `verifyEvent` which handles Schnorr (BIP-340)
    // signature verification on secp256k1.
    const { verifyEvent, validateEvent } = await import('nostr-tools');

    // First validate the event structure
    if (!validateEvent(event)) {
      return false;
    }

    // Verify the Schnorr signature
    return verifyEvent(event);
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getValidTestCodes(env: any): string[] {
  const raw = env.VALID_TEST_CODES || '';
  return raw.split(',').map((c: string) => c.trim()).filter(Boolean);
}

function getMonthEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getYearlyExpiry(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 12, 0, 23, 59, 59, 999);
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

// ─── Database ───────────────────────────────────────────────────────────────

let dbInitialized = false;

async function initializeDatabase(db: any): Promise<void> {
  if (dbInitialized) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS subscriptions (pubkey TEXT PRIMARY KEY, tier TEXT NOT NULL DEFAULT 'free', buckets INTEGER NOT NULL DEFAULT 5, items_per_bucket INTEGER NOT NULL DEFAULT 4, expires_at TEXT, payment_type TEXT NOT NULL DEFAULT 'none', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, amount_msat INTEGER NOT NULL, bolt11 TEXT NOT NULL, verify_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', tier_requested TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, paid_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS zap_verifications (id TEXT PRIMARY KEY, pubkey TEXT NOT NULL, amount_msat INTEGER NOT NULL, bolt11 TEXT NOT NULL, invoice_id TEXT, status TEXT NOT NULL DEFAULT 'verified', verified_at TEXT NOT NULL, created_at TEXT NOT NULL)`
  ];

  for (const stmt of statements) {
    try {
      await db.exec(stmt);
    } catch {
      try {
        await db.prepare(stmt).run();
      } catch (e2) {
        console.error("Failed to create table:", stmt.substring(0, 50), e2);
      }
    }
  }

  dbInitialized = true;
}

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

function determineTierFromAmount(amountMsat: number): {
  buckets: number;
  itemsPerBucket: number;
  paymentType: 'monthly' | 'yearly';
} {
  const satoshis = amountMsat / 1000;

  // Yearly: $50 = 2,500,000 sats
  if (satoshis >= 50 * SATS_PER_USD) {
    return { buckets: UNLIMITED_SENTINEL, itemsPerBucket: UNLIMITED_SENTINEL, paymentType: 'yearly' };
  }

  // Unlimited monthly: $5 = 250,000 sats
  if (satoshis >= 5 * SATS_PER_USD) {
    return { buckets: UNLIMITED_SENTINEL, itemsPerBucket: UNLIMITED_SENTINEL, paymentType: 'monthly' };
  }

  // Partial upgrades: $1-4 = 50,000-200,000 sats
  const dollars = Math.floor(satoshis / SATS_PER_USD);
  return { buckets: FREE_TIER_BUCKETS + dollars, itemsPerBucket: FREE_TIER_ITEMS, paymentType: 'monthly' };
}

async function applyPayment(db: any, pubkey: string, amountMsat: number): Promise<Subscription> {
  const now = new Date();
  const tierInfo = determineTierFromAmount(amountMsat);

  const expiresAt = tierInfo.paymentType === 'yearly'
    ? getYearlyExpiry(now)
    : getMonthEnd(now);

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

// ─── Main Worker ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const db = env.DB;
    const clientIp = getClientIp(request);

    try {
      if (pathname !== "/health") {
        await initializeDatabase(db);
      }

      // ─── POST /api/subscription/init-db ─────────────────────────────────
      if (pathname === "/api/subscription/init-db" && request.method === "POST") {
        dbInitialized = false;
        await initializeDatabase(db);
        return json({ success: true, message: "Database initialization attempted" });
      }

      // ─── POST /api/subscription/create-invoice ───────────────────────────
      if (pathname === "/api/subscription/create-invoice" && request.method === "POST") {
        // Rate limit
        if (!checkRateLimit(clientIp, 'create-invoice', 10)) {
          return json({ error: "Rate limit exceeded. Please try again later." }, 429);
        }

        // Require NIP-98 auth
        const authedPubkey = await verifyNip98Auth(request);
        if (!authedPubkey) {
          return json({ error: "Authentication required. Please sign in with your Nostr key." }, 401);
        }

        const body = (await request.json()) as CreateInvoiceRequest;
        const { amount, comment } = body;

        // Use the authenticated pubkey, not one from the request body
        const pubkey = authedPubkey;

        if (!amount || amount <= 0 || amount > 10000000000) { // max 10M sats
          return json({ error: "Invalid amount" }, 400);
        }

        try {
          // Step 1: Fetch LNURL pay details for the address
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

          // Step 3: Call the callback URL with the amount to get an invoice
          const invoiceUrl = new URL(callbackUrl);
          invoiceUrl.searchParams.set('amount', amount.toString());
          if (comment) {
            invoiceUrl.searchParams.set('comment', comment.substring(0, 144)); // truncate comment
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
          const invoiceId = `inv_${now.getTime()}_${Math.random().toString(36).substring(2, 11)}`;

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
      if (pathname === "/api/subscription/status" && request.method === "GET") {
        const pubkey = url.searchParams.get("pubkey");

        if (!pubkey) {
          return json({ error: "Missing pubkey parameter" }, 400);
        }

        // Validate pubkey format
        if (!isValidPubkey(pubkey)) {
          return json({ error: "Invalid pubkey format" }, 400);
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
      if (pathname === "/api/subscription/verify-payment" && request.method === "POST") {
        // Rate limit
        if (!checkRateLimit(clientIp, 'verify-payment', 30)) {
          return json({ error: "Rate limit exceeded. Please try again later." }, 429);
        }

        // Require NIP-98 auth
        const authedPubkey = await verifyNip98Auth(request);
        if (!authedPubkey) {
          return json({ error: "Authentication required. Please sign in with your Nostr key." }, 401);
        }

        const body = (await request.json()) as VerifyPaymentRequest;
        const { invoiceId } = body;

        // Use the authenticated pubkey
        const pubkey = authedPubkey;

        if (!invoiceId) {
          return json({ error: "Missing invoiceId" }, 400);
        }

        // Look up the invoice in D1 — must match both the invoice ID AND the pubkey
        const invoice = await db
          .prepare("SELECT * FROM invoices WHERE id = ? AND pubkey = ?")
          .bind(invoiceId, pubkey)
          .first();

        if (!invoice) {
          return json({ error: "Invoice not found for this user" }, 404);
        }

        if (invoice.status === 'paid') {
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

        // Check if invoice has expired
        if (invoice.expires_at && new Date(invoice.expires_at) < new Date()) {
          return json({ error: "Invoice has expired" }, 400);
        }

        // Call the verify endpoint to check if the invoice was actually paid
        let verifyResult: any;
        try {
          const verifyResponse = await fetch(invoice.verify_url as string);
          verifyResult = await verifyResponse.json();
        } catch {
          return json({ error: "Failed to verify payment" }, 502);
        }

        const isPaid = verifyResult?.settled === true ||
          verifyResult?.paid === true ||
          (verifyResult?.status === 'OK' && verifyResult?.paid === true);

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
        const verifyLogId = `zap_${now.getTime()}_${Math.random().toString(36).substring(2, 11)}`;
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
      if (pathname === "/api/subscription/apply-test-code" && request.method === "POST") {
        // Rate limit — strict for test code attempts (prevents brute force)
        if (!checkRateLimit(clientIp, 'test-code', RATE_LIMIT_TEST_CODE_MAX)) {
          return json({ error: "Too many attempts. Please try again later." }, 429);
        }

        // Require NIP-98 auth
        const authedPubkey = await verifyNip98Auth(request);
        if (!authedPubkey) {
          return json({ error: "Authentication required." }, 401);
        }

        const body = await request.json();
        const { testCode } = body;

        // Use the authenticated pubkey
        const pubkey = authedPubkey;

        if (!testCode) {
          return json({ error: "Missing test code" }, 400);
        }

        if (!getValidTestCodes(env).includes(testCode)) {
          return json({ error: "Invalid test code" }, 401);
        }

        const now = new Date();
        const farFuture = new Date(2099, 11, 31);

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
      // Never expose internal error details to the client
      return json({ error: "Internal server error" }, 500);
    }
  },
};
