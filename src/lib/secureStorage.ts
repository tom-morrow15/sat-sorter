/**
 * Secure storage: encrypts sensitive data at rest in localStorage using a
 * device-specific key stored in IndexedDB.
 *
 * The device key is generated once (random 32 bytes) and persisted to
 * IndexedDB. On subsequent loads it is fetched before the app renders
 * (see main.tsx → initSecureStorage()). Once loaded, all encrypt/decrypt
 * operations are synchronous via @noble/ciphers (XChaCha20-Poly1305).
 *
 * This is NOT as strong as a user-supplied password (anyone with full
 * browser access can extract the key from IndexedDB), but it prevents
 * casual scraping of sensitive data from localStorage — which is the
 * primary attack vector for browser extensions and shared computers.
 *
 * For maximum security, users should use a NIP-07 browser extension
 * which keeps private keys in a separate security context.
 */

import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'satSorter';
const DB_VERSION = 2;
const STORE_NAME = 'secure';
const KEY_NAME = 'device-key';

let dbPromise: Promise<IDBPDatabase> | null = null;
let deviceKey: Uint8Array | null = null;
let initPromise: Promise<void> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create ALL stores this app needs — both secure and sessions.
        // This ensures that whichever module opens the DB first, all
        // object stores are available. The upgrade only fires once
        // (when the version bumps from 1 to 2), so we must create
        // everything here.
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Load or create the device encryption key.
 * Must be called once before the app renders (see main.tsx).
 * Subsequent calls are no-ops (the key is cached in memory).
 */
export async function initSecureStorage(): Promise<void> {
  if (deviceKey) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await getDb();
      const stored = await db.get(STORE_NAME, KEY_NAME);
      if (stored) {
        deviceKey = new Uint8Array(stored);
      } else {
        const key = randomBytes(32);
        await db.put(STORE_NAME, key, KEY_NAME);
        deviceKey = key;
      }
    } catch {
      // If IndexedDB is unavailable (private browsing, etc.), generate an
      // ephemeral key. Data won't persist across sessions but will be
      // encrypted within the current session.
      deviceKey = randomBytes(32);
    }
  })();

  return initPromise;
}

/** Returns true if the device key has been loaded and encryption is active. */
export function isSecureStorageReady(): boolean {
  return deviceKey !== null;
}

const PREFIX = 'enc:v1:';

/**
 * Encrypt a string value using XChaCha20-Poly1305.
 * Returns a string prefixed with 'enc:v1:' followed by base64(nonce + ciphertext).
 * If the device key is not loaded, returns the plaintext unchanged (no-op).
 */
export function encryptValue(plaintext: string): string {
  if (!deviceKey || !plaintext) return plaintext;
  try {
    const nonce = randomBytes(24);
    const cipher = xchacha20poly1305(deviceKey, nonce);
    const ciphertext = cipher.encrypt(new TextEncoder().encode(plaintext));
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);
    return PREFIX + btoa(String.fromCharCode(...combined));
  } catch {
    return plaintext;
  }
}

/**
 * Decrypt a value encrypted by encryptValue().
 * If the input is not encrypted (no 'enc:v1:' prefix), returns it unchanged
 * (transparent migration from plaintext).
 * If the device key is not loaded or decryption fails, returns the input unchanged.
 */
export function decryptValue(encrypted: string): string {
  if (!deviceKey || !encrypted || !encrypted.startsWith(PREFIX)) return encrypted;
  try {
    const data = atob(encrypted.slice(PREFIX.length));
    const combined = Uint8Array.from(data, (c) => c.charCodeAt(0));
    const nonce = combined.slice(0, 24);
    const ciphertext = combined.slice(24);
    const cipher = xchacha20poly1305(deviceKey, nonce);
    const plaintext = cipher.decrypt(ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return encrypted;
  }
}

/**
 * Create a serializer/deserializer pair for use with useLocalStorage.
 * Transparently encrypts values before they hit localStorage and
 * decrypts them on read.
 */
export function createEncryptedSerializer<T>() {
  return {
    serialize: (value: T) => encryptValue(JSON.stringify(value)),
    deserialize: (str: string) => JSON.parse(decryptValue(str)) as T,
  };
}
