import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Node 22+ ships an experimental global `localStorage` that is disabled unless
// Node is run with --localstorage-file. Its presence shadows jsdom's working
// implementation, leaving `localStorage` undefined inside tests. Install an
// in-memory stand-in when that happens.
if (typeof globalThis.localStorage === 'undefined') {
  const memory = new Map<string, string>();
  const storage: Storage = {
    get length() { return memory.size; },
    clear: () => memory.clear(),
    getItem: (key: string) => memory.get(key) ?? null,
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key: string) => { memory.delete(key); },
    setItem: (key: string, value: string) => { memory.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, writable: true });
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));