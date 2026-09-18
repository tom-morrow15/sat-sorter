import { useEffect, useRef, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createEncryptedSerializer, decryptValue } from '@/lib/secureStorage';
import { SAFE_DEFAULT_BUDGET_STATE } from '@/lib/budgetTypes';
import type { BudgetState, MonthlyBudget } from '@/lib/budgetTypes';
import type { WealthTrackerState } from '@/lib/wealthTypes';
import { mergeWealthStates } from '@/lib/wealthTypes';
import { useToast } from '@/hooks/useToast';
import { fetchFullBudgetFromNostr } from '@/hooks/useBudgetSync';

// Wealth tracker — same NIP-78 kind, different d-tag so the two datasets
// live side-by-side as separate addressable events.
const WEALTH_APP_IDENTIFIER = 'sat-sorter/wealth-data';
const WEALTH_KIND = 30078;
const WEALTH_STORAGE_KEY = 'sat-sorter-wealth-tracker';

const EMPTY_WEALTH_STATE: WealthTrackerState = {
  watchedAddresses: [],
  balanceHistory: [],
};

// Key used by the Save button to track "last saved state" so the save button
// can correctly indicate whether there are unsaved changes. After a successful
// remote download we want to mark the downloaded state as "already saved" so
// the user doesn't see a red save indicator and accidentally overwrite the
// remote (which in turn could wipe data on other devices).
const SAVED_BUDGET_KEY = 'sat-sorter-saved-budget';

/**
 * Merge local and remote budget states without losing data.
 *
 * Rules:
 * - For each month, pick the version that has the most data (buckets + line
 *   items + transactions). Remote is preferred on ties because that's where
 *   the user explicitly saved.
 * - Union months — never drop any month from either side.
 * - Templates and partners: union by id/pubkey.
 * - currentMonth: prefer the remote's currentMonth if it exists in the merged
 *   budgets, otherwise keep local's currentMonth.
 */
function mergeBudgetStates(local: BudgetState, remote: BudgetState): BudgetState {
  const scoreBudget = (b: MonthlyBudget): number => {
    const lineItemCount = b.buckets.reduce((sum, bucket) => sum + bucket.lineItems.length, 0);
    const plannedSum = b.buckets.reduce(
      (sum, bucket) =>
        sum +
        bucket.lineItems.reduce(
          (s, li) => s + (li.plannedAmount || 0) + (li.plannedAmountUsd || 0),
          0
        ),
      0
    );
    // Weight: transactions are most important (user activity), then line items,
    // then planned amounts. This makes sure a month with real data always wins
    // over a month that only has empty default buckets.
    return (
      b.transactions.length * 1000 +
      lineItemCount * 10 +
      (plannedSum > 0 ? 5 : 0) +
      b.buckets.length
    );
  };

  const byMonth = new Map<string, MonthlyBudget>();

  // Start with local
  for (const b of local.budgets) {
    byMonth.set(b.month, b);
  }

  // Merge remote — keep whichever has more data for that month
  for (const remoteBudget of remote.budgets) {
    const existing = byMonth.get(remoteBudget.month);
    if (!existing) {
      byMonth.set(remoteBudget.month, remoteBudget);
    } else {
      const remoteScore = scoreBudget(remoteBudget);
      const localScore = scoreBudget(existing);
      // Prefer remote on ties (user explicitly saved to cloud)
      byMonth.set(remoteBudget.month, remoteScore >= localScore ? remoteBudget : existing);
    }
  }

  const mergedBudgets = Array.from(byMonth.values());

  // Choose currentMonth: prefer remote's if that month exists in merged data
  const remoteMonthHasData = mergedBudgets.some(b => b.month === remote.currentMonth);
  const localMonthHasData = mergedBudgets.some(b => b.month === local.currentMonth);
  let currentMonth: string;
  if (remoteMonthHasData) {
    currentMonth = remote.currentMonth;
  } else if (localMonthHasData) {
    currentMonth = local.currentMonth;
  } else {
    currentMonth = remote.currentMonth || local.currentMonth;
  }

  // Union templates by id
  const templatesMap = new Map<string, NonNullable<BudgetState['templates']>[number]>();
  for (const t of local.templates || []) templatesMap.set(t.id, t);
  for (const t of remote.templates || []) {
    const existing = templatesMap.get(t.id);
    if (!existing || (t.updatedAt || 0) >= (existing.updatedAt || 0)) {
      templatesMap.set(t.id, t);
    }
  }

  // Union partners by pubkey (prefer remote for up-to-date status)
  const partnersMap = new Map<string, NonNullable<BudgetState['partners']>[number]>();
  for (const p of local.partners || []) partnersMap.set(p.pubkey, p);
  for (const p of remote.partners || []) partnersMap.set(p.pubkey, p);

  // Union payment methods (deduped)
  const paymentMethodsSet = new Set<string>([
    ...(local.paymentMethods || []),
    ...(remote.paymentMethods || []),
  ]);

  return {
    currentMonth,
    currency: remote.currency || local.currency || 'sats',
    budgets: mergedBudgets,
    templates: Array.from(templatesMap.values()),
    partners: Array.from(partnersMap.values()),
    userRole: remote.userRole || local.userRole,
    defaultTemplateId: remote.defaultTemplateId || local.defaultTemplateId,
    paymentMethods: Array.from(paymentMethodsSet),
    lastSynced: Math.floor(Date.now() / 1000),
    // CRITICAL: preserve the shared budget keypair and accessible budgets from
    // local state. The remote personal budget won't have these — they're only
    // set locally when the user accepts a partner invite. Without this, the
    // merge would strip the keypair and break the shared budget sync.
    budgetKeypair: local.budgetKeypair,
    accessibleBudgets: local.accessibleBudgets || [],
  };
}

/**
 * NostrSync - Syncs user's Nostr data on login
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - NIP-65 relay list (kind 10002)
 * - Budget data (kind 30078) - downloads from Nostr on login and merges with
 *   any local data so we never lose information.
 *
 * Budget saving is explicit (user clicks "Save to Nostr" button). After a
 * successful download we prime the Save button's "last saved" tracker so the
 * user doesn't see spurious unsaved-change indicators (which could lead them
 * to re-upload and overwrite data on another device).
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();

  // Access local budget state — use the same safe default as the main provider
  // so we never get a partial object that is missing accessibleBudgets etc.
  // Use encrypted serializer to match BudgetProvider's storage format.
  const budgetSerializer = useMemo(() => createEncryptedSerializer<BudgetState>(), []);
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', SAFE_DEFAULT_BUDGET_STATE, budgetSerializer);

  // Access local wealth tracker state (same storage key as useWealthTracker).
  const wealthSerializer = useMemo(() => createEncryptedSerializer<WealthTrackerState>(), []);
  const [, setLocalWealth] = useLocalStorage<WealthTrackerState>(
    WEALTH_STORAGE_KEY,
    EMPTY_WEALTH_STATE,
    wealthSerializer,
  );

  // Track which pubkeys we've already attempted to sync for in this session
  // so we don't re-download on every re-render / re-login.
  const syncedPubkeys = useRef<Set<string>>(new Set());
  const syncedWealthPubkeys = useRef<Set<string>>(new Set());

  // Also store the save-button tracker so we can prime it after download.
  const savedBudgetSerializer = useMemo(() => createEncryptedSerializer<string>(), []);
  const [, setSavedBudgetStr] = useLocalStorage<string>(SAVED_BUDGET_KEY, '', savedBudgetSerializer);

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
              updateConfig((current) => {
                // Merge instead of overwrite: private relays (e.g. self-hosted
                // relays that are never published in NIP-65) must survive every
                // sync, and locally-added relays not yet in the published list
                // are preserved too.
                const fetchedUrls = new Set(fetchedRelays.map(r => r.url));
                const preserved = (current.relayMetadata?.relays ?? []).filter(
                  r => r.private || !fetchedUrls.has(r.url)
                );
                return {
                  ...current,
                  relayMetadata: {
                    relays: [...fetchedRelays, ...preserved],
                    updatedAt: event.created_at,
                  },
                };
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync relays from Nostr:', error);
      }
    };

    syncRelaysFromNostr();
  }, [user, config.relayMetadata.updatedAt, nostr, updateConfig]);

  // Download budget from Nostr on login (one-time per user session)
  // Merges remote with local so we NEVER accidentally drop data.
  //
  // Supports the new split storage format (manifest + per-month events) and
  // falls back to the legacy single-blob format for existing users.
  useEffect(() => {
    console.log('[NostrSync] budget download effect fired', {
      hasPubkey: !!user?.pubkey,
      hasNip44: !!user?.signer?.nip44,
      alreadySynced: syncedPubkeys.current.has(user?.pubkey ?? ''),
    });
    if (!user?.pubkey || !user?.signer?.nip44) return;

    const pubkey = user.pubkey;
    // Only sync once per pubkey per session
    if (syncedPubkeys.current.has(pubkey)) return;
    syncedPubkeys.current.add(pubkey);

    let isMounted = true;

    const downloadBudgetFromNostr = async () => {
      try {
        console.log('[NostrSync] Checking for saved budget on Nostr...');

        // Use the shared helper that understands both the new split format
        // (one manifest + one tiny event per month) and the old full-blob format.
        const result = await fetchFullBudgetFromNostr(nostr, user);

        if (!isMounted) return;

        if (!result || !result.data) {
          console.log('[NostrSync] No saved budget found on Nostr');
          return;
        }

        const remoteBudget: BudgetState = result.data;

        if (!remoteBudget.budgets || !Array.isArray(remoteBudget.budgets)) {
          console.warn('[NostrSync] Remote budget missing budgets array, skipping');
          return;
        }

        // Safety guard: if remote has no data, don't do anything
        if (remoteBudget.budgets.length === 0) {
          console.log('[NostrSync] Remote budget is empty, nothing to sync');
          return;
        }

        // Read the latest local state directly from localStorage to avoid
        // any stale-closure issues from the initial render.
        // Decrypt using the device key (data is now encrypted at rest).
        let freshLocal: BudgetState = localBudget;
        try {
          const raw = localStorage.getItem('sat-sorter-budget');
          if (raw) {
            const decrypted = decryptValue(raw);
            freshLocal = JSON.parse(decrypted);
          }
        } catch {
          // fall through with closure value
        }

        const merged = mergeBudgetStates(freshLocal, remoteBudget);

        // Sanity check: the merge should never reduce the number of budgets
        // below what we already had locally or what's on the remote.
        const maxIncoming = Math.max(freshLocal.budgets.length, remoteBudget.budgets.length);
        if (merged.budgets.length < maxIncoming) {
          console.error(
            '[NostrSync] Merge produced fewer months than expected, aborting to protect data',
            { local: freshLocal.budgets.length, remote: remoteBudget.budgets.length, merged: merged.budgets.length }
          );
          return;
        }

        setLocalBudget(merged);

        // Prime the Save button's saved-state tracker so it doesn't flag the
        // newly-downloaded budget as "unsaved". This prevents the scenario
        // where a user clicks Save after login and re-uploads a potentially
        // incomplete state.
        const trackerStr = JSON.stringify({
          budgets: merged.budgets,
          currency: merged.currency,
          currentMonth: merged.currentMonth,
          partners: merged.partners || [],
          templates: merged.templates || [],
        });
        setSavedBudgetStr(trackerStr);

        console.log('[NostrSync] Budget merged from Nostr:', {
          localBudgets: freshLocal.budgets.length,
          remoteBudgets: remoteBudget.budgets.length,
          mergedBudgets: merged.budgets.length,
          currentMonth: merged.currentMonth,
        });

        // Only toast if remote actually added data the user didn't already have
        const addedMonths = merged.budgets.length - freshLocal.budgets.length;
        if (freshLocal.budgets.length === 0) {
          toast({
            title: 'Budget synced from cloud',
            description: `Your saved budget has been restored (${remoteBudget.budgets.length} month${remoteBudget.budgets.length === 1 ? '' : 's'}).`,
          });
        } else if (addedMonths > 0) {
          toast({
            title: 'Budget synced from cloud',
            description: `${addedMonths} additional month${addedMonths === 1 ? '' : 's'} restored from Nostr.`,
          });
        }
      } catch (error) {
        console.error('[NostrSync] Failed to download budget:', error);
        // Remove from synced set so we can retry on next mount
        syncedPubkeys.current.delete(pubkey);
      }
    };

    downloadBudgetFromNostr();

    return () => {
      isMounted = false;
    };
    // We intentionally exclude localBudget from deps — this effect must only
    // run once per user session (we guard with syncedPubkeys). Including
    // localBudget would cause re-runs on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey]);

  // Download wealth tracker data from Nostr on login (once per session) and
  // merge it with whatever is in local storage. Same pattern as budget sync.
  useEffect(() => {
    if (!user?.pubkey || !user?.signer?.nip44) return;

    const pubkey = user.pubkey;
    if (syncedWealthPubkeys.current.has(pubkey)) return;
    syncedWealthPubkeys.current.add(pubkey);

    let isMounted = true;

    const downloadWealthFromNostr = async () => {
      try {
        console.log('[NostrSync] Checking for saved wealth tracker on Nostr...');

        const events = await nostr.query(
          [{
            kinds: [WEALTH_KIND],
            authors: [pubkey],
            '#d': [WEALTH_APP_IDENTIFIER],
            limit: 1,
          }],
          { signal: AbortSignal.timeout(10000) }
        );

        if (!isMounted) return;

        if (events.length === 0) {
          console.log('[NostrSync] No saved wealth data found on Nostr');
          return;
        }

        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

        let decrypted: string;
        try {
          decrypted = await user.signer.nip44!.decrypt(pubkey, latestEvent.content);
        } catch (decryptError) {
          console.error('[NostrSync] Failed to decrypt wealth data:', decryptError);
          return;
        }

        let remoteWealth: WealthTrackerState;
        try {
          const parsed = JSON.parse(decrypted);
          if (
            !parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray(parsed.watchedAddresses)
          ) {
            console.warn('[NostrSync] Unknown remote wealth shape, skipping');
            return;
          }
          remoteWealth = {
            watchedAddresses: parsed.watchedAddresses,
            balanceHistory: Array.isArray(parsed.balanceHistory) ? parsed.balanceHistory : [],
            lastSyncTime: typeof parsed.lastSyncTime === 'number' ? parsed.lastSyncTime : undefined,
          };
        } catch (parseError) {
          console.error('[NostrSync] Failed to parse wealth data:', parseError);
          return;
        }

        if (!isMounted) return;

        if (remoteWealth.watchedAddresses.length === 0) {
          console.log('[NostrSync] Remote wealth data is empty, nothing to sync');
          return;
        }

        // Pull fresh local state directly from localStorage to avoid
        // closure-staleness issues from the initial render.
        // Decrypt using the device key (data is now encrypted at rest).
        let freshLocal: WealthTrackerState = EMPTY_WEALTH_STATE;
        try {
          const raw = localStorage.getItem(WEALTH_STORAGE_KEY);
          if (raw) {
            const decrypted = decryptValue(raw);
            const parsedLocal = JSON.parse(decrypted);
            if (parsedLocal && Array.isArray(parsedLocal.watchedAddresses)) {
              freshLocal = {
                watchedAddresses: parsedLocal.watchedAddresses,
                balanceHistory: Array.isArray(parsedLocal.balanceHistory)
                  ? parsedLocal.balanceHistory
                  : [],
                lastSyncTime:
                  typeof parsedLocal.lastSyncTime === 'number'
                    ? parsedLocal.lastSyncTime
                    : undefined,
              };
            }
          }
        } catch {
          // fall through with empty local state
        }

        const merged = mergeWealthStates(freshLocal, remoteWealth);

        // Sanity check: never drop addresses during merge.
        const maxIncomingAddrs = Math.max(
          freshLocal.watchedAddresses.length,
          remoteWealth.watchedAddresses.length
        );
        if (merged.watchedAddresses.length < maxIncomingAddrs) {
          console.error(
            '[NostrSync] Wealth merge produced fewer addresses than expected, aborting',
            {
              local: freshLocal.watchedAddresses.length,
              remote: remoteWealth.watchedAddresses.length,
              merged: merged.watchedAddresses.length,
            }
          );
          return;
        }

        setLocalWealth(merged);

        console.log('[NostrSync] Wealth data merged from Nostr:', {
          localAddrs: freshLocal.watchedAddresses.length,
          remoteAddrs: remoteWealth.watchedAddresses.length,
          mergedAddrs: merged.watchedAddresses.length,
          mergedSnapshots: merged.balanceHistory.length,
        });

        // Only toast if remote actually restored something the user was missing.
        const restoredAddrs =
          merged.watchedAddresses.length - freshLocal.watchedAddresses.length;
        if (freshLocal.watchedAddresses.length === 0) {
          toast({
            title: 'Wealth data synced',
            description: `Restored ${remoteWealth.watchedAddresses.length} watched address${
              remoteWealth.watchedAddresses.length === 1 ? '' : 'es'
            } from the cloud.`,
          });
        } else if (restoredAddrs > 0) {
          toast({
            title: 'Wealth data synced',
            description: `${restoredAddrs} additional address${
              restoredAddrs === 1 ? '' : 'es'
            } restored from Nostr.`,
          });
        }
      } catch (error) {
        console.error('[NostrSync] Failed to download wealth data:', error);
        syncedWealthPubkeys.current.delete(pubkey);
      }
    };

    downloadWealthFromNostr();

    return () => {
      isMounted = false;
    };
    // Same reasoning as the budget sync effect — run once per user session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.pubkey]);

  return null;
}
