import { useState } from 'react';
import { QrCode, Camera, RefreshCw, Shield, Eye, Users, KeyRound, Copy } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { generateBudgetKeypair } from '@/lib/budgetCrypto';
import { seedAllBudgetSnapshots, fetchAllSharedBudgetSnapshots } from '@/hooks/useSharedBudgetSync';
import { useSharedSync } from './PartnerSyncWrapper';
import { QRScanner } from './QRScanner';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ManagePartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: 'owner' | 'editor' | 'viewer';
}

export function ManagePartnersDialog({
  open,
  onOpenChange,
  userRole = 'owner',
}: ManagePartnersDialogProps) {
  const { fullState } = useBudget();
  const { setState } = useBudgetContext();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const sharedSync = useSharedSync();
  const { toast } = useToast();

  const [showShareQR, setShowShareQR] = useState(false);
  const [showJoinScanner, setShowJoinScanner] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const budgetKeypair = fullState.budgetKeypair;
  const isOwner = !budgetKeypair || userRole === 'owner';

  // Generate QR code when the share dialog opens
  const ensureKeypairAndShowQR = async () => {
    let keypair = budgetKeypair;

    // Generate a new keypair if this is the first time sharing
    if (!keypair) {
      const generated = generateBudgetKeypair();
      keypair = {
        budgetNsec: generated.budgetNsec,
        budgetNpub: generated.budgetNpub,
      };

      // Store it immediately
      setState(prev => ({
        ...prev,
        budgetKeypair: { budgetNsec: keypair!.budgetNsec, budgetNpub: keypair!.budgetNpub },
        accessibleBudgets: [
          ...(prev.accessibleBudgets || []).filter(b => b.budgetNpub && b.budgetNpub !== keypair!.budgetNpub),
          { budgetNpub: keypair!.budgetNpub, budgetNsec: keypair!.budgetNsec, role: 'owner' as const },
        ],
      }));

      // Seed all existing months to the shared keypair so partners get data immediately
      const currentBudgets = [...(fullState.budgets || [])];
      if (currentBudgets.length > 0) {
        console.log('[ManagePartnersDialog] Seeding', currentBudgets.length, 'months to shared keypair...');
        try {
          const count = await seedAllBudgetSnapshots(currentBudgets, keypair.budgetNsec, nostr);
          console.log('[ManagePartnersDialog] Seeded', count, 'months');
        } catch (e) {
          console.warn('[ManagePartnersDialog] Seeding failed (non-fatal):', e);
        }
      }
    } else {
      // Keypair exists — re-seed in case data changed or previous seed failed
      const currentBudgets = [...(fullState.budgets || [])];
      if (currentBudgets.length > 0) {
        try {
          const count = await seedAllBudgetSnapshots(currentBudgets, keypair.budgetNsec, nostr);
          console.log('[ManagePartnersDialog] Re-seeded', count, 'months');
        } catch (e) {
          console.warn('[ManagePartnersDialog] Re-seed failed (non-fatal):', e);
        }
      }
    }

    // Generate QR from the nsec
    if (keypair?.budgetNsec) {
      try {
        const url = await QRCode.toDataURL(keypair.budgetNsec, { width: 280, margin: 1, color: { dark: '#000', light: '#fff' } });
        setQrCodeUrl(url);
      } catch (e) {
        console.error('QR generation failed:', e);
      }
    }
    setShowShareQR(true);
  };

  // Handle QR scan when joining a budget
  const handleJoinScan = async (scannedValue: string) => {
    setIsJoining(true);
    try {
      // The scanned value should be a budget nsec
      let budgetNsec = scannedValue.trim();

      // Remove nostr: prefix if present
      if (budgetNsec.startsWith('nostr:')) {
        budgetNsec = budgetNsec.substring(6);
      }

      // Validate it's an nsec
      const decoded = nip19.decode(budgetNsec);
      if (decoded.type !== 'nsec') {
        throw new Error('Not a valid budget key (expected nsec)');
      }

      const secretKey = decoded.data as Uint8Array;
      const budgetPubkeyHex = getPublicKey(secretKey);
      const budgetNpub = nip19.npubEncode(budgetPubkeyHex);

      console.log('[ManagePartnersDialog] Joining budget:', budgetNpub.slice(0, 16) + '...');

      // Fetch existing data from the relay
      let snapshotBudgets: any[] = [];
      try {
        snapshotBudgets = await fetchAllSharedBudgetSnapshots(budgetNsec, nostr);
        console.log('[ManagePartnersDialog] Fetched', snapshotBudgets.length, 'month snapshots on join');
      } catch (e) {
        console.warn('[ManagePartnersDialog] Could not fetch snapshots (will rely on live sync):', e);
      }

      // Store the keypair + apply snapshots
      setState(prev => {
        let mergedBudgets = [...(prev.budgets || [])];
        if (snapshotBudgets.length > 0) {
          const incomingMonths = new Set(snapshotBudgets.map((b: any) => b.month));
          const withoutIncoming = mergedBudgets.filter((b: any) => !incomingMonths.has(b.month));
          mergedBudgets = [...withoutIncoming, ...snapshotBudgets];
        }

        return {
          ...prev,
          budgets: mergedBudgets,
          currentMonth: new Date().toISOString().slice(0, 7),
          accessibleBudgets: [
            ...(prev.accessibleBudgets || []).filter(b => b.budgetNpub !== budgetNpub),
            { budgetNpub, budgetNsec: budgetNsec, role: 'editor' as const },
          ],
          budgetKeypair: { budgetNsec: budgetNsec, budgetNpub },
          userRole: 'editor' as const,
        };
      });

      // Mark received snapshots so they aren't echoed back
      for (const snap of snapshotBudgets) {
        sharedSync?.markReceivedSnapshot(snap.month, snap);
      }

      setShowJoinScanner(false);
      onOpenChange(false);

      toast({
        title: snapshotBudgets.length > 0 ? 'Budget joined!' : 'Connected to shared budget',
        description: snapshotBudgets.length > 0
          ? `Loaded ${snapshotBudgets.length} month${snapshotBudgets.length === 1 ? '' : 's'} of budget data. Changes will sync automatically.`
          : 'Connected to the shared budget key. Data will sync as the owner publishes it.',
      });
    } catch (error) {
      console.error('[ManagePartnersDialog] Failed to join budget:', error);
      toast({
        title: 'Could not join budget',
        description: error instanceof Error ? error.message : 'Invalid QR code. Make sure you scanned the budget key.',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const copyKey = async () => {
    if (!budgetKeypair?.budgetNsec) return;
    try {
      await navigator.clipboard.writeText(budgetKeypair.budgetNsec);
      toast({ title: 'Copied!', description: 'Budget key copied. Share it securely with your partner.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy the key.', variant: 'destructive' });
    }
  };

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
              Share a budget with your partner. Scan a QR code to join — no invites needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Role indicator */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm">
                <strong>Your Role:</strong>{' '}
                <Badge variant="secondary" className="ml-2 capitalize">{userRole}</Badge>
              </p>
              {isOwner && (
                <p className="text-xs text-muted-foreground mt-1">
                  You own this budget. Share your key to let someone join.
                </p>
              )}
              {!isOwner && (
                <p className="text-xs text-muted-foreground mt-1">
                  You're collaborating on a shared budget.
                </p>
              )}
            </div>

            {/* Owner: Share button */}
            {isOwner && (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={ensureKeypairAndShowQR}
                >
                  <QrCode className="h-5 w-5 mr-2" />
                  Share Budget Key (QR)
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Your partner scans this QR code to join the budget.
                  They'll see all categories and transactions immediately.
                </p>
              </div>
            )}

            {/* Anyone: Join a budget by scanning */}
            {!budgetKeypair && (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => setShowJoinScanner(true)}
                disabled={isJoining}
              >
                <Camera className="h-5 w-5 mr-2" />
                {isJoining ? 'Joining...' : 'Join a Budget (Scan QR)'}
              </Button>
            )}

            {/* Partner: Manual sync */}
            {!isOwner && sharedSync?.hasSharedBudget && (
              <div className="p-3 rounded-md bg-petrol/10 border border-petrol/20">
                <p className="text-xs text-muted-foreground mb-2">
                  Not seeing data? Force a re-sync.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    toast({ title: 'Syncing...', description: 'Fetching latest data from relay.' });
                    await sharedSync.forceSync();
                    toast({ title: 'Sync complete', description: 'Checked for updates.' });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync
                </Button>
              </div>
            )}

            {/* Budget key info (if exists) */}
            {budgetKeypair && (
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Budget Key</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {budgetKeypair.budgetNpub?.slice(0, 30)}...
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyKey}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy key
                  </Button>
                  {isOwner && (
                    <Button size="sm" variant="outline" onClick={ensureKeypairAndShowQR}>
                      <QrCode className="h-3.5 w-3.5 mr-1" /> Show QR
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-2">
              <p className="font-medium">How it works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Owner taps "Share Budget Key" to show a QR code</li>
                <li>Partner opens this dialog and taps "Join Budget"</li>
                <li>Partner scans the QR code — done!</li>
                <li>Both people see the same budget and sync changes automatically</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share QR Dialog */}
      <Dialog open={showShareQR} onOpenChange={setShowShareQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Share Budget Key
            </DialogTitle>
            <DialogDescription>
              Have your partner scan this code with their Sat Sorter app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-lg border bg-white p-4">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Budget key QR" className="w-[240px] h-[240px]" />
              ) : (
                <div className="w-[240px] h-[240px] flex items-center justify-center text-muted-foreground">
                  Generating...
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This gives full access to the shared budget. Only share with people you trust.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Budget scanner */}
      <QRScanner
        open={showJoinScanner}
        onOpenChange={setShowJoinScanner}
        onScan={handleJoinScan}
        title="Scan Budget Key"
        description="Point your camera at your partner's budget key QR code"
      />
    </>
  );
}
