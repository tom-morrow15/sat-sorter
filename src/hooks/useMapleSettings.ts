import { useLocalStorage } from './useLocalStorage';

export interface MapleSettings {
  apiKey: string;
  enabled: boolean;
  evergreenContext: string;
  proxyUrl: string;
}

export const MAPLE_KEY_STORAGE = 'sat-sorter:maple-api-key';
export const MAPLE_ENABLED_STORAGE = 'sat-sorter:maple-enabled';
export const MAPLE_CONTEXT_STORAGE = 'sat-sorter:maple-evergreen-context';
export const MAPLE_PROXY_URL_STORAGE = 'sat-sorter:maple-proxy-url';

// Default to localhost proxy (Maple desktop app)
export const DEFAULT_PROXY_URL = 'http://localhost:8080/v1';

export function useMapleSettings() {
  const [apiKey, setApiKey] = useLocalStorage<string>(MAPLE_KEY_STORAGE, '');
  const [enabled, setEnabled] = useLocalStorage<boolean>(MAPLE_ENABLED_STORAGE, false);
  const [evergreenContext, setEvergreenContext] = useLocalStorage<string>(
    MAPLE_CONTEXT_STORAGE,
    ''
  );
  const [proxyUrl, setProxyUrl] = useLocalStorage<string>(
    MAPLE_PROXY_URL_STORAGE,
    DEFAULT_PROXY_URL
  );

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
    hasKey,
    isMapleEnabled: hasKey && enabled,
  };
}
