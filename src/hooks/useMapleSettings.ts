import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  DEFAULT_MAPLE_MODEL,
  fetchMapleModels,
  type MapleModelOption,
} from '@/services/mapleAi';

export interface MapleSettings {
  apiKey: string;
  enabled: boolean;
  evergreenContext: string;
  proxyUrl: string;
  model: string;
}

export const MAPLE_KEY_STORAGE = 'sat-sorter:maple-api-key';
export const MAPLE_ENABLED_STORAGE = 'sat-sorter:maple-enabled';
export const MAPLE_CONTEXT_STORAGE = 'sat-sorter:maple-evergreen-context';
export const MAPLE_PROXY_URL_STORAGE = 'sat-sorter:maple-proxy-url';
export const MAPLE_MODEL_STORAGE = 'sat-sorter:maple-model';
// One-time flag: migrate users off the old, broken "Auto (Quick)" default.
export const MAPLE_MODEL_MIGRATED_STORAGE = 'sat-sorter:maple-model-migrated-v2';
// Flag: whether the API key has been encrypted at rest (migration from plaintext)
const MAPLE_KEY_ENCRYPTED_STORAGE = 'sat-sorter:maple-key-encrypted-v1';

// Default to Sat Sorter's hosted Maple Proxy (Railway).
// This handles the TEE handshake + CORS so users don't need to run anything locally.
// Each user supplies their own Maple API key, which is passed per-request.
export const DEFAULT_PROXY_URL = 'https://maple-proxy-production-c67d.up.railway.app/v1';

// Legacy local proxy URLs that should be auto-migrated to the hosted proxy.
const LEGACY_PROXY_URLS = [
  'http://localhost:8080/v1',
  'http://127.0.0.1:8080/v1',
];

/**
 * Deterministic encryption for the API key at rest.
 *
 * Uses Web Crypto API (SubtleCrypto) with AES-GCM and a hardcoded app secret.
 * This prevents casual inspection of localStorage but is NOT a true secret —
 * anyone with source-code access can derive the key. The real security
 * boundary is that the key never leaves the browser.
 */
const ENCRYPTION_SECRET = 'sat-sorter-maple-local-encryption';

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(ENCRYPTION_SECRET, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  // Format: base64(salt) + ':' + base64(iv) + ':' + base64(ciphertext)
  const parts = [
    btoa(String.fromCharCode(...salt)),
    btoa(String.fromCharCode(...iv)),
    btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  ];
  return `ncryptsec1:${parts.join(':')}`;
}

async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return '';
  // Check if this is already plaintext (migration path)
  if (!encrypted.startsWith('ncryptsec1:')) {
    return encrypted;
  }
  try {
    const payload = encrypted.slice('ncryptsec1:'.length);
    const [saltB64, ivB64, ctB64] = payload.split(':');
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
    const key = await deriveKey(ENCRYPTION_SECRET, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    // If decryption fails (corrupted data, wrong format), return empty
    console.warn('[useMapleSettings] Failed to decrypt API key, clearing.');
    return '';
  }
}

export function useMapleSettings() {
  const [rawApiKey, setRawApiKey] = useLocalStorage<string>(MAPLE_KEY_STORAGE, '');
  const [keyEncrypted, setKeyEncrypted] = useLocalStorage<boolean>(MAPLE_KEY_ENCRYPTED_STORAGE, false);
  const [enabled, setEnabled] = useLocalStorage<boolean>(MAPLE_ENABLED_STORAGE, false);
  const [evergreenContext, setEvergreenContext] = useLocalStorage<string>(
    MAPLE_CONTEXT_STORAGE,
    ''
  );
  const [storedProxyUrl, setProxyUrl] = useLocalStorage<string>(
    MAPLE_PROXY_URL_STORAGE,
    DEFAULT_PROXY_URL
  );
  const [model, setModel] = useLocalStorage<string>(
    MAPLE_MODEL_STORAGE,
    DEFAULT_MAPLE_MODEL
  );
  const [modelMigrated, setModelMigrated] = useLocalStorage<boolean>(
    MAPLE_MODEL_MIGRATED_STORAGE,
    false
  );

  // Dynamically fetched models (not persisted — fetched on load)
  const [availableModels, setAvailableModels] = useState<MapleModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Auto-migrate anyone still pointing at a local proxy to the hosted one.
  const proxyUrl = LEGACY_PROXY_URLS.includes(storedProxyUrl.trim())
    ? DEFAULT_PROXY_URL
    : storedProxyUrl;

  // One-time migration: the old default "Auto (Quick)" frequently produced
  // garbled output (fused digits, dropped words). Move existing users off it
  // to the recommended model exactly once. After this they can freely choose
  // Quick again from the picker and it will stick.
  useEffect(() => {
    if (!modelMigrated) {
      if (model === 'auto:quick') {
        setModel(DEFAULT_MAPLE_MODEL);
      }
      setModelMigrated(true);
    }
  }, [modelMigrated, model, setModel, setModelMigrated]);

  // One-time migration: encrypt the API key at rest if it's still plaintext.
  useEffect(() => {
    if (keyEncrypted || !rawApiKey) return;
    const migrate = async () => {
      try {
        // Only encrypt if it's a plaintext key (not already encrypted)
        if (!rawApiKey.startsWith('ncryptsec1:')) {
          const encrypted = await encryptApiKey(rawApiKey);
          setRawApiKey(encrypted);
        }
        setKeyEncrypted(true);
      } catch {
        console.warn('[useMapleSettings] Failed to encrypt API key, leaving as-is.');
        setKeyEncrypted(true); // Don't retry
      }
    };
    migrate();
  }, [keyEncrypted, rawApiKey, setRawApiKey, setKeyEncrypted]);

  // Decrypt the API key for use. On first render the key may still be encrypted;
  // we derive the plaintext via a ref so callers always get the decrypted value.
  const [decryptedApiKey, setDecryptedApiKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    const decrypt = async () => {
      if (!rawApiKey) {
        setDecryptedApiKey('');
        return;
      }
      const plain = await decryptApiKey(rawApiKey);
      if (!cancelled) setDecryptedApiKey(plain);
    };
    decrypt();
    return () => { cancelled = true; };
  }, [rawApiKey]);

  // Fetch models from Maple when both API key and proxy URL are available.
  useEffect(() => {
    if (!decryptedApiKey || !proxyUrl) {
      setAvailableModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    fetchMapleModels(decryptedApiKey, proxyUrl).then((models) => {
      if (!cancelled) {
        setAvailableModels(models);
        setModelsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setModelsLoading(false);
    });
    return () => { cancelled = true; };
  }, [decryptedApiKey, proxyUrl]);

  // Wrapped setApiKey that encrypts before storing.
  const setApiKeyEncrypted = useCallback(
    (value: string | ((prev: string) => string)) => {
      if (typeof value === 'function') {
        // For functional updates, we encrypt the result.
        // We need the current plaintext to compute the new value.
        const newVal = value(decryptedApiKey);
        encryptApiKey(newVal).then((enc) => setRawApiKey(enc));
      } else {
        encryptApiKey(value).then((enc) => setRawApiKey(enc));
      }
    },
    [decryptedApiKey, setRawApiKey]
  );

  const hasKey = decryptedApiKey.length > 0;

  return {
    apiKey: decryptedApiKey,
    setApiKey: setApiKeyEncrypted,
    enabled,
    setEnabled,
    evergreenContext,
    setEvergreenContext,
    proxyUrl,
    setProxyUrl,
    model,
    setModel,
    hasKey,
    isMapleEnabled: hasKey && enabled,
    availableModels,
    modelsLoading,
  };
}
