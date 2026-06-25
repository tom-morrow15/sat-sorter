import { openDB, type IDBPDatabase } from 'idb';
import { encryptSecretKey, decryptSecretKey } from '@/utils/nostrAuth';

const DB_NAME = 'satSorter';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const NCSECRET_KEY = 'ncryptsec';
const SESSION_PASSWORD_KEY = 'session_password';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Store the encrypted ncryptsec string and the session password in IndexedDB.
 * The ncryptsec is encrypted with the password, so the password is also needed
 * to decrypt it later during the same browser session.
 */
export async function saveSession(ncryptsec: string, password: string): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, ncryptsec, NCSECRET_KEY);
  await db.put(STORE_NAME, password, SESSION_PASSWORD_KEY);
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
    const password = await db.get(STORE_NAME, SESSION_PASSWORD_KEY);
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
  await db.delete(STORE_NAME, SESSION_PASSWORD_KEY);
}
