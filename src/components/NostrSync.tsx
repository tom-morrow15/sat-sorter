import { useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { BudgetState } from '@/lib/budgetTypes';
import { useToast } from '@/hooks/useToast';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078;

/**
 * NostrSync - Syncs user's Nostr data
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - NIP-65 relay list (kind 10002)
 * - Budget data (kind 30078) - downloads from Nostr on login (one-time per session)
 * 
 * Budget saving is now explicit (user clicks "Save to Nostr" button).
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  
  // Access local budget state
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Sync relays from Nostr (existing functionality)
  useEffect(() => {
    if (!user) return;

    const syncRelaysFromNostr = async () => {
      try {
        const events = await nostr.query(
          [{ kinds: [10002], authors: [user.pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        if (events.length > 0) {
          const event = events[0];

          // Only update if the event is newer than our stored data
          if (event.created_at > config.relayMetadata.updatedAt) {
            const fetchedRelays = event.tags
              .filter(([name]) => name === 'r')
              .map(([_, url, marker]) => ({
                url,
                read: !marker || marker === 'read',
                write: !marker || marker === 'write',
              }));

            if (fetchedRelays.length > 0) {
              console.log('Syncing relay list from Nostr:', fetchedRelays);
              updateConfig((current) => ({
                ...current,
                relayMetadata: {
                  relays: fetchedRelays,
                  updatedAt: event.created_at,
                },
              }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync relays from Nostr:', error);
      }
    };

    syncRelaysFromNostr();
  }, [user, config.relayMetadata.updatedAt, nostr, updateConfig]);

  // Download budget from Nostr on login (one-time per session)
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44) return;

    let isMounted = true;
    let hasAttempted = false;

    const downloadBudgetFromNostr = async () => {
      // Only attempt once per user session
      if (hasAttempted) return;
      hasAttempted = true;

      try {
        console.log('[NostrSync] Checking for saved budget on Nostr...');
        
        const events = await nostr.query(
          [{
            kinds: [BUDGET_KIND],
            authors: [user.pubkey],
            '#d': [APP_IDENTIFIER],
            limit: 1,
          }],
          { signal: AbortSignal.timeout(10000) }
        );

        if (events.length === 0) {
          console.log('[NostrSync] No saved budget found on Nostr');
          return;
        }

        if (!isMounted) return;

        const latestEvent = events[0];
        
        try {
          const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
          const remoteBudget: BudgetState = JSON.parse(decrypted);

          // Preserve local month preference, use remote budget data
          setLocalBudget({
            ...remoteBudget,
            currentMonth: localBudget.currentMonth || remoteBudget.currentMonth,
          });
          
          console.log('[NostrSync] Budget downloaded from Nostr:', {
            budgets: remoteBudget.budgets.length,
            month: remoteBudget.currentMonth,
          });

          toast({
            title: 'Budget restored from cloud',
            description: `Loaded ${remoteBudget.budgets.length} month(s) of budget data.`,
          });
        } catch (decryptError) {
          console.error('[NostrSync] Failed to decrypt budget:', decryptError);
        }
      } catch (error) {
        console.error('[NostrSync] Failed to download budget:', error);
      }
    };

    downloadBudgetFromNostr();

    return () => {
      isMounted = false;
    };
  }, [user?.pubkey, user?.signer?.nip44, nostr, setLocalBudget, localBudget.currentMonth, toast]);

  return null;
}