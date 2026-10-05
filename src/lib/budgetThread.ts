import type { Bucket, LineItem, MonthlyBudget, Transaction } from './budgetTypes';

/**
 * A single shared-budget change. Notes are the record. A checkpoint is only
 * a shortcut. Applying the same note twice is a no-op, and a later note for
 * one item never replaces the rest of the month.
 */
export interface BudgetNote {
  id: string;
  budgetId: string;
  month: string;
  entity: 'bucket' | 'line' | 'transaction';
  entityId: string;
  op: 'upsert' | 'delete';
  /** Unix milliseconds. Later wins. Equal times break on note id. */
  at: number;
  authorPubkey: string;
  bucket?: Bucket;
  /** Which bucket a line item belongs to. */
  bucketId?: string;
  lineItem?: LineItem;
  transaction?: Transaction;
}

export interface BudgetCheckpoint {
  authorPubkey: string;
  budgets: MonthlyBudget[];
  appliedNoteIds: string[];
}

export interface MemberRecord {
  pubkey: string;
  at: number;
  joinedAt?: number;
}

export interface Membership {
  ownerPubkey: string;
  active: MemberRecord[];
  pending: MemberRecord[];
  revoked: MemberRecord[];
  former: MemberRecord[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function byTimeThenId(a: BudgetNote, b: BudgetNote): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function emptyMonth(month: string): MonthlyBudget {
  return { id: month, month, buckets: [], transactions: [] };
}

function ensureMonth(budgets: MonthlyBudget[], month: string): MonthlyBudget {
  let found = budgets.find((item) => item.month === month);
  if (!found) {
    found = emptyMonth(month);
    budgets.push(found);
  }
  return found;
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

function applyOne(budgets: MonthlyBudget[], note: BudgetNote): MonthlyBudget[] {
  const month = ensureMonth(budgets, note.month);

  if (note.entity === 'bucket') {
    if (note.op === 'delete') {
      month.buckets = (month.buckets || []).filter((bucket) => bucket.id !== note.entityId);
      month.deletedBucketIds = Array.from(new Set([...(month.deletedBucketIds || []), note.entityId]));
      return budgets;
    }
    if (!note.bucket) return budgets;
    month.deletedBucketIds = (month.deletedBucketIds || []).filter((id) => id !== note.entityId);
    const existing = (month.buckets || []).find((bucket) => bucket.id === note.entityId);
    const merged: Bucket = existing
      ? { ...note.bucket, lineItems: existing.lineItems }
      : { ...note.bucket, lineItems: note.bucket.lineItems || [] };
    month.buckets = upsertById(month.buckets || [], merged);
    return budgets;
  }

  if (note.entity === 'line') {
    if (note.op === 'delete') {
      month.buckets = (month.buckets || []).map((bucket) => ({
        ...bucket,
        lineItems: (bucket.lineItems || []).filter((line) => line.id !== note.entityId),
      }));
      month.deletedLineItemIds = Array.from(new Set([...(month.deletedLineItemIds || []), note.entityId]));
      return budgets;
    }
    if (!note.lineItem || !note.bucketId) return budgets;
    month.deletedLineItemIds = (month.deletedLineItemIds || []).filter((id) => id !== note.entityId);
    let bucket = (month.buckets || []).find((item) => item.id === note.bucketId);
    if (!bucket) {
      bucket = {
        id: note.bucketId,
        name: 'Budget',
        color: '#888',
        icon: 'home',
        isIncome: false,
        lineItems: [],
        order: (month.buckets || []).length,
      };
      month.buckets = [...(month.buckets || []), bucket];
    }
    bucket.lineItems = upsertById(bucket.lineItems || [], note.lineItem);
    month.buckets = (month.buckets || []).map((item) => {
      if (item.id === bucket!.id) return bucket!;
      return {
        ...item,
        lineItems: (item.lineItems || []).filter((line) => line.id !== note.entityId),
      };
    });
    return budgets;
  }

  if (note.op === 'delete') {
    month.transactions = (month.transactions || []).filter((tx) => tx.id !== note.entityId);
    month.deletedTxIds = Array.from(new Set([...(month.deletedTxIds || []), note.entityId]));
    return budgets;
  }
  if (!note.transaction) return budgets;
  month.deletedTxIds = (month.deletedTxIds || []).filter((id) => id !== note.entityId);
  month.transactions = upsertById(month.transactions || [], {
    ...note.transaction,
    partnerPubkey: note.transaction.partnerPubkey || note.authorPubkey,
  });
  return budgets;
}

/** Apply notes in order. Duplicate ids are ignored. An older note never replaces a newer one for the same item. */
export function applyNotes(
  budgets: MonthlyBudget[],
  notes: BudgetNote[],
  clocks: Record<string, number> = {},
): MonthlyBudget[] {
  const next = clone(budgets);
  const seen = new Set<string>();
  for (const note of [...notes].sort(byTimeThenId)) {
    if (seen.has(note.id)) continue;
    seen.add(note.id);
    const key = `${note.month}:${note.entity}:${note.entityId}`;
    if (note.at < (clocks[key] ?? 0)) continue;
    clocks[key] = note.at;
    applyOne(next, note);
  }
  return next;
}

/** Prefer the backup that already includes more notes. Ties break on author id. */
export function selectCheckpoint(checkpoints: BudgetCheckpoint[]): BudgetCheckpoint | null {
  const usable = checkpoints.filter((item) => Array.isArray(item.budgets));
  if (usable.length === 0) return null;
  return [...usable].sort((a, b) => {
    const coverage = b.appliedNoteIds.length - a.appliedNoteIds.length;
    if (coverage !== 0) return coverage;
    if (a.authorPubkey < b.authorPubkey) return -1;
    if (a.authorPubkey > b.authorPubkey) return 1;
    return 0;
  })[0];
}

/**
 * Start from the fullest backup, then play every note that backup does not
 * already include. An older backup cannot rewind a newer note.
 */
export function reduceBudget(checkpoints: BudgetCheckpoint[], notes: BudgetNote[]): MonthlyBudget[] {
  const checkpoint = selectCheckpoint(checkpoints);
  const applied = new Set(checkpoint?.appliedNoteIds || []);
  const pending = notes.filter((note) => !applied.has(note.id));
  return applyNotes(checkpoint?.budgets || [], pending);
}

export function noteIsActive(membership: Membership, note: BudgetNote): boolean {
  if (note.authorPubkey === membership.ownerPubkey) return true;
  const former = membership.former.find((member) => member.pubkey === note.authorPubkey);
  if (former && note.at >= (former.joinedAt ?? 0) && note.at <= former.at) return true;
  const joined = membership.active.find((member) => member.pubkey === note.authorPubkey);
  return !!joined && note.at >= joined.at;
}

export function revokeInvite(membership: Membership, pubkey: string, at: number): Membership {
  return {
    ...membership,
    pending: membership.pending.filter((member) => member.pubkey !== pubkey),
    revoked: [...membership.revoked.filter((member) => member.pubkey !== pubkey), { pubkey, at }],
  };
}

export function acceptInvite(membership: Membership, pubkey: string, at: number): Membership {
  const invited = membership.pending.some((member) => member.pubkey === pubkey);
  const revoked = membership.revoked.some((member) => member.pubkey === pubkey);
  if (!invited || revoked) return membership;
  return {
    ...membership,
    pending: membership.pending.filter((member) => member.pubkey !== pubkey),
    active: [...membership.active.filter((member) => member.pubkey !== pubkey), { pubkey, at }],
  };
}

export function leaveBudget(membership: Membership, pubkey: string, at: number): Membership {
  if (pubkey === membership.ownerPubkey) return membership;
  const active = membership.active.find((member) => member.pubkey === pubkey);
  if (!active) return membership;
  return {
    ...membership,
    active: membership.active.filter((member) => member.pubkey !== pubkey),
    former: [...membership.former.filter((member) => member.pubkey !== pubkey), { pubkey, at, joinedAt: active.at }],
  };
}

function sameLine(a: LineItem, b: LineItem): boolean {
  return a.name === b.name
    && a.plannedAmount === b.plannedAmount
    && a.plannedAmountUsd === b.plannedAmountUsd
    && a.btcPriceAtBudget === b.btcPriceAtBudget
    && a.order === b.order;
}

function sameBucket(a: Bucket, b: Bucket): boolean {
  return a.name === b.name && a.color === b.color && a.icon === b.icon && a.isIncome === b.isIncome && a.order === b.order;
}

function sameTx(a: Transaction, b: Transaction): boolean {
  return a.amount === b.amount
    && a.amountUsd === b.amountUsd
    && a.description === b.description
    && a.date === b.date
    && a.lineItemId === b.lineItemId
    && a.bucketId === b.bucketId
    && a.isIncome === b.isIncome
    && a.partnerPubkey === b.partnerPubkey
    && a.btcPriceAtEntry === b.btcPriceAtEntry
    && a.paymentMethod === b.paymentMethod
    && JSON.stringify(a.splits || []) === JSON.stringify(b.splits || []);
}

/**
 * Notes for anything present on only one phone. Used when moving an existing
 * couple onto the thread so a local-only transaction is not dropped.
 */
export function diffAgainstBase(
  base: MonthlyBudget[],
  local: MonthlyBudget[],
  authorPubkey: string,
  budgetId: string,
  at: number,
): BudgetNote[] {
  const notes: BudgetNote[] = [];
  const months = new Set([...base.map((item) => item.month), ...local.map((item) => item.month)]);
  let seq = 0;
  const push = (note: Omit<BudgetNote, 'id' | 'budgetId' | 'at' | 'authorPubkey'>) => {
    notes.push({
      ...note,
      id: `migrate-${note.month}-${note.entity}-${note.entityId}-${seq++}`,
      budgetId,
      at,
      authorPubkey,
    });
  };

  for (const month of months) {
    const baseMonth = base.find((item) => item.month === month);
    const localMonth = local.find((item) => item.month === month);
    const baseBuckets = new Map((baseMonth?.buckets || []).map((bucket) => [bucket.id, bucket]));
    const localBuckets = new Map((localMonth?.buckets || []).map((bucket) => [bucket.id, bucket]));

    for (const [id, bucket] of localBuckets) {
      const prior = baseBuckets.get(id);
      if (!prior || !sameBucket(prior, bucket)) {
        push({ month, entity: 'bucket', entityId: id, op: 'upsert', bucket: { ...bucket, lineItems: [] } });
      }
      const priorLines = new Map((prior?.lineItems || []).map((line) => [line.id, line]));
      for (const line of bucket.lineItems || []) {
        const priorLine = priorLines.get(line.id);
        if (!priorLine || !sameLine(priorLine, line)) {
          push({ month, entity: 'line', entityId: line.id, op: 'upsert', bucketId: id, lineItem: line });
        }
      }
      for (const [lineId] of priorLines) {
        if (!(bucket.lineItems || []).some((line) => line.id === lineId)) {
          push({ month, entity: 'line', entityId: lineId, op: 'delete' });
        }
      }
    }
    for (const [id] of baseBuckets) {
      if (!localBuckets.has(id)) push({ month, entity: 'bucket', entityId: id, op: 'delete' });
    }

    const baseTx = new Map((baseMonth?.transactions || []).map((tx) => [tx.id, tx]));
    const localTx = new Map((localMonth?.transactions || []).map((tx) => [tx.id, tx]));
    for (const [id, tx] of localTx) {
      const prior = baseTx.get(id);
      if (!prior || !sameTx(prior, tx)) {
        push({ month, entity: 'transaction', entityId: id, op: 'upsert', transaction: tx });
      }
    }
    for (const [id] of baseTx) {
      if (!localTx.has(id)) push({ month, entity: 'transaction', entityId: id, op: 'delete' });
    }
  }
  return notes;
}

/**
 * Differences to keep when a partner accepts. Never deletes anything that
 * exists only on the starting copy. Amount changes are included only when
 * her copy of that month is newer.
 */
export function extrasAgainstBase(
  base: MonthlyBudget[],
  local: MonthlyBudget[],
  authorPubkey: string,
  budgetId: string,
  at: number,
): BudgetNote[] {
  return diffAgainstBase(base, local, authorPubkey, budgetId, at).filter((note) => {
    if (note.op === 'delete') return false;
    const baseMonth = base.find((item) => item.month === note.month);
    const localMonth = local.find((item) => item.month === note.month);
    const localNewer = (localMonth?.updatedAt || 0) > (baseMonth?.updatedAt || 0);
    if (!baseMonth) return true;
    if (localNewer) return true;
    if (note.entity === 'transaction') {
      return !(baseMonth.transactions || []).some((tx) => tx.id === note.entityId);
    }
    if (note.entity === 'line') {
      return !(baseMonth.buckets || []).some((bucket) => (bucket.lineItems || []).some((line) => line.id === note.entityId));
    }
    if (note.entity === 'bucket') {
      return !(baseMonth.buckets || []).some((bucket) => bucket.id === note.entityId);
    }
    return false;
  });
}
