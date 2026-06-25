import { generateMnemonic as bip39GenerateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import { nip19 } from 'nostr-tools';
import { scrypt } from '@noble/hashes/scrypt';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { concatBytes, randomBytes } from '@noble/hashes/utils';
import { bech32 } from '@scure/base';

// Initialize BIP32 with the secp256k1 elliptic curve
const bip32 = BIP32Factory(ecc);

// NIP-06 derivation path for Nostr keys
const NOSTR_DERIVATION_PATH = "m/44'/1237'/0'/0/0";

export interface KeyPair {
  secretKey: Uint8Array;
  nsec: string;
  npub: string;
}

export interface ParsedKeyPair extends KeyPair {
  source: 'mnemonic' | 'nsec' | 'hex';
}

/**
 * Generate a 12-word BIP39 mnemonic seed phrase.
 */
export function generateMnemonic(): string {
  return bip39GenerateMnemonic(128);
}

/**
 * Derive Nostr keys from a BIP39 mnemonic and optional passphrase.
 * Uses the NIP-06 derivation path m/44'/1237'/0'/0/0.
 */
export function keysFromMnemonic(mnemonic: string, passphrase?: string): KeyPair {
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic, passphrase);

  // Create BIP32 root key from seed
  const root = bip32.fromSeed(seed);

  // Derive the NIP-06 path
  const child = root.derivePath(NOSTR_DERIVATION_PATH);

  // Extract the 32-byte private key
  const secretKey = new Uint8Array(child.privateKey!);

  // Derive the public key using secp256k1 (tiny-secp256k1 API via @bitcoinerlab/secp256k1)
  const publicKey = ecc.pointFromScalar(Buffer.from(secretKey), true);
  if (!publicKey) {
    throw new Error('Failed to derive public key from private key');
  }

  // Convert public key to hex (remove the 02/03 prefix byte for nostr hex format)
  const pubkeyHex = Buffer.from(publicKey.subarray(1)).toString('hex');

  // Encode as bech32 Nostr identifiers
  const nsec = nip19.nsecEncode(secretKey);
  const npub = nip19.npubEncode(pubkeyHex);

  return { secretKey, nsec, npub };
}

/**
 * Parse key input in various formats:
 * - nsec1... (bech32 encoded private key)
 * - 64 hex characters (raw hex private key)
 * - 12+ words (BIP39 mnemonic)
 *
 * Returns a KeyPair plus a 'source' field indicating the format.
 */
export function parseKeyInput(input: string): ParsedKeyPair {
  const trimmed = input.trim();

  // Detect nsec format
  if (trimmed.startsWith('nsec1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nsec') {
        const secretKey = decoded.data as Uint8Array;
        const publicKey = ecc.pointFromScalar(Buffer.from(secretKey), true);
        if (!publicKey) {
          throw new Error('Failed to derive public key from private key');
        }
        const pubkeyHex = Buffer.from(publicKey.subarray(1)).toString('hex');
        const npub = nip19.npubEncode(pubkeyHex);

        return {
          secretKey,
          nsec: trimmed,
          npub,
          source: 'nsec',
        };
      }
    } catch {
      throw new Error('Invalid nsec format');
    }
  }

  // Detect hex private key (64 characters)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const secretKey = new Uint8Array(Buffer.from(trimmed, 'hex'));
    const publicKey = ecc.pointFromScalar(Buffer.from(secretKey), true);
    if (!publicKey) {
      throw new Error('Failed to derive public key from private key');
    }
    const pubkeyHex = Buffer.from(publicKey.subarray(1)).toString('hex');
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(pubkeyHex);

    return {
      secretKey,
      nsec,
      npub,
      source: 'hex',
    };
  }

  // Detect mnemonic (12+ words separated by spaces)
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 12) {
    const mnemonic = words.join(' ');
    if (validateMnemonic(mnemonic)) {
      const keys = keysFromMnemonic(mnemonic);
      return {
        ...keys,
        source: 'mnemonic',
      };
    }
  }

  throw new Error(
    'Could not parse input. Please provide a valid 12-word seed phrase, nsec (starting with nsec1), or 64-character hex private key.'
  );
}

/**
 * Encode binary data as a bech32 ncryptsec string (NIP-49).
 * Uses bech32 encoding with the 'n' prefix convention from NIP-19.
 */
function encodeNcryptsecBytes(data: Uint8Array): string {
  const words = bech32.toWords(data);
  return bech32.encode('ncryptsec', words, 5000);
}

/**
 * Decode a bech32 ncryptsec string back to bytes.
 */
function decodeNcryptsecBytes(ncryptsec: string): Uint8Array {
  const { prefix, words } = bech32.decode(ncryptsec as `${string}1${string}`, 5000);
  if (prefix !== 'ncryptsec') {
    throw new Error(`Invalid prefix '${prefix}', expected 'ncryptsec'`);
  }
  return new Uint8Array(bech32.fromWords(words));
}

/**
 * Encrypt a secret key using NIP-49 (ncryptsec format).
 * Returns the ncryptsec string suitable for storage.
 */
export function encryptSecretKey(secretKey: Uint8Array, password: string, logn: number = 16): string {
  const normalizedPassword = password.normalize('NFKC');
  const salt = randomBytes(16);
  const n = 2 ** logn;
  const key = scrypt(normalizedPassword, salt, { N: n, r: 8, p: 1, dkLen: 32 });
  const nonce = randomBytes(24);
  const ksb = 0x02; // client does not track key security
  const aad = new Uint8Array([ksb]);
  const cipher = xchacha20poly1305(key, nonce, aad);
  const ciphertext = cipher.encrypt(secretKey);

  const payload = concatBytes(
    new Uint8Array([0x02]),        // version
    new Uint8Array([logn]),        // log_n
    salt,                          // 16 bytes
    nonce,                         // 24 bytes
    aad,                           // 1 byte
    ciphertext                     // 32 bytes + 16 byte tag = 48 bytes
  );

  return encodeNcryptsecBytes(payload);
}

/**
 * Decrypt an ncryptsec string using NIP-49.
 * Returns the decrypted secret key as a Uint8Array.
 */
export function decryptSecretKey(ncryptsec: string, password: string): Uint8Array {
  const normalizedPassword = password.normalize('NFKC');
  const data = decodeNcryptsecBytes(ncryptsec);

  const version = data[0];
  if (version !== 0x02) {
    throw new Error(`Unsupported ncryptsec version: ${version}`);
  }

  const storedLogn = data[1];
  const n = 2 ** storedLogn;

  const salt = data.slice(2, 18);
  const nonce = data.slice(18, 42);
  const ksb = data[42];
  const aad = new Uint8Array([ksb]);
  const ciphertext = data.slice(43);

  const key = scrypt(normalizedPassword, salt, { N: n, r: 8, p: 1, dkLen: 32 });
  const cipher = xchacha20poly1305(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}
