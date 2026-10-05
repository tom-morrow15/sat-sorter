import { useCallback, useEffect, useRef, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { generateId, getCurrentMonth, type BudgetState, type BudgetThreadState } from '@/lib/budgetTypes';
import {
  applyNotes,
  diffAgainstBase,
  extrasAgainstBase,
  noteIsActive,
  type BudgetCheckpoint,
  type BudgetNote,
  type Membership,
} from '@/lib/budgetThread';
import { publishToSharedRelays, querySharedRelays, subscribeSharedRelays } from '@/hooks/useSharedBudgetSync';

function monthsFrom(budgets: BudgetState['budgets'], from: string) {
  return budgets.filter((month) => month.month >= from);
}

function seedClocks(budgets: BudgetState['budgets']): Record<string, number> {
  const clocks: Record<string, number> = {};
  for (const month of budgets) {
    const at = (month.updatedAt || 0) * 1000;
    if (!at) continue;
    for (const bucket of month.buckets || []) {
      clocks[`${month.month}:bucket:${bucket.id}`] = at;
      for (const line of bucket.lineItems || []) clocks[`${month.month}:line:${line.id}`] = at;
    }
    for (const tx of month.transactions || []) clocks[`${month.month}:transaction:${tx.id}`] = at;
  }
  return clocks;
}
const KIND = 30078;
const TAG = 'sat-sorter-thread';

export interface IncomingInvite {
  budgetId: string;
  ownerPubkey: string;
  monthCount: number;
  eventId: string;
}

let syncLeader: object | null = null;

function membershipOf(thread: BudgetThreadState): Membership {
  const partner = thread.partnerPubkey;
  const live = thread.status === 'accepted' || thread.status === 'pending';
  return {
    ownerPubkey: thread.ownerPubkey,
    // at: 0 so a transaction logged in the same minute as the invite is not dropped.
    active: live && partner ? [{ pubkey: partner, at: 0 }] : [],
    pending: [],
    revoked: [],
    former: thread.status === 'left' && partner
      ? [{ pubkey: partner, at: thread.endedAt || 0, joinedAt: 0 }]
      : [],
  };
}

function recipientsFor(thread: BudgetThreadState, me: string): string[] {
  const targets = new Set<string>([me]);
  const live = thread.status === 'pending' || thread.status === 'accepted';
  if (live && thread.partnerPubkey && thread.partnerPubkey !== me) targets.add(thread.partnerPubkey);
  if (live && thread.role === 'partner' && thread.ownerPubkey !== me) targets.add(thread.ownerPubkey);
  return [...targets];
}

async function encrypt(signer: { nip44?: { encrypt: (pubkey: string, value: string) => Promise<string> } }, pubkey: string, payload: unknown): Promise<string> {
  if (!signer.nip44) throw new Error('This login cannot encrypt budget updates');
  return signer.nip44.encrypt(pubkey, JSON.stringify(payload));
}

async function decrypt(signer: { nip44?: { decrypt: (pubkey: string, value: string) => Promise<string> } }, pubkey: string, content: string): Promise<any | null> {
  if (!signer.nip44) return null;
  try {
    return JSON.parse(await signer.nip44.decrypt(pubkey, content));
  } catch {
    return null;
  }
}

async function publishEncrypted(
  signer: { signEvent: (event: any) => Promise<any>; nip44?: { encrypt: (pubkey: string, value: string) => Promise<string> } },
  recipient: string,
  dTag: string,
  payload: unknown,
  extraTags: string[][] = [],
): Promise<boolean> {
  const content = await encrypt(signer, recipient, payload);
  const event = await signer.signEvent({
    kind: KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', dTag], ['t', TAG], ['p', recipient], ...extraTags],
    content,
  });
  return publishToSharedRelays(event);
}

export function parsePartnerInput(raw: string): { pubkey?: string; join?: { budgetId: string; ownerPubkey: string; monthCount?: number; sharedFromMonth?: string } } {
  const value = raw.trim().replace(/^nostr:/, '');
  if (value.startsWith('satsorter:join:')) {
    const parts = value.split(':');
    const budgetId = parts[2];
    const ownerPubkey = parts[3];
    const monthCount = Number(parts[4]);
    const sharedFromMonth = /^\d{4}-\d{2}$/.test(parts[5] || '') ? parts[5] : undefined;
    if (budgetId && ownerPubkey) {
      return { join: { budgetId, ownerPubkey, monthCount: Number.isFinite(monthCount) ? monthCount : undefined, sharedFromMonth } };
    }
  }
  try {
    const decoded = nip19.decode(value);
    if (decoded.type === 'npub') return { pubkey: decoded.data as string };
    if (decoded.type === 'nprofile') return { pubkey: (decoded.data as { pubkey: string }).pubkey };
  } catch {
    // not an npub
  }
  if (/^[0-9a-f]{64}$/i.test(value)) return { pubkey: value.toLowerCase() };
  return {};
}

export function useBudgetThread() {
  const { user } = useCurrentUser();
  const { state, setState } = useBudgetContext();
  const { toast } = useToast();
  const token = useRef({});
  const [isLeader, setIsLeader] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const baselineRef = useRef<string>('');
  const readyRef = useRef(false);
  const pullRef = useRef<() => Promise<void>>(async () => {});
  const sendingRef = useRef(false);
  const notesLockRef = useRef(false);
  const monthSigRef = useRef('');
  const caughtUpRef = useRef('');
  const seenEventsRef = useRef(new Set<string>());
  const monthStoreRef = useRef(new Map<string, BudgetCheckpoint['budgets'][number]>());
  const monthStoreBudgetRef = useRef('');
  const applyChainRef = useRef(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!syncLeader) {
      syncLeader = token.current;
      setIsLeader(true);
    }
    return () => {
      if (syncLeader === token.current) syncLeader = null;
    };
  }, []);

  const thread = state.budgetThread;

  const updateThread = useCallback((patch: Partial<BudgetThreadState> | ((current: BudgetThreadState) => BudgetThreadState)) => {
    setState((prev) => {
      const current = prev.budgetThread;
      if (!current) return prev;
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      return { ...prev, budgetThread: next };
    });
  }, [setState]);

  const publishToThread = useCallback(async (current: BudgetThreadState, notes: BudgetNote[]) => {
    if (!user?.signer || notes.length === 0) return false;
    const targets = recipientsFor(current, user.pubkey);
    let ok = true;
    for (let index = 0; index < notes.length; index += 20) {
      const chunk = notes.slice(index, index + 20);
      const batchId = `${Date.now()}-${index}`;
      for (const recipient of targets) {
        const sent = await publishEncrypted(
          user.signer,
          recipient,
          `sat-sorter/thread-batch/${current.budgetId}/${batchId}/${recipient.slice(0, 8)}`,
          { type: 'notes', budgetId: current.budgetId, notes: chunk },
          [['b', current.budgetId]],
        );
        ok = ok && sent;
      }
    }
    return ok;
  }, [user]);

  const sendMonths = useCallback(async (current: BudgetThreadState, recipient: string) => {
    if (!user?.signer) return false;
    const from = current.sharedFromMonth || getCurrentMonth();
    const months = monthsFrom(stateRef.current.budgets, from);
    let done = 0;
    for (const month of months) {
      const sent = await publishEncrypted(
        user.signer,
        recipient,
        `sat-sorter/thread-month/${current.budgetId}/${user.pubkey}/${recipient.slice(0, 8)}/${month.month}`,
        {
          type: 'checkpoint',
          budgetId: current.budgetId,
          monthCount: months.length,
          sharedFromMonth: from,
          checkpoint: {
            authorPubkey: user.pubkey,
            budgets: [month],
            appliedNoteIds: current.appliedNoteIds,
          },
        },
        [['b', current.budgetId]],
      );
      if (sent) done += 1;
      updateThread({ sentMonths: Math.min(done, months.length), expectedMonths: months.length, sharedFromMonth: from });
    }
    return done >= months.length;
  }, [updateThread, user]);

  const invitePartner = useCallback(async (raw: string) => {
    if (!user?.signer) throw new Error('Log in before inviting a partner');
    const parsed = parsePartnerInput(raw);
      if (parsed.join) {
        await joinBudget(parsed.join.budgetId, parsed.join.ownerPubkey, parsed.join.monthCount, parsed.join.sharedFromMonth);
        return;
      }
    if (!parsed.pubkey) throw new Error('Enter an npub, or scan an npub or join code');
    if (parsed.pubkey === user.pubkey) throw new Error('That is your own npub');
    setBusy(true);
    try {
      const existing = stateRef.current.budgetThread;
      const budgetId = existing?.budgetId || generateId();
      const from = existing?.sharedFromMonth || getCurrentMonth();
      const monthCount = monthsFrom(stateRef.current.budgets, from).length;
      const next: BudgetThreadState = {
        budgetId,
        role: 'owner',
        ownerPubkey: user.pubkey,
        partnerPubkey: parsed.pubkey,
        status: 'pending',
        sharedFromMonth: from,
        expectedMonths: monthCount,
        sentMonths: 0,
        updatedAt: Date.now(),
        appliedNoteIds: existing?.appliedNoteIds || [],
        unsyncedNotes: existing?.unsyncedNotes || [],
      };
      const invited = await publishEncrypted(
        user.signer,
        parsed.pubkey,
        `sat-sorter/thread-invite/${budgetId}`,
        { type: 'invite', budgetId, ownerPubkey: user.pubkey, monthCount },
        [['b', budgetId]],
      );
      if (!invited) throw new Error('The relays did not accept the invite. Try again.');
      setState((prev) => ({ ...prev, budgetThread: { ...next, expectedMonths: monthCount, sentMonths: 0 } }));
      stateRef.current = { ...stateRef.current, budgetThread: { ...next, expectedMonths: monthCount, sentMonths: 0 } };
      const delivered = await sendMonths({ ...next, expectedMonths: monthCount, sentMonths: 0 }, parsed.pubkey);
      if (!delivered) throw new Error('The invite was sent, but the budget did not finish sending. Leave the app open.');
      baselineRef.current = JSON.stringify(stateRef.current.budgets);
      readyRef.current = true;
    } finally {
      setBusy(false);
    }
  }, [sendMonths, setState, user]);

  const joinBudget = useCallback(async (budgetId: string, ownerPubkey: string, monthCount?: number, sharedFromMonth?: string) => {
    if (!user?.signer) throw new Error('Log in before joining a budget');
    setBusy(true);
    try {
      const sent = await publishEncrypted(
        user.signer,
        ownerPubkey,
        `sat-sorter/thread-accept/${budgetId}/${user.pubkey}`,
        { type: 'accept', budgetId, partnerPubkey: user.pubkey },
        [['b', budgetId]],
      );
      if (!sent) throw new Error('The relays did not accept the join. Try again.');
      const next: BudgetThreadState = {
        budgetId,
        role: 'partner',
        ownerPubkey,
        partnerPubkey: ownerPubkey,
        status: 'accepted',
        acceptedAt: Date.now(),
        updatedAt: Date.now(),
        expectedMonths: monthCount,
        sharedFromMonth,
        receivedMonths: 0,
        appliedNoteIds: [],
        unsyncedNotes: [],
      };
      stateRef.current = { ...stateRef.current, budgetThread: next };
      setState((prev) => ({ ...prev, budgetThread: next }));
      setIncomingInvite(null);
      void pullRef.current();
    } finally {
      setBusy(false);
    }
  }, [setState, user]);

  const revokeInvite = useCallback(async () => {
    const current = stateRef.current.budgetThread;
    if (!current || !user?.signer) return;
    setBusy(true);
    try {
      if (current.partnerPubkey) {
        await publishEncrypted(
          user.signer,
          current.partnerPubkey,
          `sat-sorter/thread-revoke/${current.budgetId}`,
          { type: 'revoke', budgetId: current.budgetId },
          [['b', current.budgetId]],
        );
      }
      updateThread({ status: 'revoked', endedAt: Date.now(), updatedAt: Date.now(), partnerPubkey: undefined, unsyncedNotes: [] });
    } finally {
      setBusy(false);
    }
  }, [updateThread, user]);

  const leaveOrRemove = useCallback(async () => {
    const current = stateRef.current.budgetThread;
    if (!current || !user?.signer) return;
    setBusy(true);
    try {
      const endedAt = Date.now();
      const other = current.role === 'owner' ? current.partnerPubkey : current.ownerPubkey;
      if (other) {
        await publishEncrypted(
          user.signer,
          other,
          `sat-sorter/thread-leave/${current.budgetId}/${user.pubkey}`,
          { type: 'leave', budgetId: current.budgetId, endedAt },
          [['b', current.budgetId]],
        );
      }
      updateThread({ status: 'left', endedAt, updatedAt: endedAt, unsyncedNotes: [] });
    } finally {
      setBusy(false);
    }
  }, [updateThread, user]);

  const resetPartnerConnection = useCallback(async () => {
    const current = stateRef.current.budgetThread;
    const endedAt = Date.now();
    console.log('[BudgetPartners] reset', { status: current?.status || 'none', hadPartner: !!current?.partnerPubkey });
    if (user?.signer && current?.budgetId) {
      const other = current.role === 'owner' ? current.partnerPubkey : current.ownerPubkey;
      if (other && other !== user.pubkey && (current.status === 'pending' || current.status === 'accepted')) {
        try {
          await publishEncrypted(
            user.signer,
            other,
            `sat-sorter/thread-leave/${current.budgetId}/${user.pubkey}`,
            { type: 'leave', budgetId: current.budgetId, endedAt },
            [['b', current.budgetId]],
          );
        } catch (error) {
          console.warn('[BudgetPartners] could not tell the other phone about the reset', error);
        }
      }
      try {
        await publishEncrypted(
          user.signer,
          user.pubkey,
          `sat-sorter/thread-self/${endedAt}`,
          {
            type: 'self',
            at: endedAt,
            budgetId: current.budgetId,
            thread: {
              budgetId: current.budgetId,
              role: 'owner',
              ownerPubkey: user.pubkey,
              status: 'left',
              endedAt,
              updatedAt: endedAt,
            },
          },
          [['b', current.budgetId]],
        );
      } catch (error) {
        console.warn('[BudgetPartners] could not save the reset', error);
      }
    }
    const next: BudgetThreadState = {
      budgetId: current?.budgetId || generateId(),
      role: 'owner',
      ownerPubkey: user?.pubkey || '',
      status: 'left',
      endedAt,
      updatedAt: endedAt,
      appliedNoteIds: [],
      unsyncedNotes: [],
    };
    const cleared = {
      budgetThread: next,
      partners: [] as BudgetState['partners'],
      budgetKeypair: undefined,
      userRole: 'owner' as const,
    };
    stateRef.current = { ...stateRef.current, ...cleared };
    setState((prev) => ({
      ...prev,
      ...cleared,
      accessibleBudgets: (prev.accessibleBudgets || []).filter((budget) => !budget.budgetNsec),
    }));
    setIncomingInvite(null);
  }, [setState, user]);

  const showJoinCode = useCallback(async () => {
    if (!user) throw new Error('Log in first');
    const existing = stateRef.current.budgetThread;
    const budgetId = existing?.budgetId && existing.status !== 'left' && existing.status !== 'revoked'
      ? existing.budgetId
      : generateId();
    const from = existing?.sharedFromMonth || getCurrentMonth();
    const total = monthsFrom(stateRef.current.budgets, from).length;
    const next: BudgetThreadState = {
      budgetId,
      role: 'owner',
      ownerPubkey: user.pubkey,
      partnerPubkey: existing?.status === 'accepted' ? existing.partnerPubkey : undefined,
      status: existing?.status === 'accepted' ? 'accepted' : 'pending',
      acceptedAt: existing?.status === 'accepted' ? existing.acceptedAt : undefined,
      sharedFromMonth: from,
      expectedMonths: total,
      sentMonths: existing?.sentMonths,
      updatedAt: Date.now(),
      appliedNoteIds: existing?.appliedNoteIds || [],
      unsyncedNotes: existing?.unsyncedNotes || [],
    };
    stateRef.current = { ...stateRef.current, budgetThread: next };
    setState((prev) => ({ ...prev, budgetThread: next }));
    return `satsorter:join:${budgetId}:${user.pubkey}:${total}:${from}`;
  }, [setState, user]);

  // Record a baseline once, after the saved budget is on screen.
  useEffect(() => {
    if (!isLeader || readyRef.current) return;
    if (!state.budgets) return;
    baselineRef.current = JSON.stringify(state.budgets);
    readyRef.current = true;
  }, [isLeader, state.budgets]);

  // Turn local edits into notes once a partner is connected.
  useEffect(() => {
    if (!isLeader || !readyRef.current || !user) return;
    const current = state.budgetThread;
    if (!current || (current.status !== 'accepted' && current.status !== 'pending')) return;
    if (!current.partnerPubkey && current.status !== 'accepted') return;
    const serialized = JSON.stringify(state.budgets);
    if (serialized === baselineRef.current) return;
    const timer = setTimeout(() => {
      const latest = JSON.stringify(stateRef.current.budgets);
      if (latest === baselineRef.current) return;
      const threadNow = stateRef.current.budgetThread;
      if (!threadNow) return;
      let previous: BudgetState['budgets'] = [];
      try { previous = JSON.parse(baselineRef.current || '[]'); } catch { previous = []; }
      const notes = diffAgainstBase(previous, stateRef.current.budgets, user.pubkey, threadNow.budgetId, Date.now())
        .map((note) => ({ ...note, id: generateId() }))
        .filter((note) => !threadNow.sharedFromMonth || note.month >= threadNow.sharedFromMonth);
      baselineRef.current = latest;
      if (notes.length === 0) return;
      updateThread((threadState) => {
        const entityClock = { ...(threadState.entityClock || {}) };
        for (const note of notes) {
          const key = `${note.month}:${note.entity}:${note.entityId}`;
          entityClock[key] = Math.max(entityClock[key] ?? 0, note.at);
        }
        return {
          ...threadState,
          entityClock,
          appliedNoteIds: Array.from(new Set([...threadState.appliedNoteIds, ...notes.map((note) => note.id)])),
          unsyncedNotes: [...threadState.unsyncedNotes, ...notes],
        };
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [isLeader, state.budgets, state.budgetThread, updateThread, user]);

  const pull = useCallback(async (preset?: any[]) => {
    if (!user?.signer) {
      console.warn('[BudgetPartners] cannot look yet, login is not ready');
      return;
    }
    let events = preset;
    if (!events) {
      const last = stateRef.current.budgetThread?.lastPullSec;
      const since = last ? Math.max(0, last - 120) : Math.floor(Date.now() / 1000) - 60 * 60 * 12;
      console.log('[BudgetPartners] looking for changes');
      events = await querySharedRelays({ kinds: [KIND], '#p': [user.pubkey], since, limit: 80 }, 12000);
      console.log('[BudgetPartners] found', events.length, 'saved events');
    }
    const tagged = events
      .filter((event) => event.tags?.some((tag: string[]) => tag[0] === 't' && tag[1] === TAG))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    const current = stateRef.current.budgetThread;
    const notes: BudgetNote[] = [];
    const monthsByKey = new Map<string, BudgetCheckpoint['budgets'][number]>();
    let acceptedPartner = '';
    let announcedTotal = 0;
    let announcedFrom = '';
    let sawLeaveAt: number | null = null;
    let selfRecord: { at: number; thread: BudgetThreadState } | null = null;

    const parsed: Array<{ event: any; body: any; eventBudgetId?: string }> = [];
    for (const event of tagged) {
      if (event?.id && seenEventsRef.current.has(event.id)) continue;
      const body = await decrypt(user.signer, event.pubkey, event.content);
      if (!body?.type) continue;
      if (event?.id) seenEventsRef.current.add(event.id);
      const taggedBudgetId = event.tags?.find((tag: string[]) => tag[0] === 'b')?.[1];
      parsed.push({
        event,
        body,
        eventBudgetId: body.budgetId || body.note?.budgetId || body.notes?.[0]?.budgetId || taggedBudgetId,
      });
    }

    let active = current && (current.status === 'pending' || current.status === 'accepted') ? current : null;
    if (!active) {
      const endedAt = new Map<string, number>();
      for (const item of parsed) {
        if ((item.body.type === 'revoke' || item.body.type === 'leave') && item.eventBudgetId) {
          endedAt.set(item.eventBudgetId, Math.max(endedAt.get(item.eventBudgetId) || 0, item.body.endedAt || item.event.created_at * 1000));
        }
      }
      let best: (typeof parsed)[number] | null = null;
      for (const item of parsed) {
        if (item.body.type !== 'checkpoint' || !item.eventBudgetId || item.event.pubkey === user.pubkey) continue;
        const at = (item.event.created_at || 0) * 1000;
        if ((endedAt.get(item.eventBudgetId) || 0) > at) continue;
        if (!best || at > (best.event.created_at || 0) * 1000) best = item;
      }
      if (best?.eventBudgetId) {
        const owner = best.body.checkpoint?.authorPubkey || best.event.pubkey;
        active = {
          budgetId: best.eventBudgetId,
          role: 'partner',
          ownerPubkey: owner,
          partnerPubkey: owner,
          status: 'accepted',
          acceptedAt: Date.now(),
          sharedFromMonth: typeof best.body.sharedFromMonth === 'string' ? best.body.sharedFromMonth : undefined,
          expectedMonths: typeof best.body.monthCount === 'number' ? best.body.monthCount : undefined,
          receivedMonths: 0,
          appliedNoteIds: current?.appliedNoteIds || [],
          unsyncedNotes: [],
        };
        stateRef.current = { ...stateRef.current, budgetThread: active };
        setState((prev) => ({ ...prev, budgetThread: active! }));
      }
    }

    for (const { event, body } of parsed) {
      if (body.type !== 'self' || event.pubkey !== user.pubkey || !body.thread?.budgetId) continue;
      const at = typeof body.at === 'number' ? body.at : (event.created_at || 0) * 1000;
      if (!selfRecord || at > selfRecord.at) selfRecord = { at, thread: body.thread as BudgetThreadState };
    }
    if (selfRecord && selfRecord.at > (stateRef.current.budgetThread?.updatedAt || 0)) {
      const incoming = selfRecord.thread;
      const same = !!active
        && active.budgetId === incoming.budgetId
        && active.status === incoming.status
        && active.partnerPubkey === incoming.partnerPubkey
        && active.role === incoming.role;
      if (!same && (incoming.status === 'accepted' || incoming.status === 'pending' || incoming.status === 'left' || incoming.status === 'revoked')) {
        const next: BudgetThreadState = {
          budgetId: incoming.budgetId,
          role: incoming.role === 'partner' ? 'partner' : 'owner',
          ownerPubkey: String(incoming.ownerPubkey || ''),
          partnerPubkey: incoming.partnerPubkey,
          status: incoming.status,
          acceptedAt: incoming.acceptedAt,
          endedAt: incoming.endedAt,
          sharedFromMonth: incoming.sharedFromMonth,
          updatedAt: selfRecord.at,
          entityClock: active?.entityClock && Object.keys(active.entityClock).length > 0 ? active.entityClock : seedClocks(stateRef.current.budgets),
          catchUpDone: active?.catchUpDone,
          expectedMonths: active?.expectedMonths,
          receivedMonths: active?.receivedMonths,
          sentMonths: active?.sentMonths,
          appliedNoteIds: active?.appliedNoteIds || [],
          unsyncedNotes: active?.unsyncedNotes || [],
        };
        active = next.status === 'pending' || next.status === 'accepted' ? next : null;
        stateRef.current = { ...stateRef.current, budgetThread: next };
        setState((prev) => ({ ...prev, budgetThread: next }));
      }
    }

    for (const { event, body, eventBudgetId } of parsed) {
      if (body.type === 'invite' && body.ownerPubkey !== user.pubkey) {
        setIncomingInvite({
          budgetId: body.budgetId,
          ownerPubkey: body.ownerPubkey,
          monthCount: body.monthCount || 0,
          eventId: event.id,
        });
      }
      if (!active || eventBudgetId !== active.budgetId) continue;
      if (body.type === 'accept' && active.role === 'owner' && active.status === 'pending') {
        acceptedPartner = body.partnerPubkey as string;
      }
      if (body.type === 'note' && body.note?.id) notes.push(body.note as BudgetNote);
      if (body.type === 'notes' && Array.isArray(body.notes)) {
        for (const item of body.notes) {
          if (item?.id) notes.push(item as BudgetNote);
        }
      }
      if (body.type === 'checkpoint' && body.checkpoint?.budgets) {
        if (typeof body.monthCount === 'number') announcedTotal = Math.max(announcedTotal, body.monthCount);
        if (typeof body.sharedFromMonth === 'string') announcedFrom = body.sharedFromMonth;
        for (const month of body.checkpoint.budgets as BudgetCheckpoint['budgets']) {
          if (!month?.month) continue;
          const previous = monthsByKey.get(month.month);
          if (!previous || (month.updatedAt || 0) >= (previous.updatedAt || 0)) monthsByKey.set(month.month, month);
        }
      }
      if (body.type === 'revoke' || body.type === 'leave') sawLeaveAt = body.endedAt || Date.now();
    }

    if (active?.role === 'owner' && (active.status === 'pending' || active.status === 'accepted') && !acceptedPartner) {
      const other = notes.find((note) => note.budgetId === active.budgetId && note.authorPubkey && note.authorPubkey !== user.pubkey);
      if (other && !active.partnerPubkey) acceptedPartner = other.authorPubkey;
    }

    if (acceptedPartner && active?.role === 'owner' && (active.status === 'pending' || !active.partnerPubkey)) {
      const from = active.sharedFromMonth || getCurrentMonth();
      const shareCount = monthsFrom(stateRef.current.budgets, from).length;
      const next: BudgetThreadState = {
        ...active,
        partnerPubkey: acceptedPartner,
        status: 'accepted',
        acceptedAt: Date.now(),
        updatedAt: Date.now(),
        sharedFromMonth: from,
        sentMonths: 0,
        expectedMonths: shareCount,
      };
      stateRef.current = { ...stateRef.current, budgetThread: next };
      setState((prev) => ({ ...prev, budgetThread: next }));
      toast({ title: 'Connected', description: 'Transactions logged on either phone will show up on the other.' });
    }

    const latest = stateRef.current.budgetThread;
    if (!latest) return;
    if (sawLeaveAt && latest.status === 'accepted') {
      updateThread({ status: 'left', endedAt: sawLeaveAt, updatedAt: sawLeaveAt, unsyncedNotes: [] });
      return;
    }

    if (latest.role === 'partner' && (monthsByKey.size > 0 || monthStoreRef.current.size > 0)) {
      if (monthStoreBudgetRef.current !== latest.budgetId) {
        monthStoreRef.current = new Map();
        monthStoreBudgetRef.current = latest.budgetId;
      }
      for (const [month, budget] of monthsByKey) {
        const previous = monthStoreRef.current.get(month);
        if (!previous || (budget.updatedAt || 0) >= (previous.updatedAt || 0)) monthStoreRef.current.set(month, budget);
      }
      const from = announcedFrom || latest.sharedFromMonth || '';
      const incomingMonths = [...monthStoreRef.current.values()].filter((month) => !from || month.month >= from);
      console.log('[BudgetPartners] received', incomingMonths.length, 'of', Math.max(latest.expectedMonths || 0, announcedTotal), 'months');
      const signature = incomingMonths
        .map((month) => `${month.month}:${month.updatedAt || 0}:${(month.transactions || []).length}:${(month.buckets || []).length}`)
        .sort()
        .join('|');
      if (signature && signature !== monthSigRef.current) {
        monthSigRef.current = signature;
        const clocks = { ...(latest.entityClock || {}) };
        const incomingIds = new Set(incomingMonths.map((month) => month.month));
        const localForIncoming = stateRef.current.budgets.filter((month) => incomingIds.has(month.month));
        const extras = extrasAgainstBase(incomingMonths, localForIncoming, user.pubkey, latest.budgetId, Date.now());
        const earlier = stateRef.current.budgets.filter((month) => from && month.month < from);
        const notYet = stateRef.current.budgets.filter((month) => (!from || month.month >= from) && !incomingIds.has(month.month));
        const merged = [...earlier, ...notYet, ...applyNotes(incomingMonths, extras, clocks)];
        const expected = Math.max(latest.expectedMonths || 0, announcedTotal, incomingMonths.length);
        baselineRef.current = JSON.stringify(merged);
        const nextThread: BudgetThreadState = {
          ...latest,
          status: 'accepted',
          acceptedAt: latest.acceptedAt || Date.now(),
          receivedMonths: incomingMonths.length,
          expectedMonths: expected,
          sharedFromMonth: from || latest.sharedFromMonth,
          entityClock: clocks,
          appliedNoteIds: Array.from(new Set([...latest.appliedNoteIds, ...extras.map((note) => note.id)])),
          unsyncedNotes: latest.unsyncedNotes,
        };
        stateRef.current = { ...stateRef.current, budgets: merged, budgetThread: nextThread };
        setState((prev) => ({ ...prev, budgets: merged, budgetThread: nextThread }));
      } else if (latest.status !== 'accepted') {
        const nextThread: BudgetThreadState = { ...latest, status: 'accepted', acceptedAt: latest.acceptedAt || Date.now() };
        stateRef.current = { ...stateRef.current, budgetThread: nextThread };
        setState((prev) => ({ ...prev, budgetThread: nextThread }));
      }
    }

    const shareable = monthsFrom(stateRef.current.budgets, stateRef.current.budgetThread?.sharedFromMonth || getCurrentMonth());
    const sendingThread = stateRef.current.budgetThread;
    if (sendingThread?.role === 'owner' && sendingThread.status === 'accepted' && sendingThread.partnerPubkey && !sendingRef.current && (sendingThread.sentMonths || 0) < shareable.length) {
      sendingRef.current = true;
      void sendMonths(sendingThread, sendingThread.partnerPubkey).finally(() => {
        sendingRef.current = false;
      });
    }

    const applied = new Set(stateRef.current.budgetThread?.appliedNoteIds || []);
    const members = stateRef.current.budgetThread ? membershipOf(stateRef.current.budgetThread) : null;
    const clocks = { ...(stateRef.current.budgetThread?.entityClock || {}) };
    const fresh = notes.filter((note) => note.budgetId === stateRef.current.budgetThread?.budgetId && !applied.has(note.id) && (!members || noteIsActive(members, note) || note.authorPubkey === user.pubkey));
    if (fresh.length > 0) {
      const merged = applyNotes(stateRef.current.budgets, fresh, clocks);
      const fromPartner = fresh.filter((note) => note.authorPubkey !== user.pubkey);
      console.log('[BudgetPartners] applied', fresh.length, 'change(s),', fromPartner.length, 'from the other phone');
      const ids = Array.from(new Set([...(stateRef.current.budgetThread?.appliedNoteIds || []), ...fresh.map((note) => note.id)]));
      baselineRef.current = JSON.stringify(merged);
      const nextThread = stateRef.current.budgetThread
        ? { ...stateRef.current.budgetThread, appliedNoteIds: ids, entityClock: clocks }
        : stateRef.current.budgetThread;
      stateRef.current = { ...stateRef.current, budgets: merged, budgetThread: nextThread };
      setState((prev) => ({
        ...prev,
        budgets: merged,
        budgetThread: prev.budgetThread
          ? { ...prev.budgetThread, appliedNoteIds: ids, entityClock: clocks }
          : prev.budgetThread,
      }));
      if (fresh.some((note) => note.authorPubkey !== user.pubkey)) {
        toast({ title: 'Budget updated', description: 'A change arrived from your budget partner.' });
      }
    } else if (!preset) {
      console.log('[BudgetPartners] read', notes.length, 'changes, none were new');
    }
    if (!preset) {
      const pulledAt = Math.floor(Date.now() / 1000);
      const currentThread = stateRef.current.budgetThread;
      if (currentThread && (events.length > 0 || currentThread.lastPullSec)) {
        updateThread({ lastPullSec: pulledAt });
      }
    }
  }, [sendMonths, setState, toast, updateThread, user]);

  pullRef.current = pull;

  const enqueuePull = useCallback((preset?: any[]) => {
    applyChainRef.current = applyChainRef.current
      .then(() => pull(preset))
      .catch((error) => console.warn('[BudgetThread] sync failed', error));
  }, [pull]);

  const waiting = thread?.status === 'pending' || (thread?.status === 'accepted' && (thread.sentMonths || 0) < (thread.expectedMonths || 0));
  const unsyncedKey = (thread?.unsyncedNotes || []).map((note) => note.id).join(',');

  // A normal edit after the two phones are connected is what syncs.
  // Do not queue the whole history. That backlog was 339 notes and it blocked
  // the one new transaction from being sent.
  useEffect(() => {
    if (!isLeader || !readyRef.current || !user) return;
    const current = stateRef.current.budgetThread;
    if (!current?.partnerPubkey) return;
    if (current.status !== 'accepted' && current.status !== 'pending') return;
    if (current.catchUpDone || caughtUpRef.current === current.budgetId) return;
    caughtUpRef.current = current.budgetId;
    updateThread((threadState) => ({
      ...threadState,
      catchUpDone: true,
      unsyncedNotes: threadState.unsyncedNotes.filter((note) => !note.id.startsWith('catch-') && !note.id.startsWith('migrate-')),
    }));
  }, [isLeader, state.budgetThread?.budgetId, state.budgetThread?.partnerPubkey, state.budgetThread?.status, updateThread, user]);

  // Publish queued notes as soon as they exist. This is what makes a new transaction show up
  // on the other phone without waiting for a poll.
  useEffect(() => {
    if (!isLeader || !user?.signer || !unsyncedKey) return;
    let cancelled = false;
    const send = () => {
      if (cancelled) return;
      const latestThread = stateRef.current.budgetThread;
      const queued = (latestThread?.unsyncedNotes || []) as BudgetNote[];
      if (!latestThread || queued.length === 0 || notesLockRef.current) return;
      if (!latestThread.partnerPubkey) return;
      if (latestThread.status !== 'accepted' && latestThread.status !== 'pending') return;
      const stale = queued.some((note) => note.id.startsWith('catch-') || note.id.startsWith('migrate-'));
      if (stale) {
        updateThread((threadState) => ({
          ...threadState,
          unsyncedNotes: threadState.unsyncedNotes.filter((note) => !note.id.startsWith('catch-') && !note.id.startsWith('migrate-')),
        }));
      }
      const notes = queued
        .filter((note) => !note.id.startsWith('catch-') && !note.id.startsWith('migrate-'))
        .sort((a, b) => b.at - a.at)
        .slice(0, 20);
      if (notes.length === 0) return;
      notesLockRef.current = true;
      console.log('[BudgetPartners] sending', notes.length, 'change(s)');
      void publishToThread(latestThread, notes).then((ok) => {
        console.log('[BudgetPartners] send result', ok ? 'ok' : 'failed', notes.length);
        if (!ok) return;
        const sent = new Set(notes.map((note) => note.id));
        updateThread((threadState) => ({
          ...threadState,
          unsyncedNotes: threadState.unsyncedNotes.filter((note) => !sent.has(note.id)),
        }));
      }).catch((error) => {
        console.warn('[BudgetPartners] send failed', error);
      }).finally(() => {
        notesLockRef.current = false;
      });
    };
    const timer = setTimeout(send, 400);
    const retry = setInterval(send, 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(retry);
    };
  }, [isLeader, publishToThread, unsyncedKey, updateThread, user]);

  useEffect(() => {
    if (!isLeader || !user) return;
    let stop = () => {};
    const listen = () => {
      stop();
      const since = Math.floor(Date.now() / 1000) - 120;
      stop = subscribeSharedRelays(
        { kinds: [KIND], '#p': [user.pubkey], since },
        (event) => {
          const tags = event?.tags || [];
          if (!tags.some((tag: string[]) => tag[0] === 't' && tag[1] === TAG)) return;
          enqueuePull([event]);
        },
      );
    };
    listen();
    enqueuePull();
    const timer = setInterval(() => { enqueuePull(); }, waiting ? 4000 : 20000);
    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      listen();
      enqueuePull();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
      stop();
    };
  }, [enqueuePull, isLeader, user, waiting]);

  useEffect(() => {
    if (!isLeader || !user?.signer || !thread?.budgetId) return;
    if (thread.status !== 'pending' && thread.status !== 'accepted' && thread.status !== 'left' && thread.status !== 'revoked') return;
    const snapshot = thread;
    const signer = user.signer;
    const pubkey = user.pubkey;
    const timer = setTimeout(() => {
      const at = snapshot.updatedAt || Date.now();
      void publishEncrypted(
        signer,
        pubkey,
        `sat-sorter/thread-self/${at}`,
        {
          type: 'self',
          at,
          budgetId: snapshot.budgetId,
          thread: {
            budgetId: snapshot.budgetId,
            role: snapshot.role,
            ownerPubkey: snapshot.ownerPubkey,
            partnerPubkey: snapshot.partnerPubkey,
            status: snapshot.status,
            sharedFromMonth: snapshot.sharedFromMonth,
            acceptedAt: snapshot.acceptedAt,
            endedAt: snapshot.endedAt,
            updatedAt: at,
          },
        },
        [['b', snapshot.budgetId]],
      ).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [isLeader, thread?.acceptedAt, thread?.budgetId, thread?.endedAt, thread?.partnerPubkey, thread?.role, thread?.sharedFromMonth, thread?.status, thread?.updatedAt, user]);

  return {
    thread,
    incomingInvite,
    busy,
    unsyncedCount: thread?.unsyncedNotes.length || 0,
    invitePartner,
    joinBudget,
    revokeInvite,
    leaveOrRemove,
    resetPartnerConnection,
    showJoinCode,
    dismissInvite: () => setIncomingInvite(null),
  };
}
