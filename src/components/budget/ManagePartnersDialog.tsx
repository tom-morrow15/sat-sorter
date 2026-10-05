import { useState } from 'react';
import { QrCode, Camera, Users, MoreVertical } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { usePartners } from '@/hooks/usePartners';
import { useSharedSync } from './PartnerSyncWrapper';
import { QRScanner } from './QRScanner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ManagePartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: 'owner' | 'editor' | 'viewer';
}

function PartnerLine({ pubkey, name }: { pubkey: string; name?: string }) {
  const profile = useAuthor(pubkey);
  const metadata = profile.data?.metadata;
  const label = metadata?.display_name || metadata?.name || name || `${nip19.npubEncode(pubkey).slice(0, 16)}…`;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={metadata?.picture} alt="" />
        <AvatarFallback className="text-xs">{label.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function PartnerMenu({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Partner options">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit connection</DropdownMenuItem>
        <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
          Remove partner
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ManagePartnersDialog({
  open,
  onOpenChange,
}: ManagePartnersDialogProps) {
  const { fullState } = useBudget();
  const { setState } = useBudgetContext();
  const { user } = useCurrentUser();
  const { partners: nostrPartners, removePartner: removeNostrPartner } = usePartners();
  const shared = useSharedSync();
  const threadApi = shared?.thread;
  const { toast } = useToast();
  const [npubInput, setNpubInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirm, setConfirm] = useState<'revoke' | 'stop' | null>(null);
  const [editing, setEditing] = useState(false);
  const [joinQr, setJoinQr] = useState('');

  const thread = threadApi?.thread;
  const incoming = threadApi?.incomingInvite;
  const newThreadActive = thread?.status === 'pending' || thread?.status === 'accepted';
  const txPartners = (fullState.budgets || []).flatMap((budget) =>
    (budget.transactions || [])
      .map((tx) => tx.partnerPubkey)
      .filter((pubkey): pubkey is string => !!pubkey && pubkey !== user?.pubkey)
      .map((pubkey) => ({ pubkey, permission: 'edit' as const, addedAt: 0, name: undefined, status: undefined })),
  );
  const listedPartners = [...(fullState.partners || []), ...nostrPartners].filter((partner) => {
    return partner.pubkey && partner.pubkey !== user?.pubkey && partner.status !== 'declined';
  });
  const namedPartners = listedPartners.length > 0 ? listedPartners : txPartners;
  const existingPartners = namedPartners.filter((partner, index) => namedPartners.findIndex((item) => item.pubkey === partner.pubkey) === index);
  const alreadyShared = !newThreadActive && (!!fullState.budgetKeypair || fullState.userRole === 'editor' || fullState.userRole === 'viewer' || listedPartners.length > 0);

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      toast({ title: success });
    } catch (error) {
      toast({
        title: 'Could not update budget partners',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    }
  };

  const invite = (raw: string) => run(async () => {
    await threadApi?.invitePartner(raw);
    setNpubInput('');
  }, 'Invite sent');

  const showCode = () => run(async () => {
    const code = await threadApi?.showJoinCode();
    if (!code) return;
    const url = await QRCode.toDataURL(code, { width: 280, margin: 1, color: { dark: '#000', light: '#fff' } });
    setJoinQr(url);
  }, 'Join code ready');

  const removeConnection = async () => {
    if (thread?.status === 'accepted') {
      await threadApi?.leaveOrRemove();
      setEditing(false);
      return;
    }
    const sharedNpub = fullState.budgetKeypair?.budgetNpub;
    for (const partner of nostrPartners) {
      if (partner.pubkey && partner.pubkey !== user?.pubkey) {
        try {
          await removeNostrPartner(partner.pubkey);
        } catch {
          // The connection still comes off this phone.
        }
      }
    }
    setState((prev) => ({
      ...prev,
      partners: [],
      budgetKeypair: undefined,
      userRole: 'owner',
      accessibleBudgets: (prev.accessibleBudgets || []).filter((budget) => !budget.budgetNsec && budget.budgetNpub !== sharedNpub),
    }));
    setEditing(false);
  };

  const partnerLabel = thread?.partnerPubkey
    ? nip19.npubEncode(thread.partnerPubkey).slice(0, 16) + '…'
    : 'your partner';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Budget Partners
            </DialogTitle>
            <DialogDescription>
              Share this budget with one other person. You each stay logged in as yourself, and you both see the same changes.
            </DialogDescription>
          </DialogHeader>

          {!user && (
            <p className="text-sm text-muted-foreground">Log in with your Nostr key before inviting a partner.</p>
          )}

          {user && incoming && threadApi && thread?.status !== 'accepted' && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm">Someone shared a budget with you. If you accept, you can both edit it.</p>
              <p className="text-xs text-muted-foreground">{incoming.monthCount} month{incoming.monthCount === 1 ? '' : 's'} are included.</p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={threadApi.busy} onClick={() => {
                  void run(() => threadApi.joinBudget(incoming.budgetId, incoming.ownerPubkey), 'Joined the budget');
                }}>Accept</Button>
                <Button className="flex-1" variant="outline" onClick={threadApi.dismissInvite}>Decline</Button>
              </div>
            </div>
          )}

          {user && thread?.status === 'pending' && (
            <div className="space-y-3">
              <p className="text-sm">Waiting for them to accept the invite.</p>
              <Button variant="outline" className="w-full" onClick={showCode}>
                <QrCode className="h-4 w-4 mr-2" /> Show join code
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setConfirm('revoke')}>
                Revoke invite
              </Button>
            </div>
          )}

          {user && thread?.status === 'accepted' && threadApi && (
            <div className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-sm">This budget is shared. You can both edit it.</p>
                  {thread.partnerPubkey && <PartnerLine pubkey={thread.partnerPubkey} />}
                  {threadApi.unsyncedCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {threadApi.unsyncedCount} change{threadApi.unsyncedCount === 1 ? '' : 's'} saved on this phone, not sent yet.
                    </p>
                  )}
                </div>
                <PartnerMenu onEdit={() => setEditing(true)} onRemove={() => setConfirm('stop')} />
              </div>
            </div>
          )}

          {user && alreadyShared && (
            <div className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <p className="text-sm">
                    {fullState.userRole === 'editor' || fullState.userRole === 'viewer'
                      ? 'You are already on this shared budget.'
                      : 'This budget is already shared.'}
                  </p>
                  {existingPartners.map((partner) => (
                    <PartnerLine key={partner.pubkey} pubkey={partner.pubkey} name={partner.name} />
                  ))}
                </div>
                <PartnerMenu onEdit={() => setEditing(true)} onRemove={() => setConfirm('stop')} />
              </div>
            </div>
          )}

          {user && (editing || (!alreadyShared && !newThreadActive)) && (!thread || thread.status === 'none' || thread.status === 'revoked' || thread.status === 'left' || editing) && (
            <div className="space-y-3">
              <Input
                value={npubInput}
                onChange={(event) => setNpubInput(event.target.value)}
                placeholder="Paste an npub"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button className="w-full" disabled={threadApi?.busy || !npubInput.trim()} onClick={() => invite(npubInput)}>
                {editing ? 'Update connection' : 'Send invite'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setScannerOpen(true)}>
                <Camera className="h-4 w-4 mr-2" /> Scan a code
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Scan an npub to invite someone, or scan a join code to join their budget.
              </p>
              <Button variant="outline" className="w-full" onClick={showCode}>
                <QrCode className="h-4 w-4 mr-2" /> Show join code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!joinQr} onOpenChange={(next) => { if (!next) setJoinQr(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join code</DialogTitle>
            <DialogDescription>Have them scan this while logged in. This code is not a private key.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <div className="rounded-lg border bg-white p-4">
              <img src={joinQr} alt="Budget join code" className="w-[240px] h-[240px]" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(next) => { if (!next) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === 'revoke' ? 'Revoke this invite?' : 'Stop sharing?'}</DialogTitle>
            <DialogDescription>
              {confirm === 'revoke'
                ? 'They will not be able to join from this invite. The budget stays on this phone.'
                : 'This removes the partner connection. The budget stays on this phone. New changes will no longer sync.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              const action = confirm;
              setConfirm(null);
              if (action === 'revoke') void run(() => threadApi!.revokeInvite(), 'Invite revoked');
              if (action === 'stop') void run(removeConnection, 'Partner removed');
            }}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <QRScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        title="Scan a code"
        description="Point the camera at an npub or a join code."
        onScan={(value) => {
          setScannerOpen(false);
          void invite(value);
        }}
      />
    </>
  );
}
