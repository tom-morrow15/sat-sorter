/**
 * Debug logging utility.
 *
 * In production builds, debug logs are suppressed.
 * Set `localStorage.debug = 'true'` to enable verbose logging in production.
 * Set `localStorage.debug = 'false'` to suppress all logs (including warnings).
 *
 * Usage:
 *   import { debug } from '@/lib/debug';
 *   debug('[SharedBudgetSync] Received event', data);
 */

const isDev = import.meta.env.DEV;

function shouldLog(): boolean {
  if (isDev) return true;
  try {
    return localStorage.getItem('debug') === 'true';
  } catch {
    return false;
  }
}

/** Conditional log — only outputs in dev or when debug mode is enabled. */
export function debug(...args: unknown[]): void {
  if (shouldLog()) {
    console.log(...args);
  }
}

/** Conditional warn — always outputs in dev; in prod only when debug is enabled. */
export function debugWarn(...args: unknown[]): void {
  if (shouldLog()) {
    console.warn(...args);
  }
}
