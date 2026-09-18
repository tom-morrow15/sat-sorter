import React, { useCallback, useEffect, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { mapRelayUrl } from '@/lib/devRelayProxy';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once.
  // Typed loosely: @nostrify/react bundles its own copy of @nostrify/nostrify,
  // so the NPool instances are structurally identical but nominally distinct
  // types. The pool is only ever passed to NostrContext.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = useRef<any>(undefined);

  // Use refs so the pool always has the latest data
  const relayMetadata = useRef(config.relayMetadata);

  // Invalidate Nostr queries when relay metadata changes
  useEffect(() => {
    relayMetadata.current = config.relayMetadata;
    queryClient.invalidateQueries({ queryKey: ['nostr'] });
  }, [config.relayMetadata, queryClient]);

  // Relay backoff registry: when a relay connection errors (unreachable,
  // bad certificate, timeout), exclude it from routing for a cooldown so one
  // dead relay can't stall every pool query. NPool only emits results when
  // ALL routed relays have answered — a hanging relay otherwise poisons
  // every lookup until the caller's timeout fires.
  const relayBackoff = useRef(new Map<string, number>());
  const BACKOFF_MS = 60_000;

  const isBackedOff = useCallback((url: string): boolean => {
    const until = relayBackoff.current.get(url);
    if (until && Date.now() < until) return true;
    if (until) relayBackoff.current.delete(url); // cooldown expired
    return false;
  }, []);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(mapRelayUrl(url), {
          log: (entry) => {
            // Connection-level failures put the relay in backoff; the pool
            // stops routing to it until the cooldown expires.
            if (entry.level === 'error' || entry.level === 'fatal' || entry.level === 'critical') {
              relayBackoff.current.set(url, Date.now() + BACKOFF_MS);
            }
          },
        });
      },
      reqRouter(filters: NostrFilter[]) {
        const routes = new Map<string, NostrFilter[]>();

        // Route to all read relays that aren't in backoff
        const readRelays = relayMetadata.current.relays
          .filter(r => r.read)
          .map(r => r.url)
          .map(mapRelayUrl)
          .filter(u => !isBackedOff(u));

        // Guard: if every relay is in backoff, route anyway — a slow answer
        // beats no answer.
        for (const url of readRelays.length > 0 ? readRelays : relayMetadata.current.relays.filter(r => r.read).map(r => r.url).map(mapRelayUrl)) {
          routes.set(url, filters);
        }

        return routes;
      },
      eventRouter(_event: NostrEvent) {
        // Get write relays from metadata (skip ones in backoff)
        const writeRelays = relayMetadata.current.relays
          .filter(r => r.write)
          .map(r => r.url)
          .map(mapRelayUrl)
          .filter(u => !isBackedOff(u));

        const allRelays = new Set<string>(writeRelays);

        return [...allRelays];
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;