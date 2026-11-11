import { useEffect, useRef } from 'react';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  fetchGuestBudget,
  guestBudgetForDisk,
  isSelfHostedGuestStoreEnabled,
  reconcileGuestBudget,
  saveGuestBudget,
  stampChangedMonths,
  type GuestBudgetRecord,
} from '@/lib/guestBudgetSync';
import type { BudgetState } from '@/lib/budgetTypes';

const POLL_MS = 3000;
const SAVE_MS = 500;

/**
 * Keeps a guest budget on the Umbrel disk while this browser is not signed in.
 * Signed-in sessions do not call the store. The store is absent on satsorter.com.
 */
export function GuestBudgetBridge() {
  const { state: mode } = useOnboarding();
  const { state, setState } = useBudgetContext();
  const enabled = isSelfHostedGuestStoreEnabled() && mode === 'guest';
  const stateRef = useRef(state);
  stateRef.current = state;
  const revisionRef = useRef(0);
  const snapshotRef = useRef('');
  const readyRef = useRef(false);
  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  useEffect(() => {
    if (!enabled) {
      readyRef.current = false;
      return;
    }
    let cancelled = false;

    const remember = (next: BudgetState, revision: number) => {
      revisionRef.current = revision;
      snapshotRef.current = JSON.stringify(guestBudgetForDisk(next));
    };

    const publish = async (next: BudgetState, baseRevision: number): Promise<void> => {
      const saved = await saveGuestBudget(baseRevision, next);
      if (cancelled) return;
      if (!saved.conflict) {
        remember(next, saved.revision);
        return;
      }
      const serverState = saved.record.state ?? stateRef.current;
      const merged = stampChangedMonths(serverState, reconcileGuestBudget(next, {
        empty: false,
        revision: saved.record.revision,
        state: serverState,
      }).state);
      setStateRef.current(merged);
      const retry = await saveGuestBudget(saved.record.revision, merged);
      if (cancelled) return;
      if (!retry.conflict) remember(merged, retry.revision);
    };

    const applyRecord = async (remote: GuestBudgetRecord, allowWrite: boolean) => {
      const decision = reconcileGuestBudget(stateRef.current, remote);
      if (JSON.stringify(guestBudgetForDisk(decision.state)) !== JSON.stringify(guestBudgetForDisk(stateRef.current))) {
        setStateRef.current(decision.state);
      }
      remember(decision.state, remote.revision);
      if (allowWrite && decision.write) {
        const stamped = stampChangedMonths(stateRef.current, decision.state);
        await publish(stamped, remote.revision);
      }
    };

    const pull = async () => {
      try {
        const remote = await fetchGuestBudget();
        if (cancelled) return;
        await applyRecord(remote, true);
        readyRef.current = true;
      } catch (error) {
        console.warn('[guest-budget] Umbrel store is not reachable. This browser copy is unchanged.', error);
      }
    };

    void pull();
    const poll = window.setInterval(() => {
      if (!readyRef.current) return;
      void fetchGuestBudget().then(async (remote) => {
        if (cancelled || remote.revision === revisionRef.current) return;
        const dirty = JSON.stringify(guestBudgetForDisk(stateRef.current)) !== snapshotRef.current;
        await applyRecord(remote, dirty);
      }).catch((error) => {
        console.warn('[guest-budget] Could not refresh the Umbrel guest budget.', error);
      });
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    const disk = guestBudgetForDisk(state);
    if (JSON.stringify(disk) === snapshotRef.current) return;
    const handle = window.setTimeout(() => {
      const stamped = stampChangedMonths(
        JSON.parse(snapshotRef.current || '{}') as BudgetState,
        stateRef.current,
      );
      void saveGuestBudget(revisionRef.current, stamped).then((saved) => {
        if (!saved.conflict) {
          revisionRef.current = saved.revision;
          snapshotRef.current = JSON.stringify(guestBudgetForDisk(stamped));
          return;
        }
        const serverState = saved.record.state ?? stateRef.current;
        const merged = reconcileGuestBudget(stamped, {
          empty: false,
          revision: saved.record.revision,
          state: serverState,
        }).state;
        setStateRef.current(merged);
        return saveGuestBudget(saved.record.revision, merged).then((retry) => {
          if (!retry.conflict) {
            revisionRef.current = retry.revision;
            snapshotRef.current = JSON.stringify(guestBudgetForDisk(merged));
          }
        });
      }).catch((error) => {
        console.warn('[guest-budget] Could not save the Umbrel guest budget.', error);
      });
    }, SAVE_MS);
    return () => window.clearTimeout(handle);
  }, [enabled, state]);

  return null;
}
