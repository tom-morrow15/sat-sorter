/**
 * Debug log store — captures sync-related log messages in a ring buffer
 * so they can be viewed in-app (useful on mobile PWAs where there's no
 * browser console).
 */

export interface DebugLogEntry {
  timestamp: number;
  message: string;
  level: 'log' | 'warn' | 'error';
}

const MAX_ENTRIES = 100;
const buffer: DebugLogEntry[] = [];
const listeners = new Set<() => void>();

/** Patterns we capture — sync/partner related logs only. */
const CAPTURE_PATTERNS = [
  '[PartnerSyncWrapper]',
  '[SharedBudgetSync]',
  '[BudgetContext]',
  '[ManagePartnersDialog]',
];

function shouldCapture(message: string): boolean {
  return CAPTURE_PATTERNS.some((p) => message.includes(p));
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function debugLog(message: string, level: 'log' | 'warn' | 'error' = 'log') {
  if (!shouldCapture(message)) return;
  buffer.push({ timestamp: Date.now(), message, level });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  listeners.forEach((l) => l());
}

export function getDebugLogs(): DebugLogEntry[] {
  return [...buffer];
}

export function clearDebugLogs(): void {
  buffer.length = 0;
  listeners.forEach((l) => l());
}

export function subscribeDebugLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Install a global console interceptor that captures sync-related logs into
 * the debug buffer while still passing them through to the real console.
 * Call once at app startup.
 */
export function installDebugLogCapture(): void {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    const msg = args.map(formatArg).join(' ');
    debugLog(msg, 'log');
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    const msg = args.map(formatArg).join(' ');
    debugLog(msg, 'warn');
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    const msg = args.map(formatArg).join(' ');
    debugLog(msg, 'error');
  };
}
