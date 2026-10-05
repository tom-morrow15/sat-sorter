import { useEffect, useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createEncryptedSerializer } from '@/lib/secureStorage';
import {
  DEFAULT_MAPLE_MODEL,
  fetchMapleModels,
  type MapleModelOption,
} from '@/services/mapleAi';

/**
 * AI Provider abstraction.
 *
 * Both Maple and PPQ use OpenAI-compatible APIs, so the only differences are:
 * - Base URL (proxy URL)
 * - API key
 * - Available models
 * - PPQ supports a `provider.zdr` flag for zero-data-retention
 *
 * The user picks a provider in Settings, enters their API key, and the
 * model list is fetched dynamically from that provider's /v1/models endpoint.
 * The selection persists across all chats until changed.
 */

export type AIProvider = 'maple' | 'ppq' | string;

export interface AiConnection {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  evergreenContext: string;
  proxyUrl: string;
  model: string;
  // PPQ-specific: request zero-data-retention routing
  zdr: boolean;
}

// Provider defaults
export const PROVIDER_DEFAULTS: Record<'maple' | 'ppq', { proxyUrl: string; label: string; description: string }> = {
  maple: {
    proxyUrl: 'https://maple-proxy-production-c67d.up.railway.app/v1',
    label: 'Maple',
    description: 'Encrypted AI models via Maple proxy. Privacy-focused with TEE support.',
  },
  ppq: {
    proxyUrl: 'https://api.ppq.ai/v1',
    label: 'PPQ (PayPerQ)',
    description: 'Pay-per-query access to hundreds of models. Anonymous, crypto-friendly.',
  },
};

// Model defaults per provider (used before dynamic fetch completes)
export const PROVIDER_MODEL_DEFAULTS: Record<'maple' | 'ppq', string> = {
  maple: DEFAULT_MAPLE_MODEL,
  ppq: 'gpt-4o-mini',
};

// Storage keys — separate per setting, all encrypted at rest
const PROVIDER_KEY = 'sat-sorter:ai-provider';
const MAPLE_KEY_STORAGE = 'sat-sorter:maple-api-key';
const MAPLE_ENABLED_STORAGE = 'sat-sorter:maple-enabled';
const MAPLE_CONTEXT_STORAGE = 'sat-sorter:maple-evergreen-context';
const MAPLE_PROXY_URL_STORAGE = 'sat-sorter:maple-proxy-url';
const MAPLE_MODEL_STORAGE = 'sat-sorter:maple-model';
const PPQ_KEY_STORAGE = 'sat-sorter:ppq-api-key';
const PPQ_CONTEXT_STORAGE = 'sat-sorter:ppq-evergreen-context';
const PPQ_PROXY_URL_STORAGE = 'sat-sorter:ppq-proxy-url';
const PPQ_MODEL_STORAGE = 'sat-sorter:ppq-model';
const PPQ_ZDR_STORAGE = 'sat-sorter:ppq-zdr';
const DISCLAIMER_ACCEPTED_KEY = 'sat-sorter:ai-disclaimer-accepted';
const MAPLE_MODEL_MIGRATED_STORAGE = 'sat-sorter:maple-model-migrated-v2';
const CONNECTIONS_KEY = 'sat-sorter:ai-connections';

// Legacy hardcoded secret — only used for one-time migration of old encrypted keys
const LEGACY_ENCRYPTION_SECRET = 'sat-sorter-maple-local-encryption';

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
      'raw', enc.encode(LEGACY_ENCRYPTION_SECRET), 'PBKDF2', false, ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    return '';
  }
}

export function useAISettings() {
  const keySerializer = useMemo(() => createEncryptedSerializer<string>(), []);
  const connectionsSerializer = useMemo(() => createEncryptedSerializer<AiConnection[]>(), []);

  // Which connection is active. Built-ins are "maple" and "ppq".
  const [provider, setProvider] = useLocalStorage<string>(PROVIDER_KEY, 'maple');
  const [connections, setConnections] = useLocalStorage<AiConnection[]>(CONNECTIONS_KEY, [], connectionsSerializer);

  // Maple settings (existing keys for backward compat)
  const [mapleApiKey, setMapleApiKey] = useLocalStorage<string>(MAPLE_KEY_STORAGE, '', keySerializer);
  const [mapleEnabled, setMapleEnabled] = useLocalStorage<boolean>(MAPLE_ENABLED_STORAGE, false);
  const [mapleProxyUrl, setMapleProxyUrl] = useLocalStorage<string>(MAPLE_PROXY_URL_STORAGE, PROVIDER_DEFAULTS.maple.proxyUrl);
  const [mapleModel, setMapleModel] = useLocalStorage<string>(MAPLE_MODEL_STORAGE, DEFAULT_MAPLE_MODEL);

  // PPQ settings (new keys)
  const [ppqApiKey, setPpqApiKey] = useLocalStorage<string>(PPQ_KEY_STORAGE, '', keySerializer);
  const [ppqProxyUrl, setPpqProxyUrl] = useLocalStorage<string>(PPQ_PROXY_URL_STORAGE, PROVIDER_DEFAULTS.ppq.proxyUrl);
  const [ppqModel, setPpqModel] = useLocalStorage<string>(PPQ_MODEL_STORAGE, PROVIDER_MODEL_DEFAULTS.ppq);
  const [ppqZdr, setPpqZdr] = useLocalStorage<boolean>(PPQ_ZDR_STORAGE, true);

  // Disclaimer — must be accepted before Budget Buddy works
  const [disclaimerAccepted, setDisclaimerAccepted] = useLocalStorage<boolean>(DISCLAIMER_ACCEPTED_KEY, false);

  // Evergreen context is shared across providers (it's the user's financial goals)
  const [evergreenContext, setEvergreenContext] = useLocalStorage<string>(MAPLE_CONTEXT_STORAGE, '');

  // Legacy model migration
  const [modelMigrated, setModelMigrated] = useLocalStorage<boolean>(MAPLE_MODEL_MIGRATED_STORAGE, false);
  useEffect(() => {
    if (!modelMigrated) {
      if (mapleModel === 'auto:quick') setMapleModel(DEFAULT_MAPLE_MODEL);
      setModelMigrated(true);
    }
  }, [modelMigrated, mapleModel, setMapleModel, setModelMigrated]);

  // Legacy API key migration (ncryptsec1: → device-key encryption)
  const [migrated, setMigrated] = useState(false);
  useEffect(() => {
    if (migrated) return;
    setMigrated(true);
    if (!mapleApiKey || !mapleApiKey.startsWith('ncryptsec1:')) return;
    decryptLegacyApiKey(mapleApiKey).then((plaintext) => {
      if (plaintext && plaintext !== mapleApiKey) setMapleApiKey(plaintext);
    });
  }, [migrated, mapleApiKey, setMapleApiKey]);

  // Active settings based on selected provider
  const custom = connections.find((connection) => connection.id === provider);
  const isCustom = Boolean(custom);
  const apiKey = custom ? custom.apiKey : provider === 'ppq' ? ppqApiKey : mapleApiKey;
  const proxyUrl = custom ? custom.baseUrl : provider === 'ppq' ? ppqProxyUrl : mapleProxyUrl;
  const model = custom ? custom.model : provider === 'ppq' ? ppqModel : mapleModel;

  const updateConnection = (id: string, patch: Partial<AiConnection>) => {
    setConnections((prev) => prev.map((connection) => connection.id === id ? { ...connection, ...patch } : connection));
  };

  const addConnection = (draft: { name: string; baseUrl: string; apiKey: string; model: string }) => {
    const id = `c_${Date.now().toString(36)}`;
    const next: AiConnection = {
      id,
      name: draft.name.trim() || 'Custom',
      baseUrl: draft.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
    };
    setConnections((prev) => [...prev, next]);
    setProvider(id);
    return id;
  };

  const removeConnection = (id: string) => {
    setConnections((prev) => prev.filter((connection) => connection.id !== id));
    if (provider === id) setProvider('maple');
  };

  // Dynamically fetch models from the active provider
  const [availableModels, setAvailableModels] = useState<MapleModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (!proxyUrl) {
      setAvailableModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    fetchMapleModels(apiKey, proxyUrl).then((models) => {
      if (!cancelled) {
        setAvailableModels(models);
        if (isCustom && !model && models[0]) updateConnection(provider, { model: models[0].id });
        setModelsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setModelsLoading(false);
    });
    return () => { cancelled = true; };
  }, [apiKey, proxyUrl, isCustom, model, provider]);

  const hasKey = apiKey.length > 0;
  const connectionReady = isCustom ? proxyUrl.trim().length > 0 : hasKey;

  // Budget Buddy is enabled when a connection is ready and the disclaimer is accepted.
  const isMapleEnabled = connectionReady && disclaimerAccepted;

  const setApiKey = (value: string) => {
    if (custom) updateConnection(custom.id, { apiKey: value });
    else if (provider === 'ppq') setPpqApiKey(value);
    else setMapleApiKey(value);
  };
  const setModelForProvider = (value: string) => {
    if (custom) updateConnection(custom.id, { model: value });
    else if (provider === 'ppq') setPpqModel(value);
    else setMapleModel(value);
  };
  const setProxyUrlForProvider = (value: string) => {
    if (custom) updateConnection(custom.id, { baseUrl: value.trim() });
    else if (provider === 'ppq') setPpqProxyUrl(value);
    else setMapleProxyUrl(value);
  };
  const activeName = custom?.name || (provider === 'ppq' ? 'PPQ' : 'Maple');

  return {
    // Active settings (resolved based on provider)
    provider,
    setProvider,
    apiKey,
    setApiKey,
    proxyUrl,
    setProxyUrl: setProxyUrlForProvider,
    model,
    setModel: setModelForProvider,
    evergreenContext,
    setEvergreenContext,
    zdr: provider === 'ppq' ? ppqZdr : false,
    setZdr: setPpqZdr,

    // Status
    hasKey,
    connectionReady,
    isCustom,
    isMapleEnabled, // backward compat for components that check this
    disclaimerAccepted,
    setDisclaimerAccepted,
    availableModels,
    modelsLoading,
    activeName,
    connections,
    addConnection,
    removeConnection,
    updateConnection,

    // Per-provider settings (for the settings UI)
    maple: {
      apiKey: mapleApiKey,
      setApiKey: setMapleApiKey,
      proxyUrl: mapleProxyUrl,
      setProxyUrl: setMapleProxyUrl,
      model: mapleModel,
      setModel: setMapleModel,
      enabled: mapleEnabled,
      setEnabled: setMapleEnabled,
    },
    ppq: {
      apiKey: ppqApiKey,
      setApiKey: setPpqApiKey,
      proxyUrl: ppqProxyUrl,
      setProxyUrl: setPpqProxyUrl,
      model: ppqModel,
      setModel: setPpqModel,
      zdr: ppqZdr,
      setZdr: setPpqZdr,
    },
  };
}
