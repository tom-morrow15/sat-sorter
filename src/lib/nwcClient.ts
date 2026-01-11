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
      console.error('[NWC] Invalid URI protocol');
      return null;
    }

    const url = new URL(normalizedUri);
    const walletPubkey = url.hostname || url.pathname.replace('//', '');
    const secret = url.searchParams.get('secret');
    const relay = url.searchParams.get('relay');

    if (!walletPubkey || !secret || !relay) {
      console.error('[NWC] Missing required parameters', { walletPubkey: !!walletPubkey, secret: !!secret, relay: !!relay });
      return null;
    }

    return {
      walletPubkey,
      secret,
      relay: decodeURIComponent(relay),
    };
  } catch (error) {
    console.error('[NWC] Failed to parse URI:', error);
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
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 10000);

    const ws = new WebSocket(params.relay);

    ws.onopen = () => {
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
      try {
        const data = JSON.parse(event.data);

        if (data[0] === 'EVENT') {
          const infoEvent = data[2] as NostrEvent;
          clearTimeout(timeout);
          ws.close();

          // Parse the info from the event
          const methods = infoEvent.content.split(' ').filter(Boolean);
          const notificationsTag = infoEvent.tags.find(t => t[0] === 'notifications');

          resolve({
            methods,
            notifications: notificationsTag ? notificationsTag[1]?.split(' ') : undefined,
          });
        } else if (data[0] === 'EOSE') {
          // No info event found
          clearTimeout(timeout);
          ws.close();
          resolve(null);
        }
      } catch (error) {
        console.error('[NWC] Error parsing info response:', error);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    signal?.addEventListener('abort', () => {
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
  signal?: AbortSignal
): Promise<T> {
  // Pre-compute secret bytes and pubkey before async operations
  const secretBytes = hexToBytes(params.secret);
  const clientPubkey = getPublicKey(secretBytes);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(params.relay);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Request timed out'));
    }, 30000);

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

        // Subscribe to responses
        const subId = crypto.randomUUID().slice(0, 8);
        ws.send(JSON.stringify([
          'REQ',
          subId,
          {
            kinds: [23195],
            '#p': [clientPubkey],
            '#e': [requestEvent.id],
            since: Math.floor(Date.now() / 1000) - 10,
          }
        ]));

        // Publish the request
        ws.send(JSON.stringify(['EVENT', requestEvent]));

        console.log(`[NWC] Sent ${method} request:`, requestEvent.id);
      } catch (error) {
        clearTimeout(timeout);
        ws.close();
        reject(error);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data[0] === 'OK' && data[1] && data[2] === false) {
          // Request was rejected by relay
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Relay rejected request: ${data[3] || 'Unknown error'}`));
          return;
        }

        if (data[0] === 'EVENT' && data[2]?.kind === 23195) {
          const responseEvent = data[2] as NostrEvent;

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
          console.log(`[NWC] Received ${method} response:`, response);

          clearTimeout(timeout);
          ws.close();

          if (response.error) {
            reject(new Error(response.error.message || response.error.code || 'Unknown error'));
          } else {
            resolve(response.result as T);
          }
        }
      } catch (error) {
        console.error('[NWC] Error processing response:', error);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection failed'));
    };

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      ws.close();
      reject(new Error('Request aborted'));
    });
  });
}

/**
 * List transactions from an NWC wallet
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

  // First check if the wallet supports list_transactions
  const info = await fetchWalletInfo(params, signal);
  console.log('[NWC] Wallet info:', info);

  if (info?.methods && !info.methods.includes('list_transactions')) {
    throw new Error(
      `This wallet doesn't support transaction listing. Supported methods: ${info.methods.join(', ')}`
    );
  }

  return makeNWCRequest<{ transactions: NWCTransaction[] }>(
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
