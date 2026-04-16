import { useState, useEffect, useCallback, useRef } from 'react';

// Custom event name for same-tab synchronization
const LOCAL_STORAGE_SYNC_EVENT = 'local-storage-sync';

/**
 * Generic hook for managing localStorage state
 * Synchronizes state between components in the same tab AND across tabs
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
  const deserialize = serializer?.deserialize || JSON.parse;

  // Keep serialize/deserialize stable via refs to prevent stale closures
  const serializeRef = useRef(serialize);
  const deserializeRef = useRef(deserialize);
  serializeRef.current = serialize;
  deserializeRef.current = deserialize;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  });

  // Use functional setState to avoid stale closure issues
  // This ensures that when called with a function, it uses the actual latest state
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    console.log(`[useLocalStorage] setValue called for key: ${key}`);
    setState((prevState) => {
      try {
        const valueToStore = value instanceof Function ? value(prevState) : value;
        console.log(`[useLocalStorage] State update for ${key}:`, {
          prevState: typeof prevState === 'object' ? Object.keys(prevState as object) : prevState,
          newState: typeof valueToStore === 'object' ? Object.keys(valueToStore as object) : valueToStore,
        });
        const serialized = serializeRef.current(valueToStore);
        localStorage.setItem(key, serialized);
        
        // Dispatch custom event so other useLocalStorage instances in same tab sync up
        window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, {
          detail: { key, value: serialized }
        }));
        
        return valueToStore;
      } catch (error) {
        console.warn(`Failed to save ${key} to localStorage:`, error);
        return prevState;
      }
    });
  }, [key]);

  // Sync with localStorage changes
  useEffect(() => {
    // Handle changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(deserializeRef.current(e.newValue));
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    // Handle changes from other useLocalStorage instances in SAME tab
    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: string }>;
      if (customEvent.detail?.key === key && customEvent.detail?.value) {
        try {
          setState(deserializeRef.current(customEvent.detail.value));
        } catch (error) {
          console.warn(`Failed to sync ${key} from custom event:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleCustomSync);
    };
  }, [key]);

  return [state, setValue] as const;
}