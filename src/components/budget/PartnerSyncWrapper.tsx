import { useEffect, useRef, createContext, useContext } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useSharedBudgetSync } from '@/hooks/useSharedBudgetSync';
import { usePartnerInviteResponses } from '@/hooks/usePartnerInviteResponses';

interface SharedSyncContextValue {
  forceSync: () => Promise<void>;
  requestSync: () => Promise<boolean>;
  hasSharedBudget: boolean;
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
  } = useSharedBudgetSync(
    budgetKeypair?.budgetNpub || '',
    budgetKeypair?.budgetNsec || ''
  );

  // Listen for invite accept/decline responses
  usePartnerInviteResponses();

  // Debounce timer for publishing
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last published fingerprint to avoid redundant publishes
  const lastPublishedRef = useRef<string>('');

  // Publish full-month snapshots whenever the budget state changes (debounced)
  useEffect(() => {
    if (!budgetKeypair) return;

    // Build a fingerprint of the current state to detect real changes
    const fingerprint = JSON.stringify(
      fullState.budgets.map(b => ({
        month: b.month,
        bucketCount: b.buckets?.length || 0,
        txCount: b.transactions?.length || 0,
        txIds: b.transactions?.map(t => t.id).sort(),
        bucketNames: b.buckets?.map(bk => bk.name).sort(),
        // Include planned amounts so budget changes are detected
        plannedAmounts: b.buckets?.map(bk => bk.lineItems?.map(li => li.plannedAmount).join(',')).sort(),
      }))
    );

    if (fingerprint === lastPublishedRef.current) return;

    // Debounce: wait 3s after the last change before publishing
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(async () => {
      console.log('[PartnerSyncWrapper] Publishing budget snapshots...');
      let published = 0;
      for (const budget of fullState.budgets) {
        if (budget.buckets && budget.buckets.length > 0) {
          const ok = await publishBudgetSnapshot(budget);
          if (ok) published++;
        }
      }
      if (published > 0) {
        console.log(`[PartnerSyncWrapper] Published ${published} month snapshot(s)`);
        lastPublishedRef.current = fingerprint;
      }
    }, 3000);

    return () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    };
  }, [budgetKeypair, fullState.budgets, publishBudgetSnapshot]);

  return (
    <SharedSyncContext.Provider value={{
      forceSync,
      requestSync,
      hasSharedBudget: !!budgetKeypair,
    }}>
      {children}
    </SharedSyncContext.Provider>
  );
}
