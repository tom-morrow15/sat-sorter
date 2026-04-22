import { useCallback, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { BudgetPartnerInvite, BudgetState } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

// Use a custom NIP-04 DM-like approach for partner invites
// Kind 1059 is NIP-sealed events, but we'll use kind 4 (encrypted DMs) for simplicity
const INVITE_KIND = 4; // Encrypted DMs
const INVITE_TAG = 'sat-sorter-invite';

interface PartnerInvitePayload {
  type: 'invite' | 'accept' | 'decline' | 'revoke';
  inviteId: string;
  budgetMonth: string;
  permission: 'view' | 'edit';
  fromPubkey: string;
  fromName?: string;
  budgetData?: BudgetState; // For accepted invites
}

export function usePartnerInvites() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();

  /**
   * Send a partner invite via encrypted DM
   */
  const sendInvite = useCallback(
    async (
      toPubkey: string,
      budgetMonth: string,
      permission: 'view' | 'edit',
      fromName?: string
    ): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        console.error('[usePartnerInvites] User not logged in or NIP-44 not available');
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
        };

        // Encrypt the invite message
        const encryptedContent = await user.signer.nip44.encrypt(
          toPubkey,
          JSON.stringify(payload)
        );

        // Publish as a DM
        await publish({
          kind: 4, // DM kind
          content: encryptedContent,
          tags: [
            ['p', toPubkey],
            ['invite-id', inviteId],
            ['budget-month', budgetMonth],
            ['sat-sorter', 'budget-invite'],
          ],
        });

        console.log('[usePartnerInvites] Invite sent to', toPubkey);
        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to send invite:', error);
        return false;
      }
    },
    [user, publish]
  );

  /**
   * Accept a partner invite
   */
  const acceptInvite = useCallback(
    async (
      invite: BudgetPartnerInvite,
      budgetData: BudgetState
    ): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        console.error('[usePartnerInvites] User not logged in or NIP-44 not available');
        return false;
      }

      try {
        const payload: PartnerInvitePayload = {
          type: 'accept',
          inviteId: invite.id,
          budgetMonth: invite.budgetMonth,
          permission: invite.permission,
          fromPubkey: user.pubkey,
          budgetData, // Include budget data so owner can verify
        };

        // Encrypt the acceptance message
        const encryptedContent = await user.signer.nip44.encrypt(
          invite.fromPubkey,
          JSON.stringify(payload)
        );

        // Publish as a DM back to the inviter
        await publish({
          kind: 4,
          content: encryptedContent,
          tags: [
            ['p', invite.fromPubkey],
            ['invite-id', invite.id],
            ['budget-month', invite.budgetMonth],
            ['sat-sorter', 'budget-invite-accept'],
          ],
        });

        console.log('[usePartnerInvites] Invite accepted from', invite.fromPubkey);
        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to accept invite:', error);
        return false;
      }
    },
    [user, publish]
  );

  /**
   * Decline a partner invite
   */
  const declineInvite = useCallback(
    async (invite: BudgetPartnerInvite): Promise<boolean> => {
      if (!user?.pubkey || !user?.signer?.nip44) {
        console.error('[usePartnerInvites] User not logged in or NIP-44 not available');
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

        const encryptedContent = await user.signer.nip44.encrypt(
          invite.fromPubkey,
          JSON.stringify(payload)
        );

        await publish({
          kind: 4,
          content: encryptedContent,
          tags: [
            ['p', invite.fromPubkey],
            ['invite-id', invite.id],
            ['budget-month', invite.budgetMonth],
            ['sat-sorter', 'budget-invite-decline'],
          ],
        });

        console.log('[usePartnerInvites] Invite declined from', invite.fromPubkey);
        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to decline invite:', error);
        return false;
      }
    },
    [user, publish]
  );

  /**
   * Fetch received partner invites from Nostr
   */
  const { data: receivedInvites = [], isLoading: isLoadingInvites } = useQuery({
    queryKey: ['partner-invites', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey || !user?.signer?.nip44) return [];

      try {
        const combinedSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(10000),
        ]);

        // Query for DMs with sat-sorter invite tags
        const events = await nostr.query(
          [
            {
              kinds: [4],
              '#p': [user.pubkey],
              '#sat-sorter': ['budget-invite'],
              limit: 50,
            },
          ],
          { signal: combinedSignal }
        );

        const invites: BudgetPartnerInvite[] = [];

        for (const event of events) {
          try {
            // Decrypt the message
            const decrypted = await user.signer.nip44.decrypt(
              event.pubkey,
              event.content
            );
            const payload: PartnerInvitePayload = JSON.parse(decrypted);

            if (payload.type === 'invite') {
              const invite: BudgetPartnerInvite = {
                id: payload.inviteId,
                fromPubkey: payload.fromPubkey,
                budgetMonth: payload.budgetMonth,
                permission: payload.permission,
                createdAt: event.created_at,
                status: 'pending',
              };

              // Check if we already have this invite
              if (
                !invites.find(
                  (i) =>
                    i.id === invite.id ||
                    (i.fromPubkey === invite.fromPubkey &&
                      i.budgetMonth === invite.budgetMonth)
                )
              ) {
                invites.push(invite);
              }
            }
          } catch (error) {
            console.warn('[usePartnerInvites] Failed to decrypt invite:', error);
          }
        }

        console.log('[usePartnerInvites] Fetched', invites.length, 'invites');
        return invites;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to fetch invites:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey && !!user?.signer?.nip44,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    sendInvite,
    acceptInvite,
    declineInvite,
    receivedInvites,
    isLoadingInvites,
  };
}
