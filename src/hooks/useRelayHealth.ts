import { useCallback, useRef, useState } from 'react';
import { mapRelayUrl } from '@/lib/devRelayProxy';

export type RelayHealthState = 'unknown' | 'testing' | 'connected' | 'failed';

export interface RelayHealth {
  state: RelayHealthState;
  /** Latency in ms for successful connections */
  latencyMs?: number;
  /** Plain-English failure reason for failed connections */
  reason?: string;
  /** When this result was obtained */
  checkedAt?: number;
}

/**
 * Tests relay connectivity by opening a real websocket to each relay.
 *
 * Browsers don't expose detailed TLS/cert errors for websockets, so failure
 * reasons are best-effort: we distinguish timeouts (unreachable/blocked) from
 * immediate errors (rejected handshake — often a certificate or auth problem).
 */
export function useRelayHealth() {
  const [results, setResults] = useState<Record<string, RelayHealth>>({});
  const [testing, setTesting] = useState(false);
  const sockets = useRef<Set<WebSocket>>(new Set());

  const testRelay = useCallback((url: string): Promise<RelayHealth> => {
    return new Promise((resolve) => {
      setResults(prev => ({ ...prev, [url]: { state: 'testing' } }));

      let settled = false;
      const started = Date.now();
      let ws: WebSocket;
      try {
        // Test through the same connection path the app actually uses
        // (in dev, this may be the local relay proxy)
        ws = new WebSocket(mapRelayUrl(url));
      } catch {
        const result: RelayHealth = { state: 'failed', reason: 'Invalid relay URL', checkedAt: Date.now() };
        setResults(prev => ({ ...prev, [url]: result }));
        resolve(result);
        return;
      }
      sockets.current.add(ws);

      const finish = (result: RelayHealth) => {
        if (settled) return;
        settled = true;
        sockets.current.delete(ws);
        try { ws.close(); } catch { /* already closed */ }
        setResults(prev => ({ ...prev, [url]: result }));
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish({ state: 'failed', reason: 'No response — relay unreachable, offline, or blocked', checkedAt: Date.now() });
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timer);
        finish({ state: 'connected', latencyMs: Date.now() - started, checkedAt: Date.now() });
      };
      ws.onerror = () => {
        clearTimeout(timer);
        finish({
          state: 'failed',
          reason: 'Connection refused — the relay rejected the handshake (check the address, or the relay may use a certificate your browser doesn\u2019t trust)',
          checkedAt: Date.now(),
        });
      };
    });
  }, []);

  const testAll = useCallback(async (urls: string[]) => {
    setTesting(true);
    try {
      await Promise.all(urls.map(url => testRelay(url)));
    } finally {
      setTesting(false);
    }
  }, [testRelay]);

  return { results, testing, testRelay, testAll };
}
