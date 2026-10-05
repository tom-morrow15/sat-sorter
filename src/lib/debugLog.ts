/**
 * In-app log. Captures console output and uncaught errors so a phone
 * without a debugger can copy what the app just did.
 */

export interface DebugLogEntry {
  timestamp: number;
  message: string;
  level: 'log' | 'warn' | 'error';
}

const MAX_ENTRIES = 400;
const MAX_MESSAGE = 700;
const buffer: DebugLogEntry[] = [];
const listeners = new Set<() => void>();

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function debugLog(message: string, level: 'log' | 'warn' | 'error' = 'log') {
  const text = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE)}…` : message;
  buffer.push({ timestamp: Date.now(), message: text, level });
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

export function formatDebugLogs(entries: DebugLogEntry[] = buffer): string {
  return entries.map((entry) => {
    const time = new Date(entry.timestamp).toISOString();
    return `${time} ${entry.level.toUpperCase()} ${entry.message}`;
  }).join('\n');
}

/**
 * Capture console output and crashes into the in-app log.
 * Call once at app startup.
 */
export function installDebugLogCapture(): void {
  const origLog = console.log.bind(console);
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    debugLog(args.map(formatArg).join(' '), 'log');
  };
  console.info = (...args: unknown[]) => {
    origInfo(...args);
    debugLog(args.map(formatArg).join(' '), 'log');
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    debugLog(args.map(formatArg).join(' '), 'warn');
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    debugLog(args.map(formatArg).join(' '), 'error');
  };

  window.addEventListener('error', (event) => {
    debugLog(`Uncaught: ${event.message}`, 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    debugLog(`Unhandled: ${formatArg(event.reason)}`, 'error');
  });
}