import { useEffect, useRef } from 'react';
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
 * - Budget data (kind 30078) - automatic two-way sync
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  const hasSyncedBudget = useRef(false);
  
  // Access local budget state for two-way sync
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

  // Auto-sync budget data from Nostr on login (only once per session)
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44 || hasSyncedBudget.current) return;

    const syncBudgetFromNostr = async () => {
      try {
        console.log('[NostrSync] Checking for remote budget data...');
        
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
          console.log('[NostrSync] No remote budget data found');
          hasSyncedBudget.current = true;
          return;
        }

        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        
        // Check if remote data is newer than local
        const localTimestamp = localBudget.lastSynced || 0;
        
        if (latestEvent.created_at <= localTimestamp) {
          console.log('[NostrSync] Local data is up to date');
          hasSyncedBudget.current = true;
          return;
        }

        // Decrypt and apply remote data
        const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
        const remoteBudget: BudgetState = JSON.parse(decrypted);

        // Merge strategy: Use remote data (it's newer), but preserve current month preference
        const mergedBudget: BudgetState = {
          ...remoteBudget,
          currentMonth: localBudget.currentMonth || remoteBudget.currentMonth,
          lastSynced: latestEvent.created_at,
        };

        setLocalBudget(mergedBudget);
        hasSyncedBudget.current = true;
        
        console.log('[NostrSync] Budget synced from Nostr:', {
          budgets: remoteBudget.budgets.length,
          month: remoteBudget.currentMonth,
          timestamp: latestEvent.created_at,
        });

        // Only show toast if we actually updated data
        if (remoteBudget.budgets.length > 0) {
          toast({
            title: 'Budget synced from cloud',
            description: `Loaded ${remoteBudget.budgets.length} month(s) of budget data.`,
          });
        }
      } catch (error) {
        console.error('[NostrSync] Failed to sync budget:', error);
        hasSyncedBudget.current = true; // Don't retry
      }
    };

    syncBudgetFromNostr();
  }, [user, nostr, localBudget.currentMonth, localBudget.lastSynced, setLocalBudget, toast]);

  // Auto-upload budget to Nostr when it changes (debounced)
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44) return;

    // Skip if we haven't finished initial sync yet
    if (!hasSyncedBudget.current) return;

    const uploadTimeout = setTimeout(async () => {
      try {
        const encrypted = await user.signer!.nip44!.encrypt(
          user.pubkey,
          JSON.stringify({
            ...localBudget,
            lastSynced: Math.floor(Date.now() / 1000),
          })
        );

        await nostr.event({
          kind: BUDGET_KIND,
          content: encrypted,
          tags: [
            ['d', APP_IDENTIFIER],
            ['alt', 'Sat Sorter budget data (encrypted)'],
          ],
        });

        console.log('[NostrSync] Budget auto-uploaded to Nostr');
      } catch (error) {
        console.error('[NostrSync] Failed to auto-upload budget:', error);
      }
    }, 5000); // 5 second debounce

    return () => clearTimeout(uploadTimeout);
  }, [localBudget, user, nostr]);

  // Reset sync flag when user changes
  useEffect(() => {
    hasSyncedBudget.current = false;
  }, [user?.pubkey]);

  return null;
}