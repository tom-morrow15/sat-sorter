import { useEffect, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePartners } from '@/hooks/usePartners';

const INVITE_KIND = 4001;

/**
 * Listens for partner invite response events (accept/decline) from invitees
 * and updates the owner's partner list to reflect their acceptance status.
 *
 * This runs in the background whenever the user has pending partners.
 * When a partner accepts the invite, their status is automatically updated
 * from "pending" to "accepted", enabling bi-directional real-time sync.
 */
export function usePartnerInviteResponses() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { partners, updatePartnerStatus } = usePartners();

  // Use ref to always have latest partners/updater without re-subscribing
  const latestRef = useRef({ partners, updatePartnerStatus });
  latestRef.current = { partners, updatePartnerStatus };

  const pendingPartnerPubkeys = partners
    .filter((p) => p.status === 'pending')
    .map((p) => p.pubkey)
    .sort()
    .join(',');

  useEffect(() => {
    if (!user?.pubkey) return;
    if (!user.signer.nip04 && !user.signer.nip44) return;
    if (!pendingPartnerPubkeys) return;

    const pendingPubkeys = pendingPartnerPubkeys.split(',').filter(Boolean);
    if (pendingPubkeys.length === 0) return;

    console.log(
      `[PartnerInviteResponses] Watching for responses from ${pendingPubkeys.length} pending partner(s)`
    );

    const sub = nostr.req(
      [
        {
          kinds: [INVITE_KIND],
          '#p': [user.pubkey],
          '#t': ['sat-sorter-invite-response'],
          authors: pendingPubkeys,
          limit: 50,
        },
      ],
      {
        onevent: async (event) => {
          try {
            const statusTag = event.tags.find((t) => t[0] === 'status')?.[1];
            if (statusTag !== 'accepted' && statusTag !== 'declined') {
              return;
            }

            const { partners: currentPartners, updatePartnerStatus: updater } =
              latestRef.current;
            const partner = currentPartners.find((p) => p.pubkey === event.pubkey);
            if (!partner) return;
            if (partner.status === statusTag) return; // Already up to date

            console.log(
              `[PartnerInviteResponses] Partner ${event.pubkey.slice(0, 8)} ${statusTag}, updating status`
            );
            await updater(event.pubkey, statusTag);
          } catch (e) {
            console.error('[PartnerInviteResponses] Error processing response:', e);
          }
        },
      }
    );

    return () => {
      sub.close();
    };
  }, [user?.pubkey, user?.signer?.nip04, user?.signer?.nip44, nostr, pendingPartnerPubkeys]);
}
