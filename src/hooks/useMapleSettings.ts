import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_MAPLE_MODEL } from '@/services/mapleAi';

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

export function useMapleSettings() {
  const [apiKey, setApiKey] = useLocalStorage<string>(MAPLE_KEY_STORAGE, '');
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

  const hasKey = apiKey.length > 0;

  return {
    apiKey,
    setApiKey,
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
  };
}
