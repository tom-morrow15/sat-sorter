import { useEffect, useRef, useState, useCallback } from 'react';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { BudgetState } from '@/lib/budgetTypes';

/**
 * useBudgetAutoSave — Automatically syncs budget state to Nostr.
 *
 * Watches the budget state and pushes changes to Nostr after a debounce
 * window (no manual "Save" button needed). Similar to how the wealth
 * tracker already auto-syncs.
 *
 * Safety guards:
 * - Won't push before the initial download from Nostr completes (avoids
 *   wiping remote data with a stale/empty local state)
 * - Won't push an empty budget (no buckets at all)
 * - Uses a fingerprint to detect real changes (not just object identity)
 * - Debounced by 8 seconds to batch rapid edits
 */

const AUTO_SAVE_DEBOUNCE_MS = 8_000;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

/**
 * Build a stable fingerprint of the parts of budget state that should
 * trigger a Nostr sync. This excludes volatile fields like lastSynced.
 */
function budgetFingerprint(state: BudgetState): string {
  return JSON.stringify({
    budgets: state.budgets,
    currency: state.currency,
    currentMonth: state.currentMonth,
    partners: state.partners || [],
    templates: state.templates || [],
    paymentMethods: state.paymentMethods || [],
    defaultTemplateId: state.defaultTemplateId,
    userRole: state.userRole,
  });
}

export function useBudgetAutoSave(fullState?: BudgetState) {
  const { user } = useCurrentUser();
  const { uploadBudget, canSync } = useBudgetSync();
  const [status, setStatus] = useState<AutoSaveStatus>('idle');

  const lastPushedFingerprint = useRef<string | null>(null);
  const monthFingerprints = useRef<Map<string, string>>(new Map());
  const hasInitialized = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The debounce callback must upload whatever is on screen now, not the
  // snapshot from when the timer was armed. Otherwise a line-item edit made
  // during those 8 seconds gets published as the old amount.
  const fullStateRef = useRef(fullState);
  fullStateRef.current = fullState;

  // Reset when user changes (login/logout)
  useEffect(() => {
    hasInitialized.current = false;
    lastPushedFingerprint.current = null;
    setStatus('idle');
  }, [user?.pubkey]);

  useEffect(() => {
    if (!user?.pubkey || !canSync) return;
    if (!fullState?.budgets) return;

    // Don't push an empty budget — NostrSync may still be downloading,
    // or the user genuinely has no data. Either way, uploading would
    // risk wiping remote data.
    const hasData =
      fullState.budgets.length > 0 &&
      fullState.budgets.some((b) => b.buckets && b.buckets.length > 0);
    if (!hasData) return;

    const fingerprint = budgetFingerprint(fullState);

    // First run for this user session: record the baseline, don't push yet.
    // NostrSync may still be merging remote data in.
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      lastPushedFingerprint.current = fingerprint;
      for (const month of fullState.budgets) monthFingerprints.current.set(month.month, JSON.stringify(month));
      setStatus('saved');
      return;
    }

    // No change since last push
    if (fingerprint === lastPushedFingerprint.current) return;

    // Clear any pending timer
    if (pushTimer.current) clearTimeout(pushTimer.current);

    // Debounce the push
    pushTimer.current = setTimeout(async () => {
      const latestState = fullStateRef.current;
      if (!latestState?.budgets) return;
      const latest = budgetFingerprint(latestState);
      if (latest === lastPushedFingerprint.current) return;

      setStatus('saving');
      const changed = latestState.budgets.filter((month) => monthFingerprints.current.get(month.month) !== JSON.stringify(month));
      const ok = await uploadBudget(latestState, { skipRemoteCheck: true, onlyMonths: changed.length > 0 ? changed : undefined });
      if (ok) {
        lastPushedFingerprint.current = latest;
        for (const month of latestState.budgets) monthFingerprints.current.set(month.month, JSON.stringify(month));
        setStatus('saved');
      } else {
        setStatus('error');
        // Retry once after a longer delay, still from the latest state.
        setTimeout(async () => {
          const retryState = fullStateRef.current;
          if (!retryState?.budgets) return;
          const retryFp = budgetFingerprint(retryState);
          const retryChanged = retryState.budgets.filter((month) => monthFingerprints.current.get(month.month) !== JSON.stringify(month));
          const retryOk = await uploadBudget(retryState, { skipRemoteCheck: true, onlyMonths: retryChanged.length > 0 ? retryChanged : undefined });
          if (retryOk) {
            lastPushedFingerprint.current = retryFp;
            for (const month of retryState.budgets) monthFingerprints.current.set(month.month, JSON.stringify(month));
            setStatus('saved');
          } else {
            setStatus('error');
          }
        }, 15_000);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [fullState, user?.pubkey, canSync, uploadBudget]);

  // Manual save — user can still trigger an immediate save
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!user?.pubkey || !canSync) return false;
    if (!fullState?.budgets) return false;
    if (pushTimer.current) clearTimeout(pushTimer.current);

    const hasData =
      fullState.budgets.length > 0 &&
      fullState.budgets.some((b) => b.buckets && b.buckets.length > 0);
    if (!hasData) return false;

    setStatus('saving');
    const ok = await uploadBudget(fullState, { skipRemoteCheck: true });
    if (ok) {
      lastPushedFingerprint.current = budgetFingerprint(fullState);
      setStatus('saved');
    } else {
      setStatus('error');
    }
    return ok;
  }, [user?.pubkey, canSync, uploadBudget, fullState]);

  return {
    status,
    saveNow,
    canAutoSave: !!user?.pubkey && canSync,
  };
}
