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
 * Signer interface subset we need: nip44 encrypt/decrypt.
 * Compatible with both NIP-07 browser extensions and NSecSigner.
 */
interface Nip44Signer {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

/**
 * Encrypt the budget nsec for a specific partner using the owner's signer.
 * The signer derives the conversation key internally.
 */
export async function encryptBudgetKeyForPartner(
  budgetNsec: string,
  ownerSigner: Nip44Signer,
  partnerPub: string
): Promise<string> {
  return ownerSigner.encrypt(partnerPub, budgetNsec);
}

/**
 * Decrypt the budget nsec received via an invite using the invitee's signer.
 */
export async function decryptBudgetKeyFromInvite(
  encryptedContent: string,
  mySigner: Nip44Signer,
  senderPub: string
): Promise<string> {
  return mySigner.decrypt(senderPub, encryptedContent);
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
