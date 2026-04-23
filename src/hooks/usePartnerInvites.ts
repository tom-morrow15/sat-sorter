import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { BudgetPartnerInvite, BudgetState } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

// Custom application event kind for Sat Sorter partner invites
// Not a DM - this is a dedicated app event that only Sat Sorter listens for
const INVITE_KIND = 4001;

interface PartnerInvitePayload {
  type: 'invite' | 'accept' | 'decline';
  inviteId: string;
  budgetMonth: string;
  permission: 'view' | 'edit';
  fromPubkey: string;
  fromName?: string;
  // For invites: the budget snapshot so the partner can import it
  budgetSnapshot?: BudgetState;
}

/**
 * Partner Invites System
 *
 * This is NOT a DM system - it uses a custom application event kind (4001)
 * specifically for Sat Sorter partner invites.
 *
 * - Sends encrypted invites to another Sat Sorter user
 * - The invite includes a snapshot of the current budget so the partner
 *   can access it once accepted
 * - Recipients see invites in their own Sat Sorter app (no DM interference)
 * - Uses NIP-04 encryption (with NIP-44 fallback) for privacy
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

      try {
        if (user.signer.nip04) {
          return await user.signer.nip04.encrypt(recipientPubkey, data);
        } else if (user.signer.nip44) {
          return await user.signer.nip44.encrypt(recipientPubkey, data);
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

      // Try NIP-04 first
      if (user.signer.nip04) {
        try {
          return await user.signer.nip04.decrypt(senderPubkey, ciphertext);
        } catch {
          // Fall through to NIP-44
        }
      }

      // Try NIP-44 as fallback
      if (user.signer.nip44) {
        try {
          return await user.signer.nip44.decrypt(senderPubkey, ciphertext);
        } catch {
          // All decryption attempts failed
        }
      }

      return null;
    },
    [user]
  );

  /**
   * Send a partner invite with the budget snapshot embedded
   */
  const sendInvite = useCallback(
    async (
      toPubkey: string,
      budgetMonth: string,
      permission: 'view' | 'edit',
      budgetSnapshot: BudgetState,
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
          budgetMonth,
          permission,
          fromPubkey: user.pubkey,
          fromName,
          budgetSnapshot, // Include current budget so partner can access it
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
            ['p', toPubkey], // Recipient pubkey (indexable by relays)
            ['t', 'sat-sorter-invite'], // Category tag (indexable by relays)
            ['d', inviteId], // Unique invite identifier
            ['month', budgetMonth],
            ['perm', permission],
            ['alt', `Sat Sorter budget partner invite`],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite sent to',
          toPubkey.slice(0, 16) + '...',
          'for month',
          budgetMonth
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
   * Accept a partner invite - returns the budget snapshot so caller can import it
   */
  const acceptInvite = useCallback(
    async (invite: BudgetPartnerInvite & { budgetSnapshot?: BudgetState }): Promise<{
      success: boolean;
      budgetSnapshot?: BudgetState;
    }> => {
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
          budgetMonth: invite.budgetMonth,
          permission: invite.permission,
          fromPubkey: user.pubkey,
        };

        const encryptedContent = await encryptForRecipient(
          invite.fromPubkey,
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
            ['p', invite.fromPubkey],
            ['t', 'sat-sorter-invite-response'],
            ['d', invite.id],
            ['month', invite.budgetMonth],
            ['status', 'accepted'],
            ['alt', 'Sat Sorter budget invite accepted'],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite accepted from',
          invite.fromPubkey.slice(0, 16) + '...'
        );

        return {
          success: true,
          budgetSnapshot: invite.budgetSnapshot,
        };
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
          budgetMonth: invite.budgetMonth,
          permission: invite.permission,
          fromPubkey: user.pubkey,
        };

        const encryptedContent = await encryptForRecipient(
          invite.fromPubkey,
          JSON.stringify(payload)
        );

        if (!encryptedContent) {
          return false;
        }

        await publish({
          kind: INVITE_KIND,
          content: encryptedContent,
          tags: [
            ['p', invite.fromPubkey],
            ['t', 'sat-sorter-invite-response'],
            ['d', invite.id],
            ['month', invite.budgetMonth],
            ['status', 'declined'],
            ['alt', 'Sat Sorter budget invite declined'],
          ],
        });

        console.log(
          '[usePartnerInvites] Invite declined from',
          invite.fromPubkey.slice(0, 16) + '...'
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

        const invites: Array<BudgetPartnerInvite & { budgetSnapshot?: BudgetState }> = [];
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

              invites.push({
                id: payload.inviteId,
                fromPubkey: payload.fromPubkey,
                budgetMonth: payload.budgetMonth,
                permission: payload.permission,
                createdAt: event.created_at,
                status: 'pending',
                budgetSnapshot: payload.budgetSnapshot,
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
