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
  const [scanMode, setScanMode] = useState<'npub' | 'join'>('npub');
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
              You keep your login. She keeps hers. Changes sync one at a time.
            </DialogDescription>
          </DialogHeader>

          {!user && (
            <p className="text-sm text-muted-foreground">Log in with your Nostr key before inviting a partner.</p>
          )}

          {user && incoming && threadApi && thread?.status !== 'accepted' && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm">Someone shared a budget with you. You will both be able to edit it. Your existing months stay, and anything only on your phone is kept.</p>
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
              <p className="text-sm">Waiting for budget partner to accept invite.</p>
              <p className="text-xs text-muted-foreground">
                {months} month{months === 1 ? '' : 's'}{latestMonth ? `, through ${latestMonth}` : ''} stay on this phone. Nothing is deleted.
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
              <p className="text-sm">Sharing with {partnerLabel}. You can both edit.</p>
              {threadApi.unsyncedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {threadApi.unsyncedCount} change{threadApi.unsyncedCount === 1 ? '' : 's'} not synced yet. They stay on this phone and send when a relay accepts them.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setConfirm('stop')}>
                {thread.role === 'owner' ? 'Remove partner' : 'Leave budget'}
              </Button>
            </div>
          )}

          {user && (!thread || thread.status === 'none' || thread.status === 'revoked' || thread.status === 'left') && (
            <div className="space-y-3">
              <p className="text-sm">
                Your months stay{latestMonth ? `, through ${latestMonth}` : ''}. Inviting someone does not erase them. The old shared key is no longer how you add a partner.
              </p>
              <Input
                value={npubInput}
                onChange={(event) => setNpubInput(event.target.value)}
                placeholder="Paste her npub"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <Button className="w-full" disabled={threadApi?.busy || !npubInput.trim()} onClick={() => invite(npubInput)}>
                Invite partner
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setScanMode('npub'); setScannerOpen(true); }}>
                <Camera className="h-4 w-4 mr-2" /> Scan her npub
              </Button>
              <Button variant="outline" className="w-full" onClick={showCode}>
                <QrCode className="h-4 w-4 mr-2" /> Show a join code
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setScanMode('join'); setScannerOpen(true); }}>
                <Camera className="h-4 w-4 mr-2" /> Scan a join code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!joinQr} onOpenChange={(next) => { if (!next) setJoinQr(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join code</DialogTitle>
            <DialogDescription>She scans this while logged in as herself. It does not contain a private key.</DialogDescription>
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
                ? 'She will not be able to accept this invite. Your budget stays on this phone.'
                : 'You both keep the budget as it is. New changes will no longer sync.'}
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
        title={scanMode === 'join' ? 'Scan join code' : 'Scan npub'}
        description={scanMode === 'join' ? 'Point the camera at the join code.' : 'Point the camera at her npub QR.'}
        onScan={(value) => {
          setScannerOpen(false);
          if (scanMode === 'join') void invite(value);
          else void invite(value);
        }}
      />
    </>
  );
}
