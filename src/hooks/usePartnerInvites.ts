import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { BudgetPartnerInvite } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';
import { ensureHexPubkey } from '@/lib/budgetCrypto';

// Custom application event kind for Sat Sorter partner invites
// Not a DM - this is a dedicated app event that only Sat Sorter listens for
const INVITE_KIND = 4001;

interface PartnerInvitePayload {
  type: 'invite' | 'accept' | 'decline';
  inviteId: string;
  month: string;
  permission: 'viewer' | 'editor';
  from: string;
  fromName?: string;
  /** NIP-44 encrypted budget nsec (only present in type=invite). */
  encryptedBudgetKey?: string;
  /** The budget's npub (only present in type=invite). */
  budgetNpub?: string;
}

/**
 * Partner Invites System
 *
 * This is NOT a DM system - it uses a custom application event kind (4001)
 * specifically for Sat Sorter partner invites.
 *
 * - Sends encrypted invites to another Sat Sorter user
 * - The invite shares only the encrypted budget nsec, NOT a full snapshot
 * - Recipients decrypt the budget nsec and use it to fetch budget data
 *   directly from relays under the budget npub
 * - Uses NIP-04/NIP-44 encryption for privacy
 */
export function usePartnerInvites() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();

  /**
   * Encrypt a payload for a recipient. Prefers NIP-04 for broad compat.
   */
  const encryptForRecipient = useCallback(
    async (recipientPubkey: string, data: string): Promise<string | null> => {
      if (!user?.signer) return null;
      const recipientHex = ensureHexPubkey(recipientPubkey);
      try {
        if (user.signer.nip04) {
          return await user.signer.nip04.encrypt(recipientHex, data);
        } else if (user.signer.nip44) {
          return await user.signer.nip44.encrypt(recipientHex, data);
        }
      } catch (error) {
        console.error('[usePartnerInvites] Encryption failed:', error);
      }
      return null;
    },
    [user]
  );

  /**
   * Decrypt a payload from a sender. Tries NIP-04 first, then NIP-44.
   */
  const decryptFromSender = useCallback(
    async (senderPubkey: string, ciphertext: string): Promise<string | null> => {
      if (!user?.signer) return null;
      const senderHex = ensureHexPubkey(senderPubkey);

      // Try NIP-04 first
      if (user.signer.nip04) {
        try {
          return await user.signer.nip04.decrypt(senderHex, ciphertext);
        } catch {
          // Fall through to NIP-44
        }
      }

      // Try NIP-44 as fallback
      if (user.signer.nip44) {
        try {
          return await user.signer.nip44.decrypt(senderHex, ciphertext);
        } catch {
          // All decryption attempts failed
        }
      }

      return null;
    },
    [user]
  );

  /**
   * Send a partner invite with the encrypted budget nsec (no snapshot).
   * The recipient will decrypt the budget nsec and use it to subscribe to
   * budget data from relays under the budget npub.
   */
  const sendInvite = useCallback(
    async (
      toPubkey: string,
      budgetMonth: string,
      permission: 'view' | 'edit',
      encryptedBudgetKey: string,
      budgetNpub: string,
      fromName?: string
    ): Promise<boolean> => {
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return false;
      }

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.error('[usePartnerInvites] No encryption methods available');
        return false;
      }

      try {
        const inviteId = generateId();
        const payload: PartnerInvitePayload = {
          type: 'invite',
          inviteId,
          month: budgetMonth,
          permission: permission === 'edit' ? 'editor' : 'viewer',
          from: ensureHexPubkey(user.pubkey),
          fromName,
          encryptedBudgetKey,
          budgetNpub,
        };

        const encryptedContent = await encryptForRecipient(
          toPubkey,
          JSON.stringify(payload)
        );

        if (!encryptedContent) {
          console.error('[usePartnerInvites] Failed to encrypt invite');
          return false;
        }

        // Publish custom invite event (NOT a DM!)
        await publish({
          kind: INVITE_KIND,
          content: encryptedContent,
          tags: [
            ['p', toPubkey],
            ['t', 'sat-sorter-invite'],
            ['d', inviteId],
            ['budget', budgetNpub],
            ['perm', permission],
            ['alt', `Sat Sorter budget partner invite`],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite sent to',
          toPubkey.slice(0, 16) + '...',
          'for budget npub',
          budgetNpub.slice(0, 16) + '...'
        );
        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to send invite:', error);
        return false;
      }
    },
    [user, publish, encryptForRecipient]
  );

  /**
   * Accept a partner invite — publishes the acceptance response.
   * The caller is responsible for decrypting the budget key and storing it
   * locally (see ManagePartnersDialog.handleAcceptInvite).
   */
  const acceptInvite = useCallback(
    async (invite: BudgetPartnerInvite): Promise<{ success: boolean }> => {
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return { success: false };
      }

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.error('[usePartnerInvites] No encryption methods available');
        return { success: false };
      }

      try {
        const payload: PartnerInvitePayload = {
          type: 'accept',
          inviteId: invite.id,
          month: invite.month,
          permission: invite.permission,
          from: ensureHexPubkey(user.pubkey),
        };

        const fromHex = ensureHexPubkey(invite.from);
        const encryptedContent = await encryptForRecipient(
          fromHex,
          JSON.stringify(payload)
        );

        if (!encryptedContent) {
          console.error('[usePartnerInvites] Failed to encrypt accept response');
          return { success: false };
        }

        await publish({
          kind: INVITE_KIND,
          content: encryptedContent,
          tags: [
            ['p', invite.from],
            ['t', 'sat-sorter-invite-response'],
            ['d', invite.id],
            ['status', 'accepted'],
            ['alt', 'Sat Sorter budget invite accepted'],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite accepted from',
          invite.from.slice(0, 16) + '...'
        );

        return { success: true };
      } catch (error) {
        console.error('[usePartnerInvites] Failed to accept invite:', error);
        return { success: false };
      }
    },
    [user, publish, encryptForRecipient]
  );

  /**
   * Decline a partner invite
   */
  const declineInvite = useCallback(
    async (invite: BudgetPartnerInvite): Promise<boolean> => {
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return false;
      }

      try {
        const payload: PartnerInvitePayload = {
          type: 'decline',
          inviteId: invite.id,
          month: invite.month,
          permission: invite.permission,
          from: ensureHexPubkey(user.pubkey),
        };

        const fromHex = ensureHexPubkey(invite.from);
        const encryptedContent = await encryptForRecipient(
          fromHex,
          JSON.stringify(payload)
        );

        if (!encryptedContent) {
          return false;
        }

        await publish({
          kind: INVITE_KIND,
          content: encryptedContent,
          tags: [
            ['p', fromHex],
            ['t', 'sat-sorter-invite-response'],
            ['d', invite.id],
            ['status', 'declined'],
            ['alt', 'Sat Sorter budget invite declined'],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite declined from',
          invite.from.slice(0, 16) + '...'
        );
        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to decline invite:', error);
        return false;
      }
    },
    [user, publish, encryptForRecipient]
  );

  /**
   * Fetch received partner invites from Nostr
   */
  const {
    data: receivedInvites = [],
    isLoading: isLoadingInvites,
    refetch,
  } = useQuery({
    queryKey: ['partner-invites', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return [];

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.warn('[usePartnerInvites] No decryption methods available');
        return [];
      }

      try {
        const combinedSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(10000),
        ]);

        console.log(
          '[usePartnerInvites] Querying invites for',
          user.pubkey.slice(0, 16) + '...'
        );

        // Query for invite events addressed to this user
        const events = await nostr.query(
          [
            {
              kinds: [INVITE_KIND],
              '#p': [user.pubkey],
              '#t': ['sat-sorter-invite'],
              limit: 100,
            },
          ],
          { signal: combinedSignal }
        );

        console.log('[usePartnerInvites] Found', events.length, 'invite events');

        const invites: BudgetPartnerInvite[] = [];
        const seenInviteIds = new Set<string>();

        for (const event of events) {
          try {
            const decrypted = await decryptFromSender(event.pubkey, event.content);

            if (!decrypted) {
              console.warn(
                '[usePartnerInvites] Could not decrypt event from',
                event.pubkey.slice(0, 16) + '...'
              );
              continue;
            }

            const payload: PartnerInvitePayload = JSON.parse(decrypted);

            if (payload.type === 'invite' && !seenInviteIds.has(payload.inviteId)) {
              seenInviteIds.add(payload.inviteId);

              // Always coerce the 'from' (owner/sender pubkey) to hex.
              // Fall back to the event author (event.pubkey) which is always hex,
              // in case payload.from is missing, npub, or legacy data.
              const senderPub = ensureHexPubkey(payload.from || event.pubkey);
              invites.push({
                id: payload.inviteId,
                from: senderPub,
                month: payload.month,
                permission: payload.permission,
                encryptedBudgetKey: payload.encryptedBudgetKey || '',
                budgetNpub: payload.budgetNpub || '',
                createdAt: event.created_at,
                status: 'pending',
              });
            }
          } catch (error) {
            console.warn('[usePartnerInvites] Failed to process invite event:', error);
          }
        }

        // Sort by newest first
        invites.sort((a, b) => b.createdAt - a.createdAt);

        console.log('[usePartnerInvites] Successfully parsed', invites.length, 'invites');
        return invites;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to fetch invites:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey && (!!user?.signer?.nip04 || !!user?.signer?.nip44),
    staleTime: 15000,
    refetchInterval: 30000, // Check for new invites every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Filter to only pending invites
  const pendingInvites = receivedInvites.filter((i) => i.status === 'pending');

  return {
    sendInvite,
    acceptInvite,
    declineInvite,
    receivedInvites,
    pendingInvites,
    pendingInvitesCount: pendingInvites.length,
    isLoadingInvites,
    refetch,
  };
}
