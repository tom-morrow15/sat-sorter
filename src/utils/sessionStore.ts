import { openDB, type IDBPDatabase } from 'idb';
import { encryptSecretKey, decryptSecretKey } from '@/utils/nostrAuth';

const DB_NAME = 'satSorter';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';
const NCSECRET_KEY = 'ncryptsec';
const PASSWORD_KEY = 'session_password';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create ALL stores this app needs — both sessions and secure.
        // Must match secureStorage.ts upgrade function.
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains('secure')) {
          db.createObjectStore('secure');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Store the encrypted ncryptsec string and the session password in IndexedDB.
 *
 * SECURITY NOTE: The password is stored alongside the ncryptsec so that the app
 * can auto-restore the session on page reload without prompting the user each
 * time. This is a deliberate trade-off: it means anyone with direct access to
 * IndexedDB can recover the private key. However:
 *  - The ncryptsec is NIP-49 encrypted, so raw DB access still requires the
 *    password to decrypt.
 *  - The password is never exposed in localStorage (which is more trivially
 *    scraped by extensions).
 *  - Auto-login is a core UX requirement for this app.
 *
 * For users who need stronger security, NIP-07 browser extensions (nos2x, etc.)
 * store keys in a separate security context and never expose the raw secret
 * to the page. Users are encouraged to use an extension for high-value keys.
 */
export async function saveSession(ncryptsec: string, password: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, ncryptsec, NCSECRET_KEY);
  await db.put(STORE_NAME, password, PASSWORD_KEY);
}

/**
 * Load the encrypted ncryptsec string from IndexedDB.
 * Returns null if no session exists.
 */
export async function loadNcryptsec(): Promise<string | null> {
  try {
    const db = await getDb();
    const ncryptsec = await db.get(STORE_NAME, NCSECRET_KEY);
    return ncryptsec ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the session password from IndexedDB.
 * Returns null if no password is stored.
 */
export async function loadSessionPassword(): Promise<string | null> {
  try {
    const db = await getDb();
    const password = await db.get(STORE_NAME, PASSWORD_KEY);
    return password ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the decrypted secret key if a session exists.
 * Returns null if no session exists or decryption fails.
 */
export async function getSecretKey(): Promise<Uint8Array | null> {
  const ncryptsec = await loadNcryptsec();
  if (!ncryptsec) return null;

  const password = await loadSessionPassword();
  if (!password) return null;

  try {
    return decryptSecretKey(ncryptsec, password);
  } catch {
    console.warn('[sessionStore] Failed to decrypt stored secret key');
    return null;
  }
}

/**
 * Check if a stored session exists (i.e., user has previously authenticated).
 */
export async function hasSession(): Promise<boolean> {
  const ncryptsec = await loadNcryptsec();
  return ncryptsec !== null;
}

/**
 * Clear the stored session data (logout).
 */
export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, NCSECRET_KEY);
  await db.delete(STORE_NAME, PASSWORD_KEY);
}
