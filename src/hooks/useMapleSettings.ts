import { useLocalStorage } from './useLocalStorage';

export interface MapleSettings {
  apiKey: string;
  enabled: boolean;
  evergreenContext: string;
}

export const MAPLE_KEY_STORAGE = 'sat-sorter:maple-api-key';
export const MAPLE_ENABLED_STORAGE = 'sat-sorter:maple-enabled';
export const MAPLE_CONTEXT_STORAGE = 'sat-sorter:maple-evergreen-context';

export function useMapleSettings() {
  const [apiKey, setApiKey] = useLocalStorage<string>(MAPLE_KEY_STORAGE, '');
  const [enabled, setEnabled] = useLocalStorage<boolean>(MAPLE_ENABLED_STORAGE, false);
  const [evergreenContext, setEvergreenContext] = useLocalStorage<string>(
    MAPLE_CONTEXT_STORAGE,
    ''
  );

  const hasKey = apiKey.length > 0;

  return {
    apiKey,
    setApiKey,
    enabled,
    setEnabled,
    evergreenContext,
    setEvergreenContext,
    hasKey,
    isMapleEnabled: hasKey && enabled,
  };
}
