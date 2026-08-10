/**
 * Cloudflare Worker for Sat Sorter Subscription Management
 * Handles invoice generation and payment verification
 */

interface InvoiceRequest {
  amount: number; // Amount in millisatoshis
  comment?: string;
}

interface SubscriptionStatusRequest {
  pubkey: string; // User's Nostr pubkey
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

    try {
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
        albyUrl.searchParams.set("ln", "devin@getalby.com");
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

        // TODO: Store invoice in D1 database for verification later
        // const db = env.DB;
        // await db.prepare(
        //   "INSERT INTO invoices (invoice_hash, amount, created_at) VALUES (?, ?, ?)"
        // ).run(data.invoice?.pr, amount, new Date().toISOString());

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

        // TODO: Query D1 database for user's subscription status
        // const db = env.DB;
        // const subscription = await db.prepare(
        //   "SELECT tier, expires_at FROM subscriptions WHERE pubkey = ?"
        // ).first(pubkey);

        // For now, return default free tier
        return new Response(
          JSON.stringify({
            pubkey,
            tier: "free",
            buckets: 5,
            items_per_bucket: 4,
            expires_at: null,
          }),
          { status: 200, headers: corsHeaders }
        );
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
