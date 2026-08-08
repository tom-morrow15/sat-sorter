import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBudgetContext } from '@/contexts/BudgetContext';
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
  /** Full budget state snapshot (only present in type=invite).
   *  Encrypted alongside the budget key so the partner gets everything
   *  immediately — no separate seeding step, no relay propagation wait. */
  snapshot?: string; // JSON-stringified BudgetState
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
  const queryClient = useQueryClient();
  const { state: budgetState } = useBudgetContext();

  // Track processed invite IDs — must be defined before the callbacks that use it
  const [processedInviteIds, setProcessedInviteIds] = useLocalStorage<string[]>('sat-sorter:processed-invites', []);

  // Track explicitly declined invite IDs separately — these should NEVER reappear,
  // unlike accepted ones which may need to reappear if the keypair is lost.
  const [declinedInviteIds, setDeclinedInviteIds] = useLocalStorage<string[]>('sat-sorter:declined-invites', []);

  const markInviteProcessed = useCallback((inviteId: string) => {
    setProcessedInviteIds(prev => prev.includes(inviteId) ? prev : [...prev, inviteId]);
  }, [setProcessedInviteIds]);

  const markInviteDeclined = useCallback((inviteId: string) => {
    setDeclinedInviteIds(prev => prev.includes(inviteId) ? prev : [...prev, inviteId]);
  }, [setDeclinedInviteIds]);

  /**
   * Encrypt a payload for a recipient. Tries both NIP-44 and NIP-04
   * to maximize compatibility — the partner's decryption will try both too.
   */
  const encryptForRecipient = useCallback(
    async (recipientPubkey: string, data: string): Promise<string | null> => {
      if (!user?.signer) return null;
      const recipientHex = ensureHexPubkey(recipientPubkey);
      try {
        // Try NIP-44 first (matches encryptBudgetKeyForPartner)
        if (user.signer.nip44) {
          return await user.signer.nip44.encrypt(recipientHex, data);
        }
        // Fall back to NIP-04
        if (user.signer.nip04) {
          return await user.signer.nip04.encrypt(recipientHex, data);
        }
      } catch (error) {
        // If NIP-44 fails, try NIP-04 as fallback
        try {
          if (user.signer.nip04) {
            return await user.signer.nip04.encrypt(recipientHex, data);
          }
        } catch (fallbackError) {
          console.error('[usePartnerInvites] All encryption methods failed:', fallbackError);
        }
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
   * Send a partner invite with the encrypted budget nsec AND full budget snapshot.
   * The snapshot is included so the partner gets all data immediately on accept —
   * no separate seeding step, no waiting for relay propagation.
   */
  const sendInvite = useCallback(
    async (
      toPubkey: string,
      budgetMonth: string,
      permission: 'view' | 'edit',
      encryptedBudgetKey: string,
      budgetNpub: string,
      fromName?: string,
      budgetSnapshot?: string, // JSON-stringified BudgetState
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
          snapshot: budgetSnapshot,
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
          budgetNpub.slice(0, 16) + '...',
          budgetSnapshot ? `(${Math.round(budgetSnapshot.length / 1024)}KB snapshot included)` : '(no snapshot)'
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

        // Mark as processed locally so it disappears from pending list
        markInviteProcessed(invite.id);

        return { success: true };
      } catch (error) {
        console.error('[usePartnerInvites] Failed to accept invite:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
    [user, publish, encryptForRecipient, markInviteProcessed]
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

        // Mark as processed AND declined so it permanently disappears
        markInviteProcessed(invite.id);
        markInviteDeclined(invite.id);

        return true;
      } catch (error) {
        console.error('[usePartnerInvites] Failed to decline invite:', error);
        return false;
      }
    },
    [user, publish, encryptForRecipient, markInviteProcessed, markInviteDeclined]
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
                snapshot: payload.snapshot, // Full budget state included in invite
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
    staleTime: 30000, // 30 seconds — data is fresh for 30s, then refetch on focus
    refetchOnWindowFocus: true,
  });

  // Real-time subscription: listen for new invite events via Nostr subscription
  // instead of polling every 30 seconds. Invalidates the query cache when a new
  // event arrives so TanStack Query refetches once.
  useEffect(() => {
    if (!user?.pubkey) return;

    let sub: { close?: () => void } | null = null;
    try {
      sub = nostr.req(
        [
          {
            kinds: [INVITE_KIND],
            '#p': [user.pubkey],
            '#t': ['sat-sorter-invite'],
            limit: 0, // Only new events — we already have historical via the query
          },
        ],
        {
          onevent: () => {
            // Invalidate the query so it refetches with the new event
            queryClient.invalidateQueries({ queryKey: ['partner-invites', user.pubkey] });
          },
        }
      );
    } catch {
      // Subscription failed — the polling fallback (refetchOnWindowFocus) still works
    }

    return () => {
      if (sub && typeof sub.close === 'function') {
        sub.close();
      }
    };
  }, [user?.pubkey, nostr, queryClient]);

  // SMART FILTER: Only hide processed invites if the budget keypair still
  // exists locally. If the keypair is missing (cleared browser data, new
  // device), re-show the invite as pending so the user can re-accept.
  // Also deduplicates by budgetNpub — only show the most recent invite
  // per budget (in case multiple invites were sent over time).
  const hasBudgetKeypair = !!(budgetState.budgetKeypair?.budgetNsec);
  const accessibleNpubs = new Set(
    (budgetState.accessibleBudgets || [])
      .filter(b => b.budgetNpub && b.budgetNsec)
      .map(b => b.budgetNpub)
  );

  const pendingInvites = receivedInvites.filter((i) => {
    // Must be status pending
    if (i.status !== 'pending') return false;

    // Permanently hide explicitly declined invites — never re-show them
    if (declinedInviteIds.includes(i.id)) return false;

    // If this invite was processed AND we still have the keypair for this
    // budget, skip it (already accepted)
    if (processedInviteIds.includes(i.id)) {
      // Check if we have the key for THIS specific budget
      if (i.budgetNpub && (budgetState.budgetKeypair?.budgetNpub === i.budgetNpub
        || accessibleNpubs.has(i.budgetNpub))) {
        return false; // Key exists, hide this invite
      }
      // Key is missing — re-show the invite so user can re-accept
    }

    // Deduplicate: only show the most recent invite per budgetNpub
    // (if multiple invites were sent over time, show only the latest)
    const isLatestForBudget = !receivedInvites.some(
      other => other.budgetNpub === i.budgetNpub && other.createdAt > i.createdAt
    );
    return isLatestForBudget;
  });

  return {
    sendInvite,
    acceptInvite,
    declineInvite,
    receivedInvites,
    pendingInvites,
    pendingInvitesCount: pendingInvites.length,
    isLoadingInvites,
    refetch,
    clearProcessedInvites: () => setProcessedInviteIds([]),
    clearDeclinedInvites: () => setDeclinedInviteIds([]),
  };
}
