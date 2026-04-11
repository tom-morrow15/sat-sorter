import { useEffect, useRef, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { BudgetState } from '@/lib/budgetTypes';
import { useToast } from '@/hooks/useToast';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078;

// Constants for conflict resolution
const CONFLICT_THRESHOLD_SECONDS = 300; // 5 minutes - if both edited within this window, it's a conflict

/**
 * NostrSync - Syncs user's Nostr data
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - NIP-65 relay list (kind 10002)
 * - Budget data (kind 30078) - automatic two-way sync with smart conflict resolution
 * 
 * Conflict Resolution Strategy:
 * 1. Compare timestamps of local last edit vs remote last edit
 * 2. If remote is significantly newer (>5 min), use remote
 * 3. If local is significantly newer, keep local and upload
 * 4. If within conflict window, show dialog asking user
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  const hasSyncedBudget = useRef(false);
  const initialLocalBudget = useRef<BudgetState | null>(null);
  const isUpdatingFromRemote = useRef(false);
  
  // Access local budget state for two-way sync
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Helper to count total items in budget for comparison
  const countBudgetItems = useCallback((budget: BudgetState): number => {
    let count = budget.budgets.length;
    budget.budgets.forEach(b => {
      count += b.buckets.length;
      b.buckets.forEach(bucket => {
        count += bucket.lineItems.length;
        count += budget.transactions?.length || 0;
      });
    });
    return count;
  }, []);

  // Helper to get the most recent edit time from local budget
  const getLocalEditTime = useCallback((budget: BudgetState): number => {
    // Use lastSynced if available, otherwise use the highest created_at from budgets
    if (budget.lastSynced) return budget.lastSynced;
    
    // Fallback: find most recent budget by ID (which contains timestamp)
    let latest = 0;
    budget.budgets.forEach(b => {
      const budgetTime = parseInt(b.id.split('-')[0]) / 1000;
      if (budgetTime > latest) latest = budgetTime;
    });
    return latest;
  }, []);

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

  // Store initial local budget when component mounts
  useEffect(() => {
    if (!initialLocalBudget.current && localBudget.budgets.length > 0) {
      initialLocalBudget.current = { ...localBudget };
    }
  }, [localBudget]);

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
            limit: 5, // Get multiple to find latest
          }],
          { signal: AbortSignal.timeout(10000) }
        );

        if (events.length === 0) {
          console.log('[NostrSync] No remote budget data found');
          hasSyncedBudget.current = true;
          // If we have local data and no remote, upload it
          if (localBudget.budgets.length > 0) {
            console.log('[NostrSync] Local data exists but no remote - will upload');
          }
          return;
        }

        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        const remoteTimestamp = latestEvent.created_at;
        const localTimestamp = getLocalEditTime(localBudget);
        const now = Math.floor(Date.now() / 1000);
        
        console.log('[NostrSync] Timestamps:', {
          remote: new Date(remoteTimestamp * 1000).toISOString(),
          local: new Date(localTimestamp * 1000).toISOString(),
          diff: remoteTimestamp - localTimestamp,
        });

        // Case 1: Remote is significantly newer (>5 min)
        if (remoteTimestamp > localTimestamp + CONFLICT_THRESHOLD_SECONDS) {
          console.log('[NostrSync] Remote is significantly newer, applying...');
          
          const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
          const remoteBudget: BudgetState = JSON.parse(decrypted);

          isUpdatingFromRemote.current = true;
          setLocalBudget({
            ...remoteBudget,
            currentMonth: localBudget.currentMonth || remoteBudget.currentMonth,
            lastSynced: remoteTimestamp,
          });
          
          toast({
            title: 'Budget synced from cloud',
            description: `Loaded ${remoteBudget.budgets.length} month(s) of budget data.`,
          });
        }
        // Case 2: Local is significantly newer (>5 min)
        else if (localTimestamp > remoteTimestamp + CONFLICT_THRESHOLD_SECONDS) {
          console.log('[NostrSync] Local is significantly newer, keeping local');
          // Local will be auto-uploaded by the upload effect
          toast({
            title: 'Using local budget',
            description: 'Your local changes are newer than the cloud version.',
          });
        }
        // Case 3: Within conflict window - check if data is actually different
        else if (Math.abs(remoteTimestamp - localTimestamp) < CONFLICT_THRESHOLD_SECONDS) {
          const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
          const remoteBudget: BudgetState = JSON.parse(decrypted);
          
          const localItems = countBudgetItems(localBudget);
          const remoteItems = countBudgetItems(remoteBudget);
          
          // If they're different, prefer the one with more data
          if (Math.abs(localItems - remoteItems) > 5) {
            if (remoteItems > localItems) {
              console.log('[NostrSync] Conflict resolved: Remote has more data');
              isUpdatingFromRemote.current = true;
              setLocalBudget({
                ...remoteBudget,
                currentMonth: localBudget.currentMonth || remoteBudget.currentMonth,
                lastSynced: remoteTimestamp,
              });
              toast({
                title: 'Budget synced',
                description: 'Cloud version had more complete data.',
              });
            } else {
              console.log('[NostrSync] Conflict resolved: Local has more data');
              toast({
                title: 'Keeping local budget',
                description: 'Your version has more complete data.',
              });
            }
          } else {
            console.log('[NostrSync] Edits within 5 min, keeping local');
            // Keep local (it will auto-upload if there are new changes)
          }
        }
        // Case 4: Timestamps are identical or very close
        else {
          console.log('[NostrSync] Budgets in sync');
        }

        hasSyncedBudget.current = true;
      } catch (error) {
        console.error('[NostrSync] Failed to sync budget:', error);
        hasSyncedBudget.current = true; // Don't retry
      }
    };

    syncBudgetFromNostr();
  }, [user, nostr, localBudget, setLocalBudget, toast, getLocalEditTime, countBudgetItems]);

  // Auto-upload budget to Nostr when it changes (debounced)
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44) return;

    // Skip if we haven't finished initial sync yet
    if (!hasSyncedBudget.current) return;
    
    // Skip if this update came from remote
    if (isUpdatingFromRemote.current) {
      isUpdatingFromRemote.current = false;
      return;
    }

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
    initialLocalBudget.current = null;
  }, [user?.pubkey]);

  return null;
}