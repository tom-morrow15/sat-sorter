import { useCallback, useEffect, useRef, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useToast } from '@/hooks/useToast';
import { generateId, type BudgetState, type BudgetThreadState } from '@/lib/budgetTypes';
import {
  applyNotes,
  diffAgainstBase,
  extrasAgainstBase,
  noteIsActive,
  type BudgetCheckpoint,
  type BudgetNote,
  type Membership,
} from '@/lib/budgetThread';
import { publishToSharedRelays, querySharedRelays } from '@/hooks/useSharedBudgetSync';

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
  return {
    ownerPubkey: thread.ownerPubkey,
    active: thread.status === 'accepted' && partner ? [{ pubkey: partner, at: thread.acceptedAt || 0 }] : [],
    pending: [],
    revoked: [],
    former: thread.status === 'left' && partner
      ? [{ pubkey: partner, at: thread.endedAt || 0, joinedAt: thread.acceptedAt || 0 }]
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

export function parsePartnerInput(raw: string): { pubkey?: string; join?: { budgetId: string; ownerPubkey: string; monthCount?: number } } {
  const value = raw.trim().replace(/^nostr:/, '');
  if (value.startsWith('satsorter:join:')) {
    const parts = value.split(':');
    const budgetId = parts[2];
    const ownerPubkey = parts[3];
    const monthCount = Number(parts[4]);
    if (budgetId && ownerPubkey) {
      return { join: { budgetId, ownerPubkey, monthCount: Number.isFinite(monthCount) ? monthCount : undefined } };
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
    for (const note of notes) {
      for (const recipient of targets) {
        const sent = await publishEncrypted(
          user.signer,
          recipient,
          `sat-sorter/thread-note/${current.budgetId}/${note.id}/${recipient.slice(0, 8)}`,
          { type: 'note', note },
          [['b', current.budgetId]],
        );
        ok = ok && sent;
      }
    }
    if (ok) {
      const checkpoint: BudgetCheckpoint = {
        authorPubkey: user.pubkey,
        budgets: stateRef.current.budgets,
        appliedNoteIds: Array.from(new Set([...(current.appliedNoteIds || []), ...notes.map((note) => note.id)])),
      };
      for (const recipient of targets) {
        await publishEncrypted(
          user.signer,
          recipient,
          `sat-sorter/thread-checkpoint/${current.budgetId}/${user.pubkey}/${recipient.slice(0, 8)}`,
          { type: 'checkpoint', budgetId: current.budgetId, checkpoint },
          [['b', current.budgetId]],
        );
      }
    }
    return ok;
  }, [user]);

  const sendMonths = useCallback(async (current: BudgetThreadState, recipient: string) => {
    if (!user?.signer) return false;
    const months = stateRef.current.budgets;
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
          checkpoint: {
            authorPubkey: user.pubkey,
            budgets: [month],
            appliedNoteIds: current.appliedNoteIds,
          },
        },
        [['b', current.budgetId]],
      );
      if (sent) done += 1;
      updateThread({ sentMonths: Math.min(done, months.length), expectedMonths: months.length });
    }
    return done >= months.length;
  }, [updateThread, user]);

  const invitePartner = useCallback(async (raw: string) => {
    if (!user?.signer) throw new Error('Log in before inviting a partner');
    const parsed = parsePartnerInput(raw);
      if (parsed.join) {
        await joinBudget(parsed.join.budgetId, parsed.join.ownerPubkey, parsed.join.monthCount);
        return;
      }
    if (!parsed.pubkey) throw new Error('Enter an npub, or scan an npub or join code');
    if (parsed.pubkey === user.pubkey) throw new Error('That is your own npub');
    setBusy(true);
    try {
      const existing = stateRef.current.budgetThread;
      const budgetId = existing?.budgetId || generateId();
      const next: BudgetThreadState = {
        budgetId,
        role: 'owner',
        ownerPubkey: user.pubkey,
        partnerPubkey: parsed.pubkey,
        status: 'pending',
        appliedNoteIds: existing?.appliedNoteIds || [],
        unsyncedNotes: existing?.unsyncedNotes || [],
      };
      const monthCount = stateRef.current.budgets.length;
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
      if (!delivered) throw new Error('The invite was sent, but the budget did not finish sending. Keep Sat Sorter open.');
      baselineRef.current = JSON.stringify(stateRef.current.budgets);
      readyRef.current = true;
    } finally {
      setBusy(false);
    }
  }, [sendMonths, setState, user]);

  const joinBudget = useCallback(async (budgetId: string, ownerPubkey: string, monthCount?: number) => {
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
        status: 'pending',
        expectedMonths: monthCount,
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
      updateThread({ status: 'revoked', endedAt: Date.now(), partnerPubkey: undefined, unsyncedNotes: [] });
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
      updateThread({ status: 'left', endedAt, unsyncedNotes: [] });
    } finally {
      setBusy(false);
    }
  }, [updateThread, user]);

  const showJoinCode = useCallback(async () => {
    if (!user) throw new Error('Log in first');
    const existing = stateRef.current.budgetThread;
    const budgetId = existing?.budgetId && existing.status !== 'left' && existing.status !== 'revoked'
      ? existing.budgetId
      : generateId();
    const total = stateRef.current.budgets.length;
    const next: BudgetThreadState = {
      budgetId,
      role: 'owner',
      ownerPubkey: user.pubkey,
      partnerPubkey: existing?.status === 'accepted' ? existing.partnerPubkey : undefined,
      status: existing?.status === 'accepted' ? 'accepted' : 'pending',
      acceptedAt: existing?.status === 'accepted' ? existing.acceptedAt : undefined,
      expectedMonths: total,
      sentMonths: existing?.sentMonths,
      appliedNoteIds: existing?.appliedNoteIds || [],
      unsyncedNotes: existing?.unsyncedNotes || [],
    };
    stateRef.current = { ...stateRef.current, budgetThread: next };
    setState((prev) => ({ ...prev, budgetThread: next }));
    return `satsorter:join:${budgetId}:${user.pubkey}:${total}`;
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
        .map((note) => ({ ...note, id: generateId() }));
      baselineRef.current = latest;
      if (notes.length === 0) return;
      updateThread((threadState) => ({
        ...threadState,
        appliedNoteIds: Array.from(new Set([...threadState.appliedNoteIds, ...notes.map((note) => note.id)])),
        unsyncedNotes: [...threadState.unsyncedNotes, ...notes],
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isLeader, state.budgets, state.budgetThread, updateThread, user]);

  const pull = useCallback(async () => {
    if (!user?.signer) return;
    const events = await querySharedRelays({ kinds: [KIND], '#p': [user.pubkey], '#t': [TAG], limit: 300 }, 8000);
    const current = stateRef.current.budgetThread;
    const notes: BudgetNote[] = [];
    const monthsByKey = new Map<string, BudgetCheckpoint['budgets'][number]>();
    let acceptedPartner = '';
    let announcedTotal = 0;
    let sawLeaveAt: number | null = null;

    for (const event of events) {
      const body = await decrypt(user.signer, event.pubkey, event.content);
      if (!body?.type) continue;
      const taggedBudgetId = event.tags?.find((tag: string[]) => tag[0] === 'b')?.[1];
      const eventBudgetId = body.budgetId || body.note?.budgetId || taggedBudgetId;
      if (body.type === 'invite' && body.ownerPubkey !== user.pubkey) {
        setIncomingInvite({
          budgetId: body.budgetId,
          ownerPubkey: body.ownerPubkey,
          monthCount: body.monthCount || 0,
          eventId: event.id,
        });
      }
      if (!current || eventBudgetId !== current.budgetId) continue;
      if (body.type === 'accept' && current.role === 'owner' && current.status === 'pending') {
        acceptedPartner = body.partnerPubkey as string;
      }
      if (body.type === 'note' && body.note?.id) notes.push(body.note as BudgetNote);
      if (body.type === 'checkpoint' && body.checkpoint?.budgets) {
        if (typeof body.monthCount === 'number') announcedTotal = Math.max(announcedTotal, body.monthCount);
        for (const month of body.checkpoint.budgets as BudgetCheckpoint['budgets']) {
          if (!month?.month) continue;
          const previous = monthsByKey.get(month.month);
          if (!previous || (month.updatedAt || 0) >= (previous.updatedAt || 0)) monthsByKey.set(month.month, month);
        }
      }
      if (body.type === 'revoke' || body.type === 'leave') sawLeaveAt = body.endedAt || Date.now();
    }

    if (acceptedPartner && current?.role === 'owner' && current.status === 'pending') {
      const next: BudgetThreadState = {
        ...current,
        partnerPubkey: acceptedPartner,
        status: 'accepted',
        acceptedAt: Date.now(),
        sentMonths: 0,
        expectedMonths: stateRef.current.budgets.length,
      };
      stateRef.current = { ...stateRef.current, budgetThread: next };
      setState((prev) => ({ ...prev, budgetThread: next }));
      toast({ title: 'They scanned the code', description: 'Sending the budget. Keep Sat Sorter open.' });
      sendingRef.current = true;
      try {
        const delivered = await sendMonths(next, acceptedPartner);
        toast(delivered
          ? { title: 'Connected', description: 'They can see this budget.' }
          : { title: 'The budget did not finish sending', description: 'Keep Sat Sorter open. It will try again.', variant: 'destructive' });
      } finally {
        sendingRef.current = false;
      }
    }

    const latest = stateRef.current.budgetThread;
    if (!latest) return;
    if (sawLeaveAt && latest.status === 'accepted') {
      updateThread({ status: 'left', endedAt: sawLeaveAt, unsyncedNotes: [] });
      return;
    }

    if (latest.role === 'partner' && monthsByKey.size > 0) {
      const incomingMonths = [...monthsByKey.values()];
      const extras = extrasAgainstBase(incomingMonths, stateRef.current.budgets, user.pubkey, latest.budgetId, Date.now());
      const merged = applyNotes(incomingMonths, extras);
      const expected = Math.max(latest.expectedMonths || 0, announcedTotal);
      const complete = expected > 0 && incomingMonths.length >= expected;
      const wasPending = latest.status === 'pending';
      baselineRef.current = JSON.stringify(merged);
      const nextThread: BudgetThreadState = {
        ...latest,
        status: complete ? 'accepted' : 'pending',
        acceptedAt: complete ? (latest.acceptedAt || Date.now()) : latest.acceptedAt,
        receivedMonths: incomingMonths.length,
        expectedMonths: expected,
        appliedNoteIds: Array.from(new Set([...latest.appliedNoteIds, ...extras.map((note) => note.id)])),
        unsyncedNotes: extras,
      };
      stateRef.current = { ...stateRef.current, budgets: merged, budgetThread: nextThread };
      setState((prev) => ({ ...prev, budgets: merged, budgetThread: nextThread }));
      if (complete && wasPending) {
        toast({ title: 'Connected', description: 'Their budget is on this phone.' });
      }
      return;
    }

    if (latest.role === 'owner' && latest.status === 'accepted' && latest.partnerPubkey && !sendingRef.current && (latest.sentMonths || 0) < stateRef.current.budgets.length) {
      sendingRef.current = true;
      try {
        await sendMonths(latest, latest.partnerPubkey);
      } finally {
        sendingRef.current = false;
      }
    }

    const applied = new Set(stateRef.current.budgetThread?.appliedNoteIds || []);
    const members = stateRef.current.budgetThread ? membershipOf(stateRef.current.budgetThread) : null;
    const fresh = notes.filter((note) => !applied.has(note.id) && (!members || noteIsActive(members, note) || note.authorPubkey === user.pubkey));
    if (fresh.length > 0) {
      const merged = applyNotes(stateRef.current.budgets, fresh);
      baselineRef.current = JSON.stringify(merged);
      setState((prev) => ({
        ...prev,
        budgets: merged,
        budgetThread: prev.budgetThread
          ? { ...prev.budgetThread, appliedNoteIds: Array.from(new Set([...prev.budgetThread.appliedNoteIds, ...fresh.map((note) => note.id)])) }
          : prev.budgetThread,
      }));
      if (fresh.some((note) => note.authorPubkey !== user.pubkey)) {
        toast({ title: 'Budget updated', description: 'A change arrived from your budget partner.' });
      }
    }

    const pendingNotes = (stateRef.current.budgetThread?.unsyncedNotes || []) as BudgetNote[];
    const threadNow = stateRef.current.budgetThread;
    if (threadNow && pendingNotes.length > 0 && (threadNow.status === 'accepted' || threadNow.partnerPubkey)) {
      const ok = await publishToThread(threadNow, pendingNotes);
      if (ok) updateThread({ unsyncedNotes: [] });
    }
  }, [publishToThread, sendMonths, setState, toast, updateThread, user]);

  pullRef.current = pull;

  const waiting = thread?.status === 'pending' || (thread?.status === 'accepted' && (thread.sentMonths || 0) < (thread.expectedMonths || 0));

  useEffect(() => {
    if (!isLeader || !user) return;
    void pull();
    const timer = setInterval(() => { void pull(); }, waiting ? 3000 : 15000);
    const onFocus = () => { void pull(); };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isLeader, pull, user, waiting]);

  return {
    thread,
    incomingInvite,
    busy,
    unsyncedCount: thread?.unsyncedNotes.length || 0,
    invitePartner,
    joinBudget,
    revokeInvite,
    leaveOrRemove,
    showJoinCode,
    dismissInvite: () => setIncomingInvite(null),
  };
}
