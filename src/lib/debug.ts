import { debugLog } from '@/lib/debugLog';

const isDev = import.meta.env.DEV;

function shouldLog(): boolean {
  if (isDev) return true;
  try {
    return localStorage.getItem('debug') === 'true';
  } catch {
    return false;
  }
}

function textOf(args: unknown[]): string {
  return args.map((arg) => {
    if (typeof arg === 'string') return arg;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }).join(' ');
}

/** Always kept in the in-app log. Printed to the console in dev only. */
export function debug(...args: unknown[]): void {
  const text = textOf(args);
  if (shouldLog()) console.log(...args);
  else debugLog(text, 'log');
}

/** Always kept in the in-app log. Printed to the console in dev only. */
export function debugWarn(...args: unknown[]): void {
  const text = textOf(args);
  if (shouldLog()) console.warn(...args);
  else debugLog(text, 'warn');
}