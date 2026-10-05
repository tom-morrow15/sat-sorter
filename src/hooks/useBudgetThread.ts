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
  if ((thread.status === 'pending' || thread.status === 'accepted') && thread.partnerPubkey) {
    targets.add(thread.partnerPubkey);
  }
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

export function parsePartnerInput(raw: string): { pubkey?: string; join?: { budgetId: string; ownerPubkey: string } } {
  const value = raw.trim().replace(/^nostr:/, '');
  if (value.startsWith('satsorter:join:')) {
    const [, , budgetId, ownerPubkey] = value.split(':');
    if (budgetId && ownerPubkey) return { join: { budgetId, ownerPubkey } };
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
          { type: 'checkpoint', checkpoint },
          [['b', current.budgetId]],
        );
      }
    }
    return ok;
  }, [user]);

  const invitePartner = useCallback(async (raw: string) => {
    if (!user?.signer) throw new Error('Log in before inviting a partner');
    const parsed = parsePartnerInput(raw);
    if (parsed.join) {
      await joinBudget(parsed.join.budgetId, parsed.join.ownerPubkey);
      return;
    }
    if (!parsed.pubkey) throw new Error('Enter her npub, or scan her profile QR');
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
      const checkpoint: BudgetCheckpoint = {
        authorPubkey: user.pubkey,
        budgets: stateRef.current.budgets,
        appliedNoteIds: next.appliedNoteIds,
      };
      await publishEncrypted(
        user.signer,
        parsed.pubkey,
        `sat-sorter/thread-checkpoint/${budgetId}/${user.pubkey}/${parsed.pubkey.slice(0, 8)}`,
        { type: 'checkpoint', checkpoint },
        [['b', budgetId]],
      );
      await publishEncrypted(
        user.signer,
        user.pubkey,
        `sat-sorter/thread-checkpoint/${budgetId}/${user.pubkey}/${user.pubkey.slice(0, 8)}`,
        { type: 'checkpoint', checkpoint },
        [['b', budgetId]],
      );
      setState((prev) => ({ ...prev, budgetThread: next }));
      baselineRef.current = JSON.stringify(stateRef.current.budgets);
      readyRef.current = true;
    } finally {
      setBusy(false);
    }
  }, [setState, user]);

  const joinBudget = useCallback(async (budgetId: string, ownerPubkey: string) => {
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
      setState((prev) => ({
        ...prev,
        budgetThread: {
          budgetId,
          role: 'partner',
          ownerPubkey,
          partnerPubkey: user.pubkey,
          status: 'pending',
          appliedNoteIds: prev.budgetThread?.appliedNoteIds || [],
          unsyncedNotes: [],
        },
      }));
      setIncomingInvite(null);
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
    const budgetId = existing?.budgetId || generateId();
    const next: BudgetThreadState = {
      budgetId,
      role: 'owner',
      ownerPubkey: user.pubkey,
      partnerPubkey: existing?.partnerPubkey,
      status: existing?.status === 'accepted' ? 'accepted' : 'pending',
      acceptedAt: existing?.acceptedAt,
      appliedNoteIds: existing?.appliedNoteIds || [],
      unsyncedNotes: existing?.unsyncedNotes || [],
    };
    setState((prev) => ({ ...prev, budgetThread: next }));
    if (user.signer) {
      const checkpoint: BudgetCheckpoint = {
        authorPubkey: user.pubkey,
        budgets: stateRef.current.budgets,
        appliedNoteIds: next.appliedNoteIds,
      };
      await publishEncrypted(
        user.signer,
        user.pubkey,
        `sat-sorter/thread-checkpoint/${budgetId}/${user.pubkey}/${user.pubkey.slice(0, 8)}`,
        { type: 'checkpoint', checkpoint },
        [['b', budgetId]],
      );
    }
    return `satsorter:join:${budgetId}:${user.pubkey}`;
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
    let checkpoint: BudgetCheckpoint | null = null;
    let sawLeaveAt: number | null = null;

    for (const event of events) {
      const body = await decrypt(user.signer, event.pubkey, event.content);
      if (!body?.type) continue;
      if (body.type === 'invite' && body.ownerPubkey !== user.pubkey) {
        setIncomingInvite({
          budgetId: body.budgetId,
          ownerPubkey: body.ownerPubkey,
          monthCount: body.monthCount || 0,
          eventId: event.id,
        });
      }
      if (!current || body.budgetId !== current.budgetId) continue;
      if (body.type === 'accept' && current.role === 'owner' && current.status === 'pending') {
        const partnerPubkey = body.partnerPubkey as string;
        const acceptedAt = Date.now();
        setState((prev) => ({
          ...prev,
          budgetThread: prev.budgetThread
            ? { ...prev.budgetThread, partnerPubkey, status: 'accepted', acceptedAt }
            : prev.budgetThread,
        }));
        const saved: BudgetCheckpoint = {
          authorPubkey: user.pubkey,
          budgets: stateRef.current.budgets,
          appliedNoteIds: current.appliedNoteIds,
        };
        await publishEncrypted(
          user.signer,
          partnerPubkey,
          `sat-sorter/thread-checkpoint/${current.budgetId}/${user.pubkey}/${partnerPubkey.slice(0, 8)}`,
          { type: 'checkpoint', checkpoint: saved },
          [['b', current.budgetId]],
        );
      }
      if (body.type === 'note' && body.note?.id) notes.push(body.note as BudgetNote);
      if (body.type === 'checkpoint' && body.checkpoint?.budgets) {
        const incoming = body.checkpoint as BudgetCheckpoint;
        if (!checkpoint || incoming.appliedNoteIds.length > checkpoint.appliedNoteIds.length) checkpoint = incoming;
      }
      if (body.type === 'revoke' || body.type === 'leave') sawLeaveAt = body.endedAt || Date.now();
    }

    const latest = stateRef.current.budgetThread;
    if (!latest) return;
    if (sawLeaveAt && latest.status === 'accepted') {
      updateThread({ status: 'left', endedAt: sawLeaveAt, unsyncedNotes: [] });
      return;
    }

    if (latest.role === 'partner' && latest.status === 'pending' && checkpoint && checkpoint.authorPubkey === latest.ownerPubkey) {
      const extras = extrasAgainstBase(checkpoint.budgets, stateRef.current.budgets, user.pubkey, latest.budgetId, Date.now());
      const merged = applyNotes(checkpoint.budgets, extras);
      const applied = Array.from(new Set([...checkpoint.appliedNoteIds, ...extras.map((note) => note.id)]));
      baselineRef.current = JSON.stringify(merged);
      setState((prev) => ({
        ...prev,
        budgets: merged,
        budgetThread: prev.budgetThread
          ? { ...prev.budgetThread, status: 'accepted', acceptedAt: Date.now(), appliedNoteIds: applied, unsyncedNotes: extras }
          : prev.budgetThread,
      }));
      return;
    }

    if (stateRef.current.budgets.length === 0 && checkpoint) {
      baselineRef.current = JSON.stringify(checkpoint.budgets);
      setState((prev) => ({
        ...prev,
        budgets: checkpoint!.budgets,
        budgetThread: prev.budgetThread
          ? { ...prev.budgetThread, appliedNoteIds: Array.from(new Set([...(prev.budgetThread.appliedNoteIds || []), ...checkpoint!.appliedNoteIds])) }
          : prev.budgetThread,
      }));
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
  }, [publishToThread, setState, toast, updateThread, user]);

  useEffect(() => {
    if (!isLeader || !user) return;
    void pull();
    const timer = setInterval(() => { void pull(); }, 15000);
    const onFocus = () => { void pull(); };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isLeader, pull, user]);

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
