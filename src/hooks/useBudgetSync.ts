import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetState, MonthlyBudget } from '@/lib/budgetTypes';

const APP_IDENTIFIER = 'sat-sorter/budget-data';
const BUDGET_KIND = 30078; // NIP-78 Application-specific data (addressable / parameterized replaceable)

// New split format uses one small manifest + one tiny event per month.
// Per-month d-tags are derived as: sat-sorter/budget-data/2026-06
const MONTH_DTAG_PREFIX = 'sat-sorter/budget-data/';

// Shape stored (encrypted) in the main manifest event.
interface BudgetManifestV2 {
  version: 2;
  currentMonth: string;
  currency: 'sats' | 'usd';
  months: string[];           // list of YYYY-MM that have per-month events
  partners?: any[];
  templates?: any[];
  paymentMethods?: string[];
  userRole?: string;
  defaultTemplateId?: string;
  receivedInvites?: any[];
}

interface SyncStatus {
  lastSynced: number | null;
  isSyncing: boolean;
  error: string | null;
}

// Helper: fetch + decrypt a single event by exact filter (for manifest or a specific month)
async function fetchAndDecryptEvent(
  nostr: any,
  user: any,
  filter: any,
  timeoutMs = 8000
): Promise<any | null> {
  try {
    const events = await nostr.query([filter], { signal: AbortSignal.timeout(timeoutMs) });
    if (!events.length) return null;
    const ev = events.sort((a: any, b: any) => b.created_at - a.created_at)[0];
    if (!user?.signer?.nip44) return null;
    const decrypted = await user.signer.nip44.decrypt(user.pubkey, ev.content);
    return { event: ev, data: JSON.parse(decrypted) };
  } catch (e) {
    console.warn('[budgetNostr] fetchAndDecryptEvent failed for filter', filter, e);
    return null;
  }
}

// Reconstruct a full BudgetState from the new split storage format (manifest + per-month events).
// Also handles legacy single-blob events gracefully.
export async function fetchFullBudgetFromNostr(
  nostr: any,
  user: any
): Promise<{ data: BudgetState; timestamp: number } | null> {
  if (!user?.pubkey || !user?.signer?.nip44) return null;

  // 1. Try the manifest (new format)
  const manifestResult = await fetchAndDecryptEvent(nostr, user, {
    kinds: [BUDGET_KIND],
    authors: [user.pubkey],
    '#d': [APP_IDENTIFIER],
    limit: 1,
  });

  if (manifestResult?.data && typeof manifestResult.data === 'object' && manifestResult.data.version === 2) {
    const manifest = manifestResult.data as BudgetManifestV2;
    console.log('[budgetNostr] Found manifest v2 with months:', manifest.months?.length || 0);

    const budgets: MonthlyBudget[] = [];

    // Fetch each month's data (in parallel but with reasonable concurrency)
    const monthPromises = (manifest.months || []).map(async (month: string) => {
      const dtag = `${MONTH_DTAG_PREFIX}${month}`;
      const monthRes = await fetchAndDecryptEvent(nostr, user, {
        kinds: [BUDGET_KIND],
        authors: [user.pubkey],
        '#d': [dtag],
        limit: 1,
      });
      if (monthRes?.data && typeof monthRes.data === 'object' && monthRes.data.month === month) {
        return monthRes.data as MonthlyBudget;
      }
      return null;
    });

    const monthResults = await Promise.all(monthPromises);
    for (const m of monthResults) {
      if (m) budgets.push(m);
    }

    const assembled: BudgetState = {
      currentMonth: manifest.currentMonth || (budgets[0]?.month ?? ''),
      currency: manifest.currency || 'sats',
      budgets: budgets.sort((a, b) => a.month.localeCompare(b.month)),
      partners: manifest.partners || [],
      templates: manifest.templates || [],
      paymentMethods: manifest.paymentMethods || [],
      userRole: (manifest.userRole as any) || 'owner',
      defaultTemplateId: manifest.defaultTemplateId,
      receivedInvites: manifest.receivedInvites || [],
      lastSynced: Math.floor(Date.now() / 1000),
    };

    return {
      data: assembled,
      timestamp: manifestResult.event.created_at,
    };
  }

  // 2. Legacy single-blob fallback (the old full-state-in-one-event format)
  if (manifestResult?.data && typeof manifestResult.data === 'object') {
    const parsed = manifestResult.data;

    let budgetData: BudgetState | null = null;

    if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data && 'budgets' in parsed.data) {
      budgetData = parsed.data as BudgetState;
    } else if (parsed && typeof parsed === 'object' && 'budgets' in parsed) {
      budgetData = parsed as BudgetState;
    }

    if (budgetData && Array.isArray(budgetData.budgets)) {
      console.log('[budgetNostr] Using legacy single-blob budget (pre-split format)');
      return {
        data: {
          ...budgetData,
          lastSynced: Math.floor(Date.now() / 1000),
        },
        timestamp: manifestResult.event.created_at,
      };
    }
  }

  // Nothing found
  return null;
}

export function useBudgetSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSynced: null,
    isSyncing: false,
    error: null,
  });

  // Remote budget (used by Backup dialog for "last synced" status, etc.)
  // This query now supports both the new split format and the legacy single-blob.
  const { data: remoteBudget, isLoading: isLoadingRemote, refetch } = useQuery({
    queryKey: ['budget-sync', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return null;

      // We still do a quick manifest probe here for the status UI.
      // The heavy lifting for a full download is in downloadBudget() and fetchFullBudgetFromNostr.
      const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const events = await nostr.query(
        [
          {
            kinds: [BUDGET_KIND],
            authors: [user.pubkey],
            '#d': [APP_IDENTIFIER],
            limit: 1,
          },
        ],
        { signal: combinedSignal }
      );

      if (events.length === 0) return null;

      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      // For the "remoteBudget" status we try to return a lightweight view.
      // If it's the new manifest we still want to report "has data".
      try {
        if (!user.signer.nip44) return null;

        const decrypted = await user.signer.nip44.decrypt(user.pubkey, latestEvent.content);
        const parsed = JSON.parse(decrypted);

        // New split manifest
        if (parsed && typeof parsed === 'object' && parsed.version === 2 && Array.isArray(parsed.months)) {
          // We don't assemble the full state here (to keep the status query cheap).
          // The Backup dialog only needs to know "something exists" + timestamp.
          // We return a minimal shape that the dialog tolerates.
          return {
            data: {
              currentMonth: parsed.currentMonth,
              budgets: parsed.months.map((m: string) => ({ month: m, buckets: [], transactions: [] })), // stub for count
              currency: parsed.currency || 'sats',
            } as BudgetState,
            timestamp: latestEvent.created_at,
          };
        }

        // Legacy full blob
        if (parsed && typeof parsed === 'object' && 'budgets' in parsed) {
          return {
            data: parsed as BudgetState,
            timestamp: latestEvent.created_at,
          };
        }
        if (parsed && typeof parsed === 'object' && parsed.data && 'budgets' in parsed.data) {
          return {
            data: parsed.data as BudgetState,
            timestamp: latestEvent.created_at,
          };
        }
      } catch (e) {
        console.warn('[useBudgetSync] Could not parse remote manifest for status:', e);
      }

      return null;
    },
    enabled: !!user?.pubkey && !!user?.signer?.nip44,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Upload (now uses the split format: one manifest + one small event per month)
  const uploadBudget = useCallback(async (
    budgetState: BudgetState,
    options: { allowEmpty?: boolean; skipRemoteCheck?: boolean } = {}
  ): Promise<boolean> => {
    if (!user?.pubkey || !user?.signer?.nip44) {
      setSyncStatus(prev => ({ ...prev, error: 'Not logged in or signer unavailable' }));
      return false;
    }

    const months = (budgetState.budgets || []).map(b => b);
    if (!options.allowEmpty && months.length === 0) {
      console.warn('[useBudgetSync] Refusing to upload empty budget state');
      setSyncStatus(prev => ({
        ...prev,
        error: 'Refusing to upload an empty budget — this would wipe your saved data on other devices. Use Backup dialog to force-sync if intentional.',
      }));
      return false;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      // 1. Publish one small encrypted event per month
      for (const monthBudget of months) {
        const dtag = `${MONTH_DTAG_PREFIX}${monthBudget.month}`;
        const encryptedMonth = await user.signer.nip44.encrypt(
          user.pubkey,
          JSON.stringify(monthBudget)
        );

        await publish({
          kind: BUDGET_KIND,
          content: encryptedMonth,
          tags: [
            ['d', dtag],
            ['alt', `Sat Sorter budget month ${monthBudget.month} (encrypted)`],
          ],
        });
      }

      // 2. Publish the small manifest (global metadata + list of months)
      const manifest: BudgetManifestV2 = {
        version: 2,
        currentMonth: budgetState.currentMonth,
        currency: budgetState.currency,
        months: months.map(m => m.month),
        partners: budgetState.partners || [],
        templates: budgetState.templates || [],
        paymentMethods: budgetState.paymentMethods || [],
        userRole: budgetState.userRole,
        defaultTemplateId: budgetState.defaultTemplateId,
        receivedInvites: budgetState.receivedInvites || [],
      };

      const encryptedManifest = await user.signer.nip44.encrypt(
        user.pubkey,
        JSON.stringify(manifest)
      );

      await publish({
        kind: BUDGET_KIND,
        content: encryptedManifest,
        tags: [
          ['d', APP_IDENTIFIER],
          ['alt', 'Sat Sorter budget data manifest (encrypted)'],
        ],
      });

      const now = Math.floor(Date.now() / 1000);
      setSyncStatus({
        lastSynced: now,
        isSyncing: false,
        error: null,
      });

      queryClient.invalidateQueries({ queryKey: ['budget-sync', user.pubkey] });

      console.log('[useBudgetSync] Uploaded split budget:', {
        months: manifest.months.length,
        currentMonth: manifest.currentMonth,
      });

      return true;
    } catch (e) {
      console.error('Failed to upload budget (split format):', e);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to sync',
      }));
      return false;
    }
  }, [user, publish, queryClient, nostr]);

  // Full download that returns a complete BudgetState (used by Save button flows and NostrSync)
  const downloadBudget = useCallback(async (): Promise<BudgetState | null> => {
    if (!user?.pubkey) return null;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await fetchFullBudgetFromNostr(nostr, user);

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: result?.timestamp || prev.lastSynced,
      }));

      return result?.data || null;
    } catch (e) {
      console.error('Failed to download budget:', e);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: e instanceof Error ? e.message : 'Failed to download',
      }));
      return null;
    }
  }, [user, nostr]);

  return {
    remoteBudget: remoteBudget?.data || null,
    remoteTimestamp: remoteBudget?.timestamp || null,
    isLoadingRemote,

    uploadBudget,
    downloadBudget,

    syncStatus,
    canSync: !!user?.pubkey && !!user?.signer?.nip44,
  };
}
