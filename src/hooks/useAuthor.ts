import { type NostrEvent, type NostrMetadata } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parseProfileMetadata } from '@/lib/profile';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      const [event] = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        // 5s: profile queries against slower relays (e.g. Primal) routinely
        // take longer than the previous 1.5s timeout, which made real names
        // and avatars fall back to generated placeholder names.
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );

      if (!event) {
        // Not found — return empty instead of throwing. Throwing triggered
        // retry storms that re-slammed the relays for the same result.
        return {};
      }

      return { metadata: parseProfileMetadata(event.content), event };
    },
    staleTime: 5 * 60 * 1000, // Keep cached data fresh for 5 minutes
    retry: 1,
  });
}
