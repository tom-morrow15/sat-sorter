import { useEffect, useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createEncryptedSerializer } from '@/lib/secureStorage';
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

// Default to Sat Sorter's hosted Maple Proxy (Railway).
// This handles the TEE handshake + CORS so users don't need to run anything locally.
// Each user supplies their own Maple API key, which is passed per-request.
export const DEFAULT_PROXY_URL = 'https://maple-proxy-production-c67d.up.railway.app/v1';

// Legacy local proxy URLs that should be auto-migrated to the hosted proxy.
const LEGACY_PROXY_URLS = [
  'http://localhost:8080/v1',
  'http://127.0.0.1:8080/v1',
];

// Legacy hardcoded secret — only used for one-time migration of old encrypted keys.
const LEGACY_ENCRYPTION_SECRET = 'sat-sorter-maple-local-encryption';

/**
 * One-time migration: decrypt API keys stored with the old hardcoded-secret
 * encryption (ncryptsec1: prefix) so they can be re-encrypted by the new
 * device-key-based serializer.
 */
async function decryptLegacyApiKey(encrypted: string): Promise<string> {
  if (!encrypted.startsWith('ncryptsec1:')) return encrypted;
  try {
    const payload = encrypted.slice('ncryptsec1:'.length);
    const [saltB64, ivB64, ctB64] = payload.split(':');
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(LEGACY_ENCRYPTION_SECRET),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  }
}

export function useMapleSettings() {
  // API key is encrypted at rest via the device key (see lib/secureStorage.ts).
  // The serializer transparently encrypts/decrypts — rawApiKey is always plaintext.
  const keySerializer = useMemo(() => createEncryptedSerializer<string>(), []);
  const [rawApiKey, setRawApiKey] = useLocalStorage<string>(
    MAPLE_KEY_STORAGE,
    '',
    keySerializer,
  );
  const [enabled, setEnabled] = useLocalStorage<boolean>(MAPLE_ENABLED_STORAGE, false);
  const [evergreenContext, setEvergreenContext] = useLocalStorage<string>(
    MAPLE_CONTEXT_STORAGE,
    '',
  );
  const [storedProxyUrl, setProxyUrl] = useLocalStorage<string>(
    MAPLE_PROXY_URL_STORAGE,
    DEFAULT_PROXY_URL,
  );
  const [model, setModel] = useLocalStorage<string>(
    MAPLE_MODEL_STORAGE,
    DEFAULT_MAPLE_MODEL,
  );
  const [modelMigrated, setModelMigrated] = useLocalStorage<boolean>(
    MAPLE_MODEL_MIGRATED_STORAGE,
    false,
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

  // One-time migration: decrypt API keys stored with the old hardcoded-secret
  // encryption format (ncryptsec1: prefix) and re-store with the new device-key
  // encryption. After migration, rawApiKey is always plaintext.
  const [migrated, setMigrated] = useState(false);
  useEffect(() => {
    if (migrated) return;
    setMigrated(true);
    if (!rawApiKey || !rawApiKey.startsWith('ncryptsec1:')) return;
    decryptLegacyApiKey(rawApiKey).then((plaintext) => {
      if (plaintext && plaintext !== rawApiKey) {
        setRawApiKey(plaintext);
      }
    });
  }, [migrated, rawApiKey, setRawApiKey]);

  // Fetch models from Maple when both API key and proxy URL are available.
  useEffect(() => {
    if (!rawApiKey || !proxyUrl) {
      setAvailableModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    fetchMapleModels(rawApiKey, proxyUrl).then((models) => {
      if (!cancelled) {
        setAvailableModels(models);
        setModelsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setModelsLoading(false);
    });
    return () => { cancelled = true; };
  }, [rawApiKey, proxyUrl]);

  const hasKey = rawApiKey.length > 0;

  return {
    apiKey: rawApiKey,
    setApiKey: setRawApiKey,
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
