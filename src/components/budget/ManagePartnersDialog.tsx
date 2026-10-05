import { useState } from 'react';
import { QrCode, Camera, Users } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSharedSync } from './PartnerSyncWrapper';
import { QRScanner } from './QRScanner';
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

export function ManagePartnersDialog({
  open,
  onOpenChange,
}: ManagePartnersDialogProps) {
  const { fullState } = useBudget();
  const { user } = useCurrentUser();
  const shared = useSharedSync();
  const threadApi = shared?.thread;
  const { toast } = useToast();
  const [npubInput, setNpubInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirm, setConfirm] = useState<'revoke' | 'stop' | null>(null);
  const [joinQr, setJoinQr] = useState('');

  const thread = threadApi?.thread;
  const incoming = threadApi?.incomingInvite;
  const months = fullState.budgets?.length || 0;
  const latestMonth = [...(fullState.budgets || [])].map((budget) => budget.month).sort().at(-1);

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
              <p className="text-sm">Someone shared a budget with you. If you accept, you can both edit it. Months already on this phone stay.</p>
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
              <p className="text-xs text-muted-foreground">
                {months} month{months === 1 ? '' : 's'}{latestMonth ? `, through ${latestMonth}` : ''} stay on this phone.
              </p>
              <Button variant="outline" className="w-full" onClick={showCode}>
                <QrCode className="h-4 w-4 mr-2" /> Show join code
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setConfirm('revoke')}>
                Revoke invite
              </Button>
            </div>
          )}

          {user && thread?.status === 'accepted' && threadApi && (
            <div className="space-y-3">
              <p className="text-sm">This budget is shared with {partnerLabel}. You can both edit it.</p>
              {threadApi.unsyncedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {threadApi.unsyncedCount} change{threadApi.unsyncedCount === 1 ? '' : 's'} saved on this phone, not sent yet.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setConfirm('stop')}>
                {thread.role === 'owner' ? 'Remove partner' : 'Leave shared budget'}
              </Button>
            </div>
          )}

          {user && (!thread || thread.status === 'none' || thread.status === 'revoked' || thread.status === 'left') && (
            <div className="space-y-3">
              <p className="text-sm">
                Months already on this phone stay{latestMonth ? `, through ${latestMonth}` : ''}. An invite does not erase them.
              </p>
              <Input
                value={npubInput}
                onChange={(event) => setNpubInput(event.target.value)}
                placeholder="Paste an npub"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button className="w-full" disabled={threadApi?.busy || !npubInput.trim()} onClick={() => invite(npubInput)}>
                Send invite
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
                : 'You both keep the budget. New changes will no longer sync.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className="flex-1" onClick={() => {
              const action = confirm;
              setConfirm(null);
              if (action === 'revoke') void run(() => threadApi!.revokeInvite(), 'Invite revoked');
              if (action === 'stop') void run(() => threadApi!.leaveOrRemove(), 'Sharing stopped');
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
