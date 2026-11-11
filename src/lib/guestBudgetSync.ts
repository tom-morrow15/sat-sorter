import { mergeMonthlyBudgets } from '@/lib/budgetMerge';
import {
  normalizeBudgetState,
  type BudgetState,
  type BudgetTemplate,
  type MonthlyBudget,
} from '@/lib/budgetTypes';

/**
 * Guest budgets on a self-hosted Umbrel.
 *
 * Signed-in Nostr use is untouched: those budgets stay on relays as kind 30078.
 * A guest budget is one shared copy on the Umbrel disk. Every browser that
 * opens the app without signing in reads and writes that copy, so clearing
 * one browser does not remove it.
 *
 * The first time a browser with a local guest budget meets an empty store,
 * the browser copy is saved. If both already have data, months are merged
 * with the same tombstone-aware month merge used for Nostr backups. Neither
 * copy is replaced by an empty one.
 *
 * Two browsers editing at once: the second save gets the current server
 * revision, the two snapshots are merged, and the merge is written. Items
 * that exist on only one side are kept. When both sides changed the same
 * item, the snapshot with the newer month `updatedAt` supplies the fields.
 *
 * Upgrading a guest to a Nostr account publishes the budget that is on screen
 * and, only after that publish succeeds, deletes the Umbrel guest copy.
 * A failed publish leaves the Umbrel copy in place.
 *
 * The store is plaintext JSON. It has no password of its own. On Umbrel,
 * app_proxy is the lock: only someone signed in to the Umbrel can open the app.
 */
export const GUEST_BUDGET_API = '/api/guest-budget';

export function isSelfHostedGuestStoreEnabled(): boolean {
  return import.meta.env.VITE_SELF_HOSTED === 'true';
}

export interface GuestBudgetRecord {
  empty: boolean;
  revision: number;
  state?: BudgetState;
}

export function guestBudgetHasContent(state: BudgetState | undefined): boolean {
  if (!state) return false;
  if (state.currency === 'usd') return true;
  if ((state.paymentMethods || []).length > 0) return true;
  if ((state.templates || []).length > 0) return true;
  return (state.budgets || []).some((month) =>
    (month.buckets || []).length > 0 || (month.transactions || []).length > 0,
  );
}

/** Drop device-only secrets before the budget is written to the shared disk. */
export function guestBudgetForDisk(state: BudgetState): BudgetState {
  const normalized = normalizeBudgetState(state);
  return {
    ...normalized,
    budgetKeypair: undefined,
    accessibleBudgets: [],
  };
}

function monthStamp(state: BudgetState): number {
  return (state.budgets || []).reduce((max, month) => Math.max(max, month.updatedAt || 0), 0);
}

function unionTemplates(local: BudgetTemplate[] | undefined, remote: BudgetTemplate[] | undefined): BudgetTemplate[] | undefined {
  const map = new Map<string, BudgetTemplate>();
  for (const template of local || []) map.set(template.id, template);
  for (const template of remote || []) {
    const existing = map.get(template.id);
    if (!existing || (template.updatedAt || 0) >= (existing.updatedAt || 0)) {
      map.set(template.id, template);
    }
  }
  const values = Array.from(map.values());
  return values.length > 0 ? values : undefined;
}

/**
 * Union two guest snapshots. Local keeps the month on screen and any
 * device-only key material. Months use mergeMonthlyBudgets.
 */
export function mergeGuestBudgetStates(local: BudgetState, remote: BudgetState): BudgetState {
  const localNorm = normalizeBudgetState(local);
  const remoteNorm = normalizeBudgetState(remote);
  const months = new Set<string>();
  for (const month of localNorm.budgets) months.add(month.month);
  for (const month of remoteNorm.budgets) months.add(month.month);

  const budgets: MonthlyBudget[] = Array.from(months).map((month) => {
    const left = localNorm.budgets.find((entry) => entry.month === month);
    const right = remoteNorm.budgets.find((entry) => entry.month === month);
    if (left && right) return mergeMonthlyBudgets(left, right);
    return (left || right) as MonthlyBudget;
  });

  const localNewer = monthStamp(localNorm) >= monthStamp(remoteNorm);
  const paymentMethods = Array.from(new Set([
    ...(localNorm.paymentMethods || []),
    ...(remoteNorm.paymentMethods || []),
  ]));

  return normalizeBudgetState({
    ...remoteNorm,
    ...(localNewer ? localNorm : {}),
    currentMonth: localNorm.currentMonth,
    currency: localNewer ? localNorm.currency : remoteNorm.currency,
    budgets,
    templates: unionTemplates(localNorm.templates, remoteNorm.templates),
    paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
    budgetKeypair: localNorm.budgetKeypair,
    accessibleBudgets: localNorm.accessibleBudgets,
    budgetThread: localNorm.budgetThread || remoteNorm.budgetThread,
  });
}

export interface GuestReconcile {
  state: BudgetState;
  /** True when the Umbrel file should be updated with `state`. */
  write: boolean;
}

/**
 * Decide what the browser should show and whether to write the file.
 * An empty side never erases a side that has a budget.
 */
export function reconcileGuestBudget(local: BudgetState, remote: GuestBudgetRecord): GuestReconcile {
  const localNorm = normalizeBudgetState(local);
  const remoteState = remote.state ? normalizeBudgetState(remote.state) : undefined;
  const localHas = guestBudgetHasContent(localNorm);
  const remoteHas = guestBudgetHasContent(remoteState);

  if (!remoteHas && localHas) {
    return { state: localNorm, write: true };
  }
  if (remoteHas && remoteState && !localHas) {
    return {
      state: mergeGuestBudgetStates(localNorm, remoteState),
      write: false,
    };
  }
  if (remoteHas && remoteState && localHas) {
    const merged = mergeGuestBudgetStates(localNorm, remoteState);
    const changedOnDisk = JSON.stringify(guestBudgetForDisk(merged)) !== JSON.stringify(guestBudgetForDisk(remoteState));
    return { state: merged, write: changedOnDisk };
  }
  return { state: localNorm, write: false };
}

/** Mark months the user just changed so a merge can tell which edit is newer. */
export function stampChangedMonths(previous: BudgetState, next: BudgetState, now = Date.now()): BudgetState {
  const before = new Map((previous.budgets || []).map((month) => [month.month, monthWithoutStamp(month)]));
  return {
    ...next,
    budgets: next.budgets.map((month) => {
      const prior = before.get(month.month);
      if (prior && prior === monthWithoutStamp(month)) return month;
      return { ...month, updatedAt: now };
    }),
  };
}

function monthWithoutStamp(month: MonthlyBudget): string {
  return JSON.stringify({ ...month, updatedAt: undefined });
}

export async function fetchGuestBudget(): Promise<GuestBudgetRecord> {
  const response = await fetch(GUEST_BUDGET_API, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Guest budget read failed (${response.status})`);
  return response.json() as Promise<GuestBudgetRecord>;
}

export async function saveGuestBudget(
  baseRevision: number,
  state: BudgetState,
): Promise<{ conflict: false; revision: number } | { conflict: true; record: GuestBudgetRecord }> {
  const response = await fetch(GUEST_BUDGET_API, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision, state: guestBudgetForDisk(state) }),
  });
  const body = await response.json() as GuestBudgetRecord;
  if (response.status === 409) return { conflict: true, record: body };
  if (!response.ok) throw new Error(`Guest budget save failed (${response.status})`);
  return { conflict: false, revision: body.revision };
}

export async function clearGuestBudgetStore(): Promise<void> {
  if (!isSelfHostedGuestStoreEnabled()) return;
  const response = await fetch(GUEST_BUDGET_API, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Guest budget delete failed (${response.status})`);
  }
}
