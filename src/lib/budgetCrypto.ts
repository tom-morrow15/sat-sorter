/**
 * budgetCrypto.ts — Cryptographic utilities for shared budget keypairs.
 *
 * Every shared Sat Sorter budget gets its own Nostr identity (nsec/npub).
 * All budget data is signed and encrypted by the budget keypair, not by
 * individual user identities. Both partners hold the budget nsec.
 *
 * The invite simply shares the budget nsec (encrypted per-partner), never
 * a full budget snapshot.
 *
 * Signer-based vs raw-key functions:
 *  - encryptBudgetKeyForPartner / decryptBudgetKeyFromInvite use the
 *    CURRENT USER'S signer (NIP-07 / NSecSigner) so we never need direct
 *    access to the user's raw private key.
 *  - encryptWithBudgetKey / decryptWithBudgetKey use the budget keypair's
 *    raw bytes (which WE generated, so we have full access).
 */

import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nip19, nip44 } from 'nostr-tools';

/**
 * Ensure a Nostr public key is in raw hex format (64 hex chars).
 * Converts npub1... bech32 to hex if necessary.
 * If already hex (or starts with "02"/"03"), returns as-is.
 * Defensively handles non-string values (e.g. legacy objects in old invite data)
 * and falls back to extracting .pubkey when possible.
 */
export function ensureHexPubkey(pub: unknown): string {
  if (!pub) {
    return '';
  }

  // If it's already the decoded nprofile-like object {pubkey: '...', relays?}
  if (typeof pub === 'object') {
    const p = pub as any;
    if (typeof p.pubkey === 'string') {
      pub = p.pubkey;
    } else if (typeof p.data === 'string') {
      pub = p.data;
    } else {
      console.warn('[budgetCrypto] ensureHexPubkey received non-string object without pubkey/data:', pub);
      return '';
    }
  }

  let s = String(pub).trim();

  if (s.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(s);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        s = decoded.data;
      } else if (decoded.type === 'nprofile' && decoded.data && typeof (decoded.data as any).pubkey === 'string') {
        s = (decoded.data as any).pubkey;
      } else {
        console.warn('[budgetCrypto] Unexpected nip19 type for pubkey field:', decoded.type);
      }
    } catch (e) {
      console.warn('[budgetCrypto] Failed to decode npub/nprofile pubkey, using as-is:', s, e);
      // fall through with the bech32; caller may fail later with clearer error
    }
  }

  // If it looks like hex already (64 chars) or starts with 02/03 (compressed), accept
  if (/^[0-9a-f]{64}$/i.test(s) || s.startsWith('02') || s.startsWith('03')) {
    return s.toLowerCase();
  }

  // If we got here with something that is not 64-hex, log and return original (will likely cause explicit error downstream)
  if (s.length !== 64 || !/^[0-9a-f]+$/i.test(s)) {
    console.warn('[budgetCrypto] ensureHexPubkey did not resolve to 64-hex pubkey, returning as-is:', s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export interface BudgetKeypair {
  budgetNsec: string;
  budgetNpub: string;
  /** Raw 32-byte secret key */
  budgetPrivateKey: Uint8Array;
  /** Raw 32-byte hex public key */
  budgetPublicKey: string;
}

/** Generate a fresh Nostr keypair for a shared budget. */
export function generateBudgetKeypair(): BudgetKeypair {
  const secretKey = generateSecretKey();
  const publicKey = getPublicKey(secretKey);
  return {
    budgetNsec: nip19.nsecEncode(secretKey),
    budgetNpub: nip19.npubEncode(publicKey),
    budgetPrivateKey: secretKey,
    budgetPublicKey: publicKey,
  };
}

// ---------------------------------------------------------------------------
// Signer-based per-partner encryption (no raw user private key needed)
// ---------------------------------------------------------------------------

/**
 * Signer interface subset we need: encrypt/decrypt (NIP-44 or NIP-04).
 * Compatible with both NIP-07 browser extensions and NSecSigner.
 */
interface SignerEncrypt {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
}

/**
 * Encrypt the budget nsec for a specific partner using the owner's signer.
 * Uses NIP-44 encrypt (the signer handles the conversation key internally).
 * The accept handler tries NIP-44 decryption first, then NIP-04 as fallback.
 */
export async function encryptBudgetKeyForPartner(
  budgetNsec: string,
  ownerSigner: SignerEncrypt,
  partnerPub: string
): Promise<string> {
  const partnerHex = ensureHexPubkey(partnerPub);
  return ownerSigner.encrypt(partnerHex, budgetNsec);
}

/**
 * Decrypt the budget nsec received via an invite.
 * Uses the invitee's raw private key bytes + the sender's pubkey.
 */
export async function decryptBudgetKeyFromInvite(
  encryptedContent: string,
  myPriv: Uint8Array,
  senderPub: string
): Promise<string> {
  const senderHex = ensureHexPubkey(senderPub);
  const conversationKey = nip44.getConversationKey(myPriv, senderHex);
  return nip44.decrypt(encryptedContent, conversationKey);
}

// ---------------------------------------------------------------------------
// Budget-keypair self-encryption (raw keys — we generated them ourselves)
// ---------------------------------------------------------------------------

/** Encrypt data with the budget keypair (conversation key budgetPriv ↔ budgetPub). */
export function encryptWithBudgetKey(
  data: string,
  budgetPriv: Uint8Array,
  budgetPub: string
): string {
  const conversationKey = nip44.getConversationKey(budgetPriv, budgetPub);
  return nip44.encrypt(data, conversationKey);
}

/** Decrypt data that was encrypted with the budget keypair. */
export function decryptWithBudgetKey(
  encrypted: string,
  budgetPriv: Uint8Array,
  budgetPub: string
): string {
  const conversationKey = nip44.getConversationKey(budgetPriv, budgetPub);
  return nip44.decrypt(encrypted, conversationKey);
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------

/** A budget entry stored as an encrypted NIP-78 event. */
export interface BudgetEntry {
  /** The d-tag identifier (e.g. "sat-sorter/budget-data/2026-06"). */
  dTag: string;
  /** NIP-44 encrypted content (JSON payload). */
  encryptedContent: string;
  /** The original event id (for deduplication). */
  eventId?: string;
  /** Unix timestamp of the event. */
  createdAt?: number;
}

/**
 * Re-encrypt a batch of budget entries from the user's personal key to the
 * shared budget keypair. Used when upgrading an existing personal budget to
 * a shared budget (first-partner join).
 */
export function reEncryptAllEntriesForBudget(
  allEntries: BudgetEntry[],
  userPrivateKey: Uint8Array,
  userPublicKey: string,
  budgetPrivateKey: Uint8Array,
  budgetPublicKey: string
): BudgetEntry[] {
  const userConversationKey = nip44.getConversationKey(userPrivateKey, userPublicKey);
  const budgetConversationKey = nip44.getConversationKey(budgetPrivateKey, budgetPublicKey);

  return allEntries.map((entry) => {
    const plaintext = nip44.decrypt(entry.encryptedContent, userConversationKey);
    return {
      ...entry,
      encryptedContent: nip44.encrypt(plaintext, budgetConversationKey),
    };
  });
}
