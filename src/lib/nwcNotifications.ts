/**
 * NWC Real-Time Notification Manager
 *
 * Maintains persistent WebSocket connections to wallet relays
 * and listens for payment_received and payment_sent notifications.
 */

import { nip04, nip44, getPublicKey } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';
import { parseNWCUri } from './nwcClient';

export interface NWCNotification {
  type: 'incoming' | 'outgoing';
  state?: string;
  invoice?: string;
  description?: string;
  preimage?: string;
  payment_hash: string;
  amount: number; // in millisats
  fees_paid?: number;
  created_at: number;
  expires_at?: number;
  settled_at?: number;
  metadata?: Record<string, unknown>;
}

export interface ParsedNotification {
  notification_type: 'payment_received' | 'payment_sent';
  notification: NWCNotification;
}

type NotificationCallback = (notification: NWCNotification, walletAlias: string, connectionString: string) => void;

interface WalletSubscription {
  connectionString: string;
  alias: string;
  ws: WebSocket | null;
  clientPubkey: string;
  secretBytes: Uint8Array;
  walletPubkey: string;
  relay: string;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  isClosing: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;

/**
 * Manages real-time NWC notification subscriptions for multiple wallets
 */
export class NWCNotificationManager {
  private subscriptions: Map<string, WalletSubscription> = new Map();
  private onNotification: NotificationCallback;
  private isDestroyed = false;

  constructor(onNotification: NotificationCallback) {
    this.onNotification = onNotification;
  }

  /**
   * Subscribe to notifications from a wallet
   */
  subscribe(connectionString: string, alias: string): boolean {
    if (this.isDestroyed) return false;

    // Already subscribed
    if (this.subscriptions.has(connectionString)) {
      console.log(`[NWC Notifications] Already subscribed to ${alias}`);
      return true;
    }

    const params = parseNWCUri(connectionString);
    if (!params) {
      console.warn(`[NWC Notifications] Invalid connection string for ${alias}`);
      return false;
    }

    const secretBytes = hexToBytes(params.secret);
    const clientPubkey = getPublicKey(secretBytes);

    const subscription: WalletSubscription = {
      connectionString,
      alias,
      ws: null,
      clientPubkey,
      secretBytes,
      walletPubkey: params.walletPubkey,
      relay: params.relay,
      reconnectAttempts: 0,
      reconnectTimer: null,
      isClosing: false,
    };

    this.subscriptions.set(connectionString, subscription);
    this.connect(subscription);

    return true;
  }

  /**
   * Unsubscribe from a wallet's notifications
   */
  unsubscribe(connectionString: string): void {
    const subscription = this.subscriptions.get(connectionString);
    if (!subscription) return;

    subscription.isClosing = true;

    if (subscription.reconnectTimer) {
      clearTimeout(subscription.reconnectTimer);
    }

    if (subscription.ws) {
      subscription.ws.close();
    }

    this.subscriptions.delete(connectionString);
    console.log(`[NWC Notifications] Unsubscribed from ${subscription.alias}`);
  }

  /**
   * Unsubscribe from all wallets and clean up
   */
  destroy(): void {
    this.isDestroyed = true;

    for (const connectionString of this.subscriptions.keys()) {
      this.unsubscribe(connectionString);
    }
  }

  /**
   * Get list of active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Check if a wallet is subscribed
   */
  isSubscribed(connectionString: string): boolean {
    return this.subscriptions.has(connectionString);
  }

  private connect(subscription: WalletSubscription): void {
    if (this.isDestroyed || subscription.isClosing) return;

    const walletId = subscription.walletPubkey.slice(0, 12);
    console.log(`[NWC Notifications] Connecting to ${subscription.alias} (${walletId}...)`);

    try {
      const ws = new WebSocket(subscription.relay);
      subscription.ws = ws;

      ws.onopen = () => {
        if (subscription.isClosing) {
          ws.close();
          return;
        }

        console.log(`[NWC Notifications] Connected to ${subscription.alias}`);
        subscription.reconnectAttempts = 0;

        // Subscribe to notification events (kind 23196 for NIP-04, 23197 for NIP-44)
        // We subscribe to both to support all wallet implementations
        const subId = `notif-${walletId}`;
        const filter = {
          kinds: [23196, 23197],
          authors: [subscription.walletPubkey],
          '#p': [subscription.clientPubkey],
        };

        ws.send(JSON.stringify(['REQ', subId, filter]));
        console.log(`[NWC Notifications] Subscribed to notifications for ${subscription.alias}`);
      };

      ws.onmessage = async (event) => {
        if (subscription.isClosing) return;

        try {
          const data = JSON.parse(event.data);

          if (data[0] === 'EVENT') {
            const nostrEvent = data[2];

            // Only process notification events
            if (nostrEvent.kind !== 23196 && nostrEvent.kind !== 23197) return;

            await this.handleNotificationEvent(subscription, nostrEvent);
          }
        } catch (error) {
          // Silently ignore parse errors
        }
      };

      ws.onerror = () => {
        // WebSocket errors are common, will reconnect
      };

      ws.onclose = () => {
        if (!subscription.isClosing && !this.isDestroyed) {
          this.scheduleReconnect(subscription);
        }
      };
    } catch (error) {
      console.warn(`[NWC Notifications] Failed to connect to ${subscription.alias}`);
      this.scheduleReconnect(subscription);
    }
  }

  private scheduleReconnect(subscription: WalletSubscription): void {
    if (subscription.isClosing || this.isDestroyed) return;
    if (subscription.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[NWC Notifications] Max reconnect attempts reached for ${subscription.alias}`);
      return;
    }

    subscription.reconnectAttempts++;

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, subscription.reconnectAttempts - 1),
      RECONNECT_MAX_DELAY_MS
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    console.log(`[NWC Notifications] Reconnecting to ${subscription.alias} in ${Math.round(delay / 1000)}s (attempt ${subscription.reconnectAttempts})`);

    subscription.reconnectTimer = setTimeout(() => {
      subscription.reconnectTimer = null;
      this.connect(subscription);
    }, delay);
  }

  private async handleNotificationEvent(
    subscription: WalletSubscription,
    event: { kind: number; content: string; pubkey: string }
  ): Promise<void> {
    try {
      // Decrypt the notification content
      let decrypted: string;

      try {
        if (event.kind === 23197) {
          // NIP-44 encryption
          const conversationKey = nip44.utils.getConversationKey(
            subscription.secretBytes,
            subscription.walletPubkey
          );
          decrypted = nip44.decrypt(event.content, conversationKey);
        } else {
          // NIP-04 encryption (kind 23196)
          const secretHex = Array.from(subscription.secretBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          decrypted = await nip04.decrypt(secretHex, subscription.walletPubkey, event.content);
        }
      } catch (decryptError) {
        // Try the opposite encryption method as fallback
        // Some wallets may use NIP-04 even with kind 23197
        try {
          if (event.kind === 23197) {
            // Try NIP-04 as fallback
            const secretHex = Array.from(subscription.secretBytes)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            decrypted = await nip04.decrypt(secretHex, subscription.walletPubkey, event.content);
          } else {
            // Try NIP-44 as fallback
            const conversationKey = nip44.utils.getConversationKey(
              subscription.secretBytes,
              subscription.walletPubkey
            );
            decrypted = nip44.decrypt(event.content, conversationKey);
          }
        } catch {
          throw decryptError; // Re-throw original error if fallback also fails
        }
      }

      const parsed = JSON.parse(decrypted);

      // Validate notification type - handle different wallet implementations
      // Some wallets use notification_type, others might use type directly
      const notificationType = parsed.notification_type || parsed.type;
      const notification = parsed.notification || parsed;

      // Accept various naming conventions for payment notifications
      const isPaymentReceived = notificationType === 'payment_received' ||
        notificationType === 'incoming' ||
        notification.type === 'incoming';
      const isPaymentSent = notificationType === 'payment_sent' ||
        notificationType === 'outgoing' ||
        notification.type === 'outgoing';

      if (!isPaymentReceived && !isPaymentSent) {
        console.log(`[NWC Notifications] ${subscription.alias}: Ignoring notification type:`, notificationType);
        return;
      }

      // Ensure we have required fields
      if (!notification.payment_hash) {
        console.warn(`[NWC Notifications] ${subscription.alias}: Missing payment_hash in notification`);
        return;
      }

      // Normalize the notification object
      const normalizedNotification: NWCNotification = {
        type: isPaymentReceived ? 'incoming' : 'outgoing',
        payment_hash: notification.payment_hash,
        amount: notification.amount || 0,
        created_at: notification.created_at || Math.floor(Date.now() / 1000),
        settled_at: notification.settled_at,
        description: notification.description,
        preimage: notification.preimage,
        state: notification.state,
        metadata: notification.metadata,
      };

      console.log(`[NWC Notifications] ${subscription.alias}: ${normalizedNotification.type}`, {
        amount: normalizedNotification.amount,
        payment_hash: normalizedNotification.payment_hash?.slice(0, 16) + '...',
      });

      // Call the callback with the notification
      this.onNotification(
        normalizedNotification,
        subscription.alias,
        subscription.connectionString
      );
    } catch (error) {
      // Decryption or parsing failed - could be an old/invalid event
      console.warn(`[NWC Notifications] Failed to process notification from ${subscription.alias}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
