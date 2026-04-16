import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic hook for managing localStorage state
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
    setState((prevState) => {
      try {
        const valueToStore = value instanceof Function ? value(prevState) : value;
        localStorage.setItem(key, serializeRef.current(valueToStore));
        return valueToStore;
      } catch (error) {
        console.warn(`Failed to save ${key} to localStorage:`, error);
        return prevState;
      }
    });
  }, [key]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(deserializeRef.current(e.newValue));
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setValue] as const;
}