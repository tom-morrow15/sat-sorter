import { useEffect, useRef, createContext, useContext } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useSharedBudgetSync, fingerprintBudgetMonth } from '@/hooks/useSharedBudgetSync';
import type { MonthlyBudget } from '@/lib/budgetTypes';

interface SharedSyncContextValue {
  forceSync: () => Promise<void>;
  requestSync: () => Promise<boolean>;
  hasSharedBudget: boolean;
  /** Mark a month as received from sync so it isn't echoed back. */
  markReceivedSnapshot: (month: string, snapshot: MonthlyBudget) => void;
}

const SharedSyncContext = createContext<SharedSyncContextValue | null>(null);

export function useSharedSync() {
  return useContext(SharedSyncContext);
}

/**
 * PartnerSyncWrapper — publishes full-month snapshots to the shared budget
 * keypair whenever the local state changes (debounced).
 *
 * Simplified model: no per-transaction change detection, no echo prevention
 * complexity. Any state change → publish the full month snapshot. The latest
 * snapshot always wins (replaceable event). Idempotent and self-healing.
 */
export function PartnerSyncWrapper({ children }: { children: React.ReactNode }) {
  const { fullState } = useBudget();
  const { state } = useBudgetContext();
  const budgetKeypair = state.budgetKeypair;

  const {
    publishBudgetSnapshot,
    forceSync,
    requestSync,
    receivedFingerprints,
    markLocalChange,
    lastLocalChange,
    markReceivedSnapshot,
  } = useSharedBudgetSync(
    budgetKeypair?.budgetNpub || '',
    budgetKeypair?.budgetNsec || ''
  );

  // Debounce timer for publishing
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last published fingerprint to avoid redundant publishes
  const lastPublishedRef = useRef<string>('');

  // Diagnostic: log whether the shared budget keypair is available
  useEffect(() => {
    console.log('[PartnerSyncWrapper] budgetKeypair present:', !!budgetKeypair, 'budgets:', fullState.budgets.length);
  }, [budgetKeypair, fullState.budgets.length]);

  // Publish full-month snapshots whenever the budget state changes (debounced)
  useEffect(() => {
    if (!budgetKeypair) return;

    // Build a fingerprint of each month using the shared helper so it matches
    // what useSharedBudgetSync records when a snapshot is received.
    const currentFingerprints = new Map<string, string>();
    for (const budget of fullState.budgets) {
      currentFingerprints.set(budget.month, fingerprintBudgetMonth(budget));
    }

    // Determine which months actually changed and weren't just received via sync
    const changedMonths: typeof fullState.budgets = [];
    for (const budget of fullState.budgets) {
      const currentFp = currentFingerprints.get(budget.month)!;
      const receivedFp = receivedFingerprints.current.get(budget.month);

      // If this month matches a recently received snapshot, it wasn't a local
      // change — skip it and clear the received fingerprint so future local
      // edits to this month are published normally.
      if (receivedFp && currentFp === receivedFp) {
        receivedFingerprints.current.delete(budget.month);
        continue;
      }

      changedMonths.push(budget);
    }

    if (changedMonths.length === 0) return;

    // Record that these months were locally edited (so incoming older
    // snapshots won't overwrite them)
    const now = Math.floor(Date.now() / 1000);
    for (const budget of changedMonths) {
      lastLocalChange.current.set(budget.month, now);
    }

    // Build a combined fingerprint for the changed months only
    const combinedFingerprint = JSON.stringify(
      changedMonths.map(b => ({ month: b.month, fp: currentFingerprints.get(b.month) })).sort((a, b) => a.month.localeCompare(b.month))
    );
    if (combinedFingerprint === lastPublishedRef.current) return;

    // Debounce: wait 3s after the last change before publishing
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(async () => {
      console.log('[PartnerSyncWrapper] Publishing budget snapshots for', changedMonths.length, 'month(s)...');
      let published = 0;
      for (const budget of changedMonths) {
        if (budget.buckets && budget.buckets.length > 0) {
          const ok = await publishBudgetSnapshot(budget);
          if (ok) {
            published++;
          } else {
            console.warn('[PartnerSyncWrapper] Failed to publish snapshot for', budget.month);
          }
        }
      }
      if (published > 0) {
        console.log(`[PartnerSyncWrapper] Published ${published} month snapshot(s)`);
        lastPublishedRef.current = combinedFingerprint;
      }
    }, 3000);

    return () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
  }, [budgetKeypair, fullState.budgets, publishBudgetSnapshot, receivedFingerprints, lastLocalChange]);

  return (
    <SharedSyncContext.Provider value={{
      forceSync,
      requestSync,
      hasSharedBudget: !!budgetKeypair,
      markReceivedSnapshot,
    }}>
      {children}
    </SharedSyncContext.Provider>
  );
}
