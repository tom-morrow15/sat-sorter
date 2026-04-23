import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { BudgetPartnerInvite } from '@/lib/budgetTypes';
import { generateId } from '@/lib/budgetTypes';

// Custom application event kind for Sat Sorter partner invites
// Using a regular event kind so it's stored permanently by relays
const INVITE_KIND = 4001;

interface PartnerInvitePayload {
  type: 'invite' | 'accept' | 'decline' | 'revoke';
  inviteId: string;
  budgetMonth: string;
  permission: 'view' | 'edit';
  fromPubkey: string;
  fromName?: string;
}

/**
 * Partner Invites System
 * 
 * Uses a custom event kind (4001) with NIP-04 encryption to send
 * partner invites via Nostr. The 'p' tag is indexable so recipients
 * can easily query for invites addressed to them.
 */
export function usePartnerInvites() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();

  /**
   * Send a partner invite via encrypted Nostr event
   */
  const sendInvite = useCallback(
    async (
      toPubkey: string,
      budgetMonth: string,
      permission: 'view' | 'edit',
      fromName?: string
    ): Promise<boolean> => {
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return false;
      }

      // Prefer NIP-04 for backward compatibility; fall back to NIP-44
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
        };

        // Use NIP-04 for broader client compatibility
        let encryptedContent: string;
        if (user.signer.nip04) {
          encryptedContent = await user.signer.nip04.encrypt(
            toPubkey,
            JSON.stringify(payload)
          );
        } else if (user.signer.nip44) {
          encryptedContent = await user.signer.nip44.encrypt(
            toPubkey,
            JSON.stringify(payload)
          );
        } else {
          throw new Error('No encryption available');
        }

        // Publish with single-letter 'p' tag (indexable by relays)
        // and 't' tag for categorization
        await publish({
          kind: INVITE_KIND,
          content: encryptedContent,
          tags: [
            ['p', toPubkey], // Recipient pubkey (indexable)
            ['t', 'sat-sorter-invite'], // Category tag (indexable)
            ['d', inviteId], // Unique invite identifier
            ['month', budgetMonth], // Budget month reference
            ['perm', permission], // Permission level
            ['alt', `Budget partner invite from ${fromName || 'a Sat Sorter user'}`],
          ],
        });

        console.log('[usePartnerInvites] Invite sent to', toPubkey, 'for month', budgetMonth);
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
    async (invite: BudgetPartnerInvite): Promise<boolean> => {
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return false;
      }

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.error('[usePartnerInvites] No encryption methods available');
        return false;
      }

      try {
        const payload: PartnerInvitePayload = {
          type: 'accept',
          inviteId: invite.id,
          budgetMonth: invite.budgetMonth,
          permission: invite.permission,
          fromPubkey: user.pubkey,
        };

        let encryptedContent: string;
        if (user.signer.nip04) {
          encryptedContent = await user.signer.nip04.encrypt(
            invite.fromPubkey,
            JSON.stringify(payload)
          );
        } else if (user.signer.nip44) {
          encryptedContent = await user.signer.nip44.encrypt(
            invite.fromPubkey,
            JSON.stringify(payload)
          );
        } else {
          throw new Error('No encryption available');
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
            ['alt', 'Budget partner invite response'],
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
      if (!user?.pubkey) {
        console.error('[usePartnerInvites] User not logged in');
        return false;
      }

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.error('[usePartnerInvites] No encryption methods available');
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

        let encryptedContent: string;
        if (user.signer.nip04) {
          encryptedContent = await user.signer.nip04.encrypt(
            invite.fromPubkey,
            JSON.stringify(payload)
          );
        } else if (user.signer.nip44) {
          encryptedContent = await user.signer.nip44.encrypt(
            invite.fromPubkey,
            JSON.stringify(payload)
          );
        } else {
          throw new Error('No encryption available');
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
            ['alt', 'Budget partner invite response'],
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
  const { data: receivedInvites = [], isLoading: isLoadingInvites, refetch } = useQuery({
    queryKey: ['partner-invites', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) {
        console.log('[usePartnerInvites] No user - skipping query');
        return [];
      }

      if (!user.signer.nip04 && !user.signer.nip44) {
        console.warn('[usePartnerInvites] No decryption methods available');
        return [];
      }

      try {
        const combinedSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(10000),
        ]);

        console.log('[usePartnerInvites] Querying for invites addressed to', user.pubkey);

        // Query for invite events addressed to this user
        // Use both filters to catch invites (kind 4001 with p tag)
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
            // Try NIP-04 first, then NIP-44
            let decrypted: string | null = null;
            
            if (user.signer.nip04) {
              try {
                decrypted = await user.signer.nip04.decrypt(event.pubkey, event.content);
              } catch (e) {
                console.log('[usePartnerInvites] NIP-04 decrypt failed, trying NIP-44');
              }
            }

            if (!decrypted && user.signer.nip44) {
              try {
                decrypted = await user.signer.nip44.decrypt(event.pubkey, event.content);
              } catch (e) {
                console.warn('[usePartnerInvites] NIP-44 decrypt also failed');
              }
            }

            if (!decrypted) {
              console.warn('[usePartnerInvites] Could not decrypt event from', event.pubkey);
              continue;
            }

            const payload: PartnerInvitePayload = JSON.parse(decrypted);

            if (payload.type === 'invite' && !seenInviteIds.has(payload.inviteId)) {
              seenInviteIds.add(payload.inviteId);
              
              const invite: BudgetPartnerInvite = {
                id: payload.inviteId,
                fromPubkey: payload.fromPubkey,
                budgetMonth: payload.budgetMonth,
                permission: payload.permission,
                createdAt: event.created_at,
                status: 'pending',
              };

              invites.push(invite);
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
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    sendInvite,
    acceptInvite,
    declineInvite,
    receivedInvites,
    isLoadingInvites,
    refetch,
  };
}
