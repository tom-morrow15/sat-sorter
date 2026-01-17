/**
 * NWC (Nostr Wallet Connect) Client Implementation
 *
 * This implements NIP-47 directly for transaction listing,
 * since the Alby SDK's LN class doesn't expose list_transactions.
 */

import { nip04, nip44, getPublicKey, finalizeEvent, type NostrEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';

export interface NWCTransaction {
  type: 'incoming' | 'outgoing';
  state?: 'pending' | 'settled' | 'expired' | 'failed';
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash: string;
  amount: number; // in millisats
  fees_paid?: number;
  created_at: number; // unix timestamp
  expires_at?: number;
  settled_at?: number;
  metadata?: Record<string, unknown>;
}

export interface NWCInfo {
  alias?: string;
  color?: string;
  pubkey?: string;
  network?: string;
  methods?: string[];
  notifications?: string[];
}

interface NWCConnectionParams {
  walletPubkey: string;
  secret: string;
  relay: string;
}

/**
 * Parse an NWC connection URI into its components
 */
export function parseNWCUri(uri: string): NWCConnectionParams | null {
  try {
    // Support both formats
    const normalizedUri = uri.replace('nostrwalletconnect://', 'nostr+walletconnect://');

    if (!normalizedUri.startsWith('nostr+walletconnect://')) {
      console.warn('[NWC] Invalid URI protocol');
      return null;
    }

    const url = new URL(normalizedUri);
    const walletPubkey = url.hostname || url.pathname.replace('//', '');
    const secret = url.searchParams.get('secret');
    const relay = url.searchParams.get('relay');

    if (!walletPubkey || !secret || !relay) {
      console.warn('[NWC] Missing required parameters in URI');
      return null;
    }

    return {
      walletPubkey,
      secret,
      relay: decodeURIComponent(relay),
    };
  } catch (error) {
    console.warn('[NWC] Failed to parse URI');
    return null;
  }
}

/**
 * Fetch the wallet's info event to check supported methods
 */
export async function fetchWalletInfo(
  params: NWCConnectionParams,
  signal?: AbortSignal
): Promise<NWCInfo | null> {
  const walletId = params.walletPubkey.slice(0, 16);
  console.log('[NWC] Fetching wallet info from:', params.relay, 'for wallet:', walletId + '...');

  return new Promise((resolve) => {
    let hasResolved = false;
    let ws: WebSocket;

    const cleanup = () => {
      if (!hasResolved) {
        hasResolved = true;
      }
    };

    const timeout = setTimeout(() => {
      console.log(`[NWC] Wallet info fetch timed out for ${walletId}`);
      cleanup();
      ws.close();
      resolve(null);
    }, 15000); // Increased timeout for slower nodes

    ws = new WebSocket(params.relay);

    ws.onopen = () => {
      console.log(`[NWC] WebSocket connected to ${params.relay} for wallet ${walletId}`);
      // Subscribe to the wallet's info event (kind 13194)
      const subId = crypto.randomUUID().slice(0, 8);
      ws.send(JSON.stringify([
        'REQ',
        subId,
        {
          kinds: [13194],
          authors: [params.walletPubkey],
          limit: 1,
        }
      ]));
    };

    ws.onmessage = async (event) => {
      if (hasResolved) return;

      try {
        const data = JSON.parse(event.data);
        console.log(`[NWC] [${walletId}] Received message:`, data[0], data[0] === 'EVENT' ? 'kind:' + data[2]?.kind : '');

        if (data[0] === 'EVENT') {
          const infoEvent = data[2] as NostrEvent;
          cleanup();
          clearTimeout(timeout);
          ws.close();

          // Parse the info from the event
          const methods = infoEvent.content.split(' ').filter(Boolean);
          const notificationsTag = infoEvent.tags.find(t => t[0] === 'notifications');

          console.log(`[NWC] [${walletId}] Wallet methods:`, methods);

          resolve({
            methods,
            notifications: notificationsTag ? notificationsTag[1]?.split(' ') : undefined,
          });
        } else if (data[0] === 'EOSE') {
          // No info event found - but wait a bit longer for the event to arrive
          // Some relays send EOSE before the event
          console.log(`[NWC] [${walletId}] EOSE received - waiting briefly for possible delayed event...`);

          // Wait 2 seconds for a possible delayed event before giving up
          setTimeout(() => {
            if (!hasResolved) {
              console.log(`[NWC] [${walletId}] No wallet info event found after EOSE wait`);
              cleanup();
              clearTimeout(timeout);
              ws.close();
              resolve(null);
            }
          }, 2000);
        }
      } catch (error) {
        console.warn(`[NWC] [${walletId}] Error parsing info response`);
      }
    };

    ws.onerror = () => {
      // WebSocket errors are expected when relay is unavailable - log as warning
      console.warn(`[NWC] [${walletId}] WebSocket connection failed (relay may be unavailable)`);
      cleanup();
      clearTimeout(timeout);
      resolve(null);
    };

    signal?.addEventListener('abort', () => {
      cleanup();
      clearTimeout(timeout);
      ws.close();
      resolve(null);
    });
  });
}

/**
 * Make a raw NWC request using Nostr events
 */
async function makeNWCRequest<T>(
  params: NWCConnectionParams,
  method: string,
  requestParams: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs: number = 30000 // 30 second default timeout (reduced from 45s)
): Promise<T> {
  // Pre-compute secret bytes and pubkey before async operations
  const secretBytes = hexToBytes(params.secret);
  const clientPubkey = getPublicKey(secretBytes);

  console.log(`[NWC] Starting ${method} request to wallet ${params.walletPubkey.slice(0, 16)}...`);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(params.relay);
    let requestEventId: string | null = null;
    let hasResolved = false;

    const cleanup = () => {
      if (!hasResolved) {
        hasResolved = true;
      }
    };

    const timeout = setTimeout(() => {
      console.log(`[NWC] ${method} timed out after ${timeoutMs}ms for wallet ${params.walletPubkey.slice(0, 16)}...`);
      cleanup();
      ws.close();
      reject(new Error('Request timed out'));
    }, timeoutMs);

    ws.onopen = async () => {
      try {
        // Create the request payload
        const payload = JSON.stringify({
          method,
          params: requestParams,
        });

        // Try NIP-44 encryption first (preferred)
        let encryptedContent: string;
        try {
          const conversationKey = nip44.utils.getConversationKey(
            secretBytes,
            params.walletPubkey
          );
          encryptedContent = nip44.encrypt(payload, conversationKey);
        } catch {
          // Fall back to NIP-04
          encryptedContent = await nip04.encrypt(params.secret, params.walletPubkey, payload);
        }

        // Create and sign the request event
        const requestEvent = finalizeEvent({
          kind: 23194,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['p', params.walletPubkey],
          ],
          content: encryptedContent,
        }, secretBytes);

        requestEventId = requestEvent.id;

        // Subscribe to responses FIRST before sending the request
        // Use a targeted filter that includes the specific request event ID
        const subId = crypto.randomUUID().slice(0, 8);

        // First, set up a broad subscription to catch any responses to our pubkey
        const broadFilter = {
          kinds: [23195],
          authors: [params.walletPubkey],
          '#p': [clientPubkey],
        };

        console.log(`[NWC] Subscribing for ${method} response:`, {
          subId,
          clientPubkey: clientPubkey.slice(0, 16) + '...',
          walletPubkey: params.walletPubkey.slice(0, 16) + '...',
          requestEventId: requestEvent.id.slice(0, 16) + '...'
        });
        ws.send(JSON.stringify(['REQ', subId, broadFilter]));

        // Wait for subscription confirmation (EOSE) before publishing
        // This ensures the relay is ready to send us events
        await new Promise<void>((resolveWait) => {
          const originalHandler = ws.onmessage;
          const waitHandler = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              if (data[0] === 'EOSE' && data[1] === subId) {
                console.log(`[NWC] Subscription confirmed, now publishing request`);
                ws.onmessage = originalHandler;
                resolveWait();
              } else if (originalHandler) {
                // Pass through to original handler for any other messages
                originalHandler.call(ws, event);
              }
            } catch {
              if (originalHandler) originalHandler.call(ws, event);
            }
          };
          ws.onmessage = waitHandler;

          // Timeout after 2 seconds
          setTimeout(() => {
            ws.onmessage = originalHandler;
            resolveWait();
          }, 2000);
        });

        // Publish the request
        ws.send(JSON.stringify(['EVENT', requestEvent]));
        console.log(`[NWC] Published ${method} request:`, requestEvent.id);

      } catch (error) {
        cleanup();
        clearTimeout(timeout);
        ws.close();
        reject(error);
      }
    };

    ws.onmessage = async (event) => {
      if (hasResolved) return;

      try {
        const data = JSON.parse(event.data);
        const msgType = data[0];

        if (msgType === 'EVENT') {
          console.log(`[NWC] ${method} received EVENT:`, { kind: data[2]?.kind, id: data[2]?.id?.slice(0, 16) + '...' });
        } else {
          console.log(`[NWC] ${method} received message:`, msgType, msgType === 'OK' ? `success:${data[2]}` : '');
        }

        if (data[0] === 'OK' && data[1] && data[2] === false) {
          // Request was rejected by relay
          cleanup();
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Relay rejected request: ${data[3] || 'Unknown error'}`));
          return;
        }

        if (data[0] === 'EVENT' && data[2]?.kind === 23195) {
          const responseEvent = data[2] as NostrEvent;

          // Check if this response is for our request by looking at the 'e' tag
          const eTag = responseEvent.tags.find(t => t[0] === 'e');
          const referencedEventId = eTag?.[1];

          console.log(`[NWC] Response event references:`, {
            referencedEventId: referencedEventId?.slice(0, 16) + '...',
            ourRequestId: requestEventId?.slice(0, 16) + '...',
            matches: referencedEventId === requestEventId
          });

          // Only process if this response is for our specific request
          if (referencedEventId !== requestEventId) {
            console.log(`[NWC] Ignoring response for different request`);
            return;
          }

          // Decrypt the response
          let decryptedContent: string;
          try {
            const conversationKey = nip44.utils.getConversationKey(
              secretBytes,
              params.walletPubkey
            );
            decryptedContent = nip44.decrypt(responseEvent.content, conversationKey);
          } catch {
            // Fall back to NIP-04
            decryptedContent = await nip04.decrypt(params.secret, params.walletPubkey, responseEvent.content);
          }

          const response = JSON.parse(decryptedContent);
          console.log(`[NWC] Decrypted ${method} response:`, {
            hasResult: !!response.result,
            hasError: !!response.error,
            resultType: response.result ? typeof response.result : 'none',
            transactionCount: response.result?.transactions?.length
          });

          cleanup();
          clearTimeout(timeout);
          ws.close();

          if (response.error) {
            reject(new Error(response.error.message || response.error.code || 'Unknown error'));
          } else {
            resolve(response.result as T);
          }
        }
      } catch (error) {
        // Response processing error - log only in debug scenarios
        // console.warn('[NWC] Error processing response');
      }
    };

    ws.onerror = () => {
      // WebSocket errors are expected when relay is unavailable - don't log as error
      console.warn(`[NWC] WebSocket connection failed for ${method} (relay may be unavailable)`);
      cleanup();
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
    };

    ws.onclose = (event) => {
      if (!hasResolved) {
        console.log(`[NWC] WebSocket closed unexpectedly for ${method}:`, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
      }
    };

    signal?.addEventListener('abort', () => {
      cleanup();
      clearTimeout(timeout);
      ws.close();
      reject(new Error('Request aborted'));
    });
  });
}

/**
 * List transactions from an NWC wallet with retry logic
 */
export async function listTransactions(
  connectionString: string,
  options?: {
    from?: number;
    until?: number;
    limit?: number;
    offset?: number;
    type?: 'incoming' | 'outgoing';
    unpaid?: boolean;
  },
  signal?: AbortSignal
): Promise<{ transactions: NWCTransaction[] }> {
  const params = parseNWCUri(connectionString);
  if (!params) {
    throw new Error('Invalid NWC connection string');
  }

  // Try to check if the wallet supports list_transactions
  // If we can't fetch wallet info, we'll try anyway and handle errors from the request
  const info = await fetchWalletInfo(params, signal);
  console.log('[NWC] Wallet info:', info);

  // Only block if wallet info explicitly shows list_transactions is not supported
  if (info?.methods && info.methods.length > 0 && !info.methods.includes('list_transactions')) {
    throw new Error(
      `This wallet doesn't support transaction listing. Supported methods: ${info.methods.join(', ')}`
    );
  }

  if (!info) {
    console.log('[NWC] Could not fetch wallet info, attempting list_transactions anyway...');
  }

  // Retry logic for list_transactions - reduced retries to avoid blocking
  const maxRetries = 1; // Only 1 retry (2 total attempts) to avoid blocking other wallets
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[NWC] Retry attempt ${attempt}/${maxRetries} for list_transactions...`);
        // Add a small delay between retries to avoid hammering the relay
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }

      const result = await makeNWCRequest<{ transactions: NWCTransaction[] }>(
        params,
        'list_transactions',
        {
          from: options?.from,
          until: options?.until,
          limit: options?.limit ?? 100,
          offset: options?.offset ?? 0,
          type: options?.type,
          unpaid: options?.unpaid ?? false,
        },
        signal
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[NWC] list_transactions attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry if it's a non-timeout error, if aborted, or if signal was aborted
      if (!lastError.message.includes('timed out') && !lastError.message.includes('aborted')) {
        throw lastError;
      }
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }
    }
  }

  throw lastError || new Error('list_transactions failed after retries');
}

/**
 * Get wallet info via NWC
 */
export async function getWalletInfo(
  connectionString: string,
  signal?: AbortSignal
): Promise<NWCInfo> {
  const params = parseNWCUri(connectionString);
  if (!params) {
    throw new Error('Invalid NWC connection string');
  }

  return makeNWCRequest<NWCInfo>(
    params,
    'get_info',
    {},
    signal
  );
}

/**
 * Get wallet balance via NWC
 */
export async function getWalletBalance(
  connectionString: string,
  signal?: AbortSignal
): Promise<{ balance: number }> {
  const params = parseNWCUri(connectionString);
  if (!params) {
    throw new Error('Invalid NWC connection string');
  }

  return makeNWCRequest<{ balance: number }>(
    params,
    'get_balance',
    {},
    signal
  );
}
