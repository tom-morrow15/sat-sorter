import { useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetPartner } from '@/lib/budgetTypes';

const PARTNERS_KIND = 30078; // NIP-78 app-specific data
const PARTNERS_IDENTIFIER = 'sat-sorter/partners';

interface PartnersListContent {
  partners: BudgetPartner[];
  updatedAt: number;
}

/**
 * usePartners - Nostr-native partner management
 * 
 * Uses a NIP-78 replaceable event (kind 30078) with d-tag "sat-sorter/partners"
 * to store the list of budget partners on Nostr relays. This provides:
 * - Cross-device sync
 * - Persistence via relays
 * - Immediate availability (no localStorage instance issues)
 * - Multi-tab synchronization
 */
export function usePartners() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  // Query partners from Nostr
  const {
    data: partners = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['partners', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query(
        [
          {
            kinds: [PARTNERS_KIND],
            authors: [user.pubkey],
            '#d': [PARTNERS_IDENTIFIER],
            limit: 1,
          },
        ],
        { signal }
      );

      if (events.length === 0) {
        console.log('[usePartners] No partners event found on relays');
        return [];
      }

      // Get the latest event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      try {
        // Try to decrypt if NIP-44 is available (content is encrypted)
        let contentStr = latestEvent.content;
        if (user.signer.nip44 && contentStr.length > 0) {
          try {
            contentStr = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
          } catch {
            // If decryption fails, try as plain JSON (backwards compat)
            console.log('[usePartners] Could not decrypt, trying plain JSON');
          }
        }

        const data: PartnersListContent = JSON.parse(contentStr);
        console.log('[usePartners] Loaded partners from Nostr:', data.partners.length);
        return data.partners || [];
      } catch (error) {
        console.error('[usePartners] Failed to parse partners event:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Save partners list to Nostr
  const savePartnersList = useCallback(
    async (newPartners: BudgetPartner[]) => {
      if (!user?.pubkey) {
        throw new Error('Must be logged in to manage partners');
      }

      const contentData: PartnersListContent = {
        partners: newPartners,
        updatedAt: Math.floor(Date.now() / 1000),
      };

      let content = JSON.stringify(contentData);

      // Encrypt with NIP-44 if available (self-encryption for privacy)
      if (user.signer.nip44) {
        content = await user.signer.nip44.encrypt(user.pubkey, content);
      }

      await publish({
        kind: PARTNERS_KIND,
        content,
        tags: [
          ['d', PARTNERS_IDENTIFIER],
          ['alt', 'Sat Sorter budget partners list'],
        ],
      });

      // Optimistically update the cache so UI updates immediately
      queryClient.setQueryData(['partners', user.pubkey], newPartners);
      
      // Refetch to confirm
      setTimeout(() => refetch(), 500);
    },
    [user, publish, queryClient, refetch]
  );

  // Add a partner
  const addPartner = useCallback(
    async (pubkey: string, permission: 'view' | 'edit') => {
      console.log('[usePartners] Adding partner:', pubkey);
      
      // Check for duplicates
      if (partners.some((p) => p.pubkey === pubkey)) {
        console.log('[usePartners] Partner already exists');
        throw new Error('Partner already exists');
      }

      const newPartner: BudgetPartner = {
        pubkey,
        permission,
        addedAt: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      const updatedPartners = [...partners, newPartner];
      await savePartnersList(updatedPartners);
      console.log('[usePartners] Partner added successfully');
    },
    [partners, savePartnersList]
  );

  // Remove a partner
  const removePartner = useCallback(
    async (pubkey: string) => {
      console.log('[usePartners] Removing partner:', pubkey);
      const updatedPartners = partners.filter((p) => p.pubkey !== pubkey);
      await savePartnersList(updatedPartners);
    },
    [partners, savePartnersList]
  );

  // Change permission
  const changePartnerPermission = useCallback(
    async (pubkey: string, permission: 'view' | 'edit') => {
      console.log('[usePartners] Changing permission for:', pubkey, 'to:', permission);
      const updatedPartners = partners.map((p) =>
        p.pubkey === pubkey ? { ...p, permission } : p
      );
      await savePartnersList(updatedPartners);
    },
    [partners, savePartnersList]
  );

  // Update a partner's status (e.g. when they accept the invite)
  const updatePartnerStatus = useCallback(
    async (pubkey: string, status: 'pending' | 'accepted' | 'declined') => {
      console.log('[usePartners] Updating status for:', pubkey, 'to:', status);
      const existing = partners.find((p) => p.pubkey === pubkey);
      if (!existing) {
        console.log('[usePartners] Partner not found for status update');
        return;
      }
      if (existing.status === status) {
        // No change needed
        return;
      }
      const updatedPartners = partners.map((p) =>
        p.pubkey === pubkey
          ? {
              ...p,
              status,
              acceptedAt: status === 'accepted' ? Math.floor(Date.now() / 1000) : p.acceptedAt,
            }
          : p
      );
      await savePartnersList(updatedPartners);
    },
    [partners, savePartnersList]
  );

  return {
    partners,
    isLoading,
    addPartner,
    removePartner,
    changePartnerPermission,
    updatePartnerStatus,
    refetch,
  };
}
