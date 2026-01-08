import { useState, useEffect, useCallback } from 'react';

// Custom event name for same-tab localStorage sync
const LOCAL_STORAGE_CHANGE_EVENT = 'local-storage-change';

// Custom event for notifying other hook instances in the same tab
interface LocalStorageChangeDetail {
  key: string;
  value: string;
}

/**
 * Generic hook for managing localStorage state
 * Now supports reactive updates across multiple hook instances in the same tab
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
) {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = useCallback(
    serializer?.deserialize || JSON.parse,
    [serializer?.deserialize]
  );

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setState(currentState => {
        const valueToStore = value instanceof Function ? value(currentState) : value;
        const serialized = serialize(valueToStore);
        localStorage.setItem(key, serialized);

        // Dispatch custom event for same-tab sync
        window.dispatchEvent(
          new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_CHANGE_EVENT, {
            detail: { key, value: serialized },
          })
        );

        return valueToStore;
      });
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key, serialize]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(deserialize(e.newValue));
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserialize]);

  // Sync with localStorage changes from same tab (other hook instances)
  useEffect(() => {
    const handleLocalChange = (e: Event) => {
      const customEvent = e as CustomEvent<LocalStorageChangeDetail>;
      if (customEvent.detail.key === key) {
        try {
          setState(deserialize(customEvent.detail.value));
        } catch (error) {
          console.warn(`Failed to sync ${key} from local event:`, error);
        }
      }
    };

    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
    return () => window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
  }, [key, deserialize]);

  return [state, setValue] as const;
}