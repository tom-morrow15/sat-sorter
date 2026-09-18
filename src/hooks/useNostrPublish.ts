import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

import type { NostrEvent } from "@nostrify/nostrify";

/** Input for publishing: kind/content required; tags and created_at optional
 *  (created_at defaults to now in the mutation). */
export type NostrPublishInput = Omit<NostrEvent, 'id' | 'pubkey' | 'sig' | 'tags' | 'created_at'> & {
  tags?: string[][];
  created_at?: number;
};

export function useNostrPublish(): UseMutationResult<NostrEvent, Error, NostrPublishInput> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: NostrPublishInput) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}