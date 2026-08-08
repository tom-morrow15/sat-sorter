import { useState, type ReactNode } from 'react';
import { Plus, Trash2, Shield, Eye, QrCode, Loader2, Bell, CheckCircle, XCircle, UserPlus, RefreshCw } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { getPublicKey } from 'nostr-tools/pure';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import type { BudgetPartnerInvite, BudgetPartner } from '@/lib/budgetTypes';
import { formatMonth } from '@/lib/budgetTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { usePartners } from '@/hooks/usePartners';
import { useSharedSync } from './PartnerSyncWrapper';
import { usePartnerInvites } from '@/hooks/usePartnerInvites';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetContext } from '@/contexts/BudgetContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrLogin } from '@nostrify/react/login';
import { useNostr } from '@nostrify/react';
import { generateBudgetKeypair, encryptBudgetKeyForPartner, decryptBudgetKeyFromInvite, ensureHexPubkey } from '@/lib/budgetCrypto';
import { seedAllBudgetSnapshots, fetchAllSharedBudgetSnapshots, publishSyncRequest } from '@/hooks/useSharedBudgetSync';
import { QRScanner } from './QRScanner';
import { MyNpubQr } from './MyNpubQr';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  // Use Nostr-native partners hook - this bypasses localStorage sync issues
  const { partners, isLoading, addPartner, removePartner, changePartnerPermission } = usePartners();
  const { sendInvite, pendingInvites, acceptInvite, declineInvite } = usePartnerInvites();
  const { currentMonth, fullState } = useBudget();
  const { setState } = useBudgetContext();
  const { user } = useCurrentUser();
  const { logins } = useNostrLogin();
  const { nostr } = useNostr();
  const sharedSync = useSharedSync();
  
  const [newPartnerPubkey, setNewPartnerPubkey] = useState('');
  const [newPartnerPermission, setNewPartnerPermission] = useState<'view' | 'edit'>('edit');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showMyQr, setShowMyQr] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const { toast } = useToast();

  const isOwner = userRole === 'owner';

  // Handle accepting a partner invite — decrypts the budget key and stores it
  const handleAcceptInvite = async (invite: BudgetPartnerInvite) => {
    setProcessingInviteId(invite.id);
    try {
      if (!user?.signer) {
        toast({
          title: 'Cannot accept invite',
          description: 'No signer available. Please log in first.',
          variant: 'destructive',
        });
        return;
      }

      console.log('[ManagePartnersDialog] Accepting invite from', invite.from, 'budget npub:', invite.budgetNpub);

      let budgetNsec: string;
      const fromHex = ensureHexPubkey(invite.from);

      // Try to extract raw private key bytes for nsec-based logins
      let myPriv: Uint8Array | null = null;
      const nsecLogin = logins.find((l: any) => l.type === 'nsec' && l.data?.nsec);
      if (nsecLogin) {
        try {
          const decoded = nip19.decode(nsecLogin.data.nsec);
          if (decoded.type === 'nsec') {
            myPriv = decoded.data as Uint8Array;
          }
        } catch {
          // ignore
        }
      }

      // Get the NIP-04 decrypt function if available (for fallback)
      const nip04Decrypt = user.signer.nip04
        ? (pubkey: string, ciphertext: string) => user.signer.nip04!.decrypt(pubkey, ciphertext)
        : undefined;

      if (myPriv) {
        // nsec user: use raw key path with dual-format support
        budgetNsec = await decryptBudgetKeyFromInvite(
          invite.encryptedBudgetKey,
          myPriv,
          fromHex,
          nip04Decrypt
        );
      } else if (user.signer.nip44) {
        // Extension with NIP-44 — try NIP-44 first
        try {
          budgetNsec = await user.signer.nip44.decrypt(fromHex, invite.encryptedBudgetKey);
        } catch (nip44Error) {
          // Try NIP-04 as fallback
          if (user.signer.nip04) {
            budgetNsec = await user.signer.nip04.decrypt(fromHex, invite.encryptedBudgetKey);
          } else {
            throw nip44Error;
          }
        }
      } else if (user.signer.nip04) {
        // Extension with only NIP-04
        budgetNsec = await user.signer.nip04.decrypt(fromHex, invite.encryptedBudgetKey);
      } else {
        toast({
          title: 'Cannot accept invite',
          description: 'Your signer does not support NIP-44 or NIP-04 decryption.',
          variant: 'destructive',
        });
        return;
      }

      // 2. Derive the budget npub from the decrypted nsec and verify it matches the invite
      const nsecDecoded = nip19.decode(budgetNsec);
      if (nsecDecoded.type !== 'nsec') {
        throw new Error('Decrypted budget key is not a valid nsec');
      }
      const secretKey = nsecDecoded.data as Uint8Array;
      const budgetPubkeyHex = getPublicKey(secretKey);
      const budgetNpub = nip19.npubEncode(budgetPubkeyHex);

      // Verify the npub matches what the invite claims
      if (budgetNpub !== invite.budgetNpub) {
        console.error('[ManagePartnersDialog] Budget npub mismatch!');
        toast({
          title: 'Invalid invite',
          description: 'The budget key in this invite does not match. It may have been tampered with.',
          variant: 'destructive',
        });
        return;
      }

      // 3. Publish acceptance via acceptInvite (sends kind 4001 response)
      console.log('[ManagePartnersDialog] Publishing acceptance response...');
      let result;
      try {
        result = await acceptInvite(invite);
      } catch (publishError) {
        console.error('[ManagePartnersDialog] acceptInvite threw:', publishError);
        toast({
          title: 'Could not publish response',
          description: 'The invite was decrypted but the response failed to publish. Your partner may not see the acceptance.',
          variant: 'destructive',
        });
        // Still proceed with storing the keypair locally — the sync will work
        // even if the response event doesn't reach the sender
        result = { success: true };
      }

      if (result.success) {
        const role = invite.permission === 'editor' ? 'editor' as const : 'viewer' as const;

        // 4. Use the snapshot embedded in the invite payload — the partner gets
        // all budget data immediately, no relay fetch or propagation wait needed.
        let snapshotBudgets: any[] = [];
        if (invite.snapshot) {
          try {
            const parsed = JSON.parse(invite.snapshot);
            if (parsed && Array.isArray(parsed.budgets)) {
              snapshotBudgets = parsed.budgets;
              console.log('[ManagePartnersDialog] Using embedded snapshot:', snapshotBudgets.length, 'months');
            }
          } catch (e) {
            console.warn('[ManagePartnersDialog] Failed to parse embedded snapshot, falling back to relay fetch:', e);
          }
        }

        // Fallback: if no embedded snapshot (legacy invite), try fetching from relays
        if (snapshotBudgets.length === 0) {
          try {
            snapshotBudgets = await fetchAllSharedBudgetSnapshots(budgetNsec, nostr);
            console.log('[ManagePartnersDialog] Fetched', snapshotBudgets.length, 'month snapshots from relay');
          } catch (e) {
            console.warn('[ManagePartnersDialog] Could not fetch snapshots (will rely on live sync):', e);
          }
        }

        // 5. Store the budget keypair locally + apply the snapshot
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
              ...prev.accessibleBudgets.filter(b => b.budgetNpub !== budgetNpub),
              { budgetNpub, budgetNsec: budgetNsec, role },
            ],
            budgetKeypair: { budgetNsec: budgetNsec, budgetNpub },
            userRole: role,
            partners: [
              ...(prev.partners || []).filter(p => p.pubkey !== fromHex),
              {
                pubkey: fromHex,
                permission: 'edit',
                addedAt: Math.floor(Date.now() / 1000),
                status: 'accepted',
                acceptedAt: Math.floor(Date.now() / 1000),
              },
            ],
          };
        });

        toast({
          title: 'Budget Partner Invite Accepted!',
          description: snapshotBudgets.length > 0
            ? `You're now synced — ${snapshotBudgets.length} month${snapshotBudgets.length === 1 ? '' : 's'} of budget data loaded.`
            : `You now have ${invite.permission === 'editor' ? 'edit' : 'view-only'} access. Data will sync as it comes in.`,
        });
      } else {
        toast({
          title: 'Failed to accept invite',
          description: 'error' in result && result.error ? result.error : 'Could not publish the response. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[ManagePartnersDialog] Failed to accept invite:', error);
      toast({
        title: 'Error accepting invite',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Handle declining a partner invite
  const handleDeclineInvite = async (invite: BudgetPartnerInvite) => {
    setProcessingInviteId(invite.id);
    console.log('[ManagePartnersDialog] Declining invite from', invite.from);
    try {
      const success = await declineInvite(invite);
      if (success) {
        toast({
          title: 'Invite Declined',
          description: 'The partner has been notified.',
        });
      } else {
        toast({
          title: 'Failed to decline',
          description: 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[ManagePartnersDialog] Failed to decline invite:', error);
      toast({
        title: 'Error declining invite',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

   const handleAddPartner = async () => {
     const pubkey = newPartnerPubkey.trim();
     setValidationError('');
     
     if (!pubkey) {
       setValidationError('Please enter a Nostr address');
       return;
     }

      // Try to decode if it's an npub address
      let hexPubkey: string;
      const isHex = /^[0-9a-f]{64}$/i.test(pubkey);
      const isNpub = pubkey.startsWith('npub1');

      if (isNpub) {
        try {
          const decoded = nip19.decode(pubkey);
          if (decoded.type !== 'npub') {
            setValidationError('Invalid Nostr address. Please use an npub address or hex public key.');
            console.warn('[ManagePartnersDialog] Invalid NIP-19 type:', decoded.type);
            return;
          }
          hexPubkey = ensureHexPubkey(decoded.data as string);
        } catch (error) {
          setValidationError('Invalid Nostr address format. Please check the address and try again.');
          console.warn('[ManagePartnersDialog] Failed to decode npub:', error);
          return;
        }
      } else if (isHex) {
        hexPubkey = ensureHexPubkey(pubkey);
      } else {
        setValidationError('Invalid format. Use a 64-character hex key or npub1... address');
        console.warn('[ManagePartnersDialog] Invalid pubkey format:', pubkey);
        return;
      }

     // Check if partner already exists (compare hex pubkeys)
     if (partners.some(p => p.pubkey === hexPubkey)) {
       setValidationError('This partner is already added');
       return;
     }

     if (!user?.signer?.nip44 && !user?.signer?.nip04) {
       setValidationError('Your signer does not support NIP-44 or NIP-04 encryption. Please use a compatible Nostr extension.');
       return;
     }

      setIsSubmitting(true);
      try {
        // 1. Ensure we have a budget keypair. If this is the first partner,
        //    generate one and save it to state. All future partners share
        //    the same keypair.
         let budgetKeypair = fullState.budgetKeypair;
         const isFirstPartner = !budgetKeypair;

         // Capture current budgets BEFORE any state mutation (for seeding on first partner)
         const currentBudgetsForSeeding = [...(fullState.budgets || [])];

         if (!budgetKeypair) {
           const generated = generateBudgetKeypair();
           budgetKeypair = {
             budgetNsec: generated.budgetNsec,
             budgetNpub: generated.budgetNpub,
             budgetPrivateKey: generated.budgetPrivateKey,
             budgetPublicKey: generated.budgetPublicKey,
           };
          // Persist the keypair immediately
          setState(prev => ({
            ...prev,
            budgetKeypair: {
              budgetNsec: budgetKeypair!.budgetNsec,
              budgetNpub: budgetKeypair!.budgetNpub,
            },
            accessibleBudgets: [
              ...(prev.accessibleBudgets || []).filter(b => b.budgetNpub !== '' && b.budgetNpub !== budgetKeypair!.budgetNpub),
              {
                budgetNpub: budgetKeypair!.budgetNpub,
                budgetNsec: budgetKeypair!.budgetNsec,
                role: 'owner' as const,
              },
            ],
          }));
          console.log('[ManagePartnersDialog] Generated new budget keypair:', budgetKeypair.budgetNpub.slice(0, 16) + '...');
        }

        // ALWAYS seed the shared budget snapshots when adding a partner,
        // and await the result so we know the data is on the relay.
        // This is critical — the partner's ongoing sync subscription reads
        // from the relay, so the data must be there.
        if (currentBudgetsForSeeding.length > 0) {
          console.log('[ManagePartnersDialog] Seeding', currentBudgetsForSeeding.length, 'budget month(s) to shared keypair...');
          try {
            const seededCount = await seedAllBudgetSnapshots(currentBudgetsForSeeding, budgetKeypair.budgetNsec, nostr);
            console.log(`[ManagePartnersDialog] Successfully seeded ${seededCount}/${currentBudgetsForSeeding.length} month(s)`);
            if (seededCount === 0) {
              console.warn('[ManagePartnersDialog] WARNING: No snapshots were seeded — relay may have rejected the events');
            }
          } catch (e) {
            console.warn('[ManagePartnersDialog] Seeding snapshots failed (non-fatal):', e);
          }
        }

        // 2. Encrypt the budget nsec for the new partner
        // Pass the full signer (both nip44 and nip04) so the partner can
        // decrypt with whichever method their signer supports.
        const partnerHexForEncrypt = ensureHexPubkey(hexPubkey);
        const encryptedKey = await encryptBudgetKeyForPartner(
          budgetKeypair.budgetNsec,
          { nip44: user.signer.nip44, nip04: user.signer.nip04 },
          partnerHexForEncrypt
        );

        // 3. Save the partner to the NIP-78 partner list with the encrypted key
        await addPartner(hexPubkey, newPartnerPermission);

        // Also store the encrypted key in the BudgetState partner list
        setState(prev => ({
          ...prev,
          partners: (prev.partners || []).map(p =>
            p.pubkey === hexPubkey
              ? { ...p, encryptedBudgetKey: encryptedKey }
              : p
          ),
        }));

        // 4. Publish kind 4001 invite with the encrypted budget nsec AND full snapshot
        const inviteSent = await sendInvite(
          hexPubkey,
          currentMonth,
          newPartnerPermission,
          encryptedKey,
          budgetKeypair.budgetNpub,
          user?.metadata?.name,
          JSON.stringify(fullState), // Full budget state embedded in the invite
        );

        toast({
          title: isFirstPartner ? 'Budget Shared!' : 'Partner Added',
          description: inviteSent
            ? `Invite sent to ${formatPubkey(hexPubkey)}. They'll decrypt the budget key and sync data automatically.`
            : `${formatPubkey(hexPubkey)} has been added locally. They need to be online to receive the invite.`,
        });
        setNewPartnerPubkey('');
        setValidationError('');
        setNewPartnerPermission('edit');
        setIsAdding(false);
      } catch (error) {
        console.error('[ManagePartnersDialog] Failed to add partner:', error);
        toast({
          title: 'Failed to add partner',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
   };

  const formatPubkey = (pubkey: string) => {
    if (pubkey.length > 16) {
      return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
    }
    return pubkey;
  };

   const getPermissionIcon = (permission: 'view' | 'edit') => {
     return permission === 'edit' ? (
       <Shield className="h-4 w-4" />
     ) : (
       <Eye className="h-4 w-4" />
     );
   };

  const handleRemovePartner = async (pubkey: string) => {
    const partner = partners.find(p => p.pubkey === pubkey);
    if (confirm(`Remove ${partner?.name || formatPubkey(pubkey)} from this budget?`)) {
      try {
        await removePartner(pubkey);
        toast({
          title: 'Partner Removed',
          description: `${partner?.name || formatPubkey(pubkey)} has been removed.`,
        });
      } catch (error) {
        toast({
          title: 'Failed to remove partner',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

   const handleQRScan = (scannedValue: string) => {
     // Handle scanned QR code
     // Could be: npub1..., nostr:npub1..., or raw hex
     let value = scannedValue.trim();
     
     // Remove nostr: prefix if present
     if (value.startsWith('nostr:')) {
       value = value.substring(6);
     }
     
     // If it's an npub, decode it to hex for internal storage
     if (value.startsWith('npub1')) {
       try {
         const decoded = nip19.decode(value);
         if (decoded.type === 'npub') {
           setNewPartnerPubkey(decoded.data);
           console.log('[ManagePartnersDialog] QR scanned (decoded to hex):', decoded.data);
         } else {
           setNewPartnerPubkey(value);
           console.log('[ManagePartnersDialog] QR scanned (kept as is):', value);
         }
       } catch (error) {
         console.warn('[ManagePartnersDialog] Failed to decode QR scanned npub:', error);
         setNewPartnerPubkey(value);
       }
     } else {
       setNewPartnerPubkey(value);
       console.log('[ManagePartnersDialog] QR scanned:', value);
     }
     
     setShowQRScanner(false);
   };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Budget Partners</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Manage who can access and edit this budget with you'
              : 'View who has access to this budget'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Role indicator */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm">
              <strong>Your Role:</strong>{' '}
              <Badge variant="secondary" className="ml-2 capitalize">
                {userRole}
              </Badge>
            </p>
            {userRole === 'owner' && (
              <p className="text-xs text-muted-foreground mt-1">
                You can add/remove partners and manage permissions. Changes are saved automatically to Nostr.
              </p>
            )}
            {userRole === 'editor' && (
              <p className="text-xs text-muted-foreground mt-1">
                You can view and edit this budget
              </p>
            )}
            {userRole === 'viewer' && (
              <p className="text-xs text-muted-foreground mt-1">
                You have view-only access to this budget
              </p>
            )}
          </div>

          {/* Manual sync — for partners who accepted but see no data */}
          {!isOwner && sharedSync?.hasSharedBudget && (
            <div className="p-3 rounded-md bg-petrol/10 border border-petrol/20">
              <p className="text-xs text-muted-foreground mb-2">
                Not seeing budget data? The owner may need to re-publish.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full touch-target-sm"
                onClick={async () => {
                  const ok = await sharedSync.requestSync();
                  toast({
                    title: ok ? 'Sync requested' : 'Sync request failed',
                    description: ok
                      ? 'The owner has been asked to re-publish the budget. Data should appear shortly.'
                      : 'Could not send the sync request. Try again.',
                    variant: ok ? 'default' : 'destructive',
                  });
                  if (ok) {
                    // Also force a local re-fetch after a short delay
                    setTimeout(() => sharedSync.forceSync(), 3000);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Request Sync from Owner
              </Button>
            </div>
          )}

          {/* Pending Invites Section - show when user has received invites */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label className="font-semibold">
                  Pending Invites ({pendingInvites.length})
                </Label>
              </div>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <PendingInviteCard
                    key={invite.id}
                    invite={invite}
                    isProcessing={processingInviteId === invite.id}
                    onAccept={() => handleAcceptInvite(invite)}
                    onDecline={() => handleDeclineInvite(invite)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add partner section (owner only) */}
          {isOwner && (
            <>
              {!isAdding ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsAdding(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Partner
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowMyQr(true)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    My QR Code
                  </Button>
                </div>
               ) : (
                <Card>
                   <CardContent className="pt-6 space-y-3">
                     <div className="space-y-2">
                       <Label htmlFor="partner-pubkey">Partner Nostr Address</Label>
                       <div className="flex gap-2">
                         <Input
                           id="partner-pubkey"
                           placeholder="npub1... or public key"
                           value={newPartnerPubkey}
                           onChange={(e) => {
                             setNewPartnerPubkey(e.target.value);
                             setValidationError('');
                           }}
                           autoFocus
                           className={validationError ? 'border-destructive' : ''}
                         />
                         <Button
                           type="button"
                           variant="outline"
                           size="icon"
                           onClick={() => setShowQRScanner(true)}
                           title="Scan QR code"
                           className="shrink-0"
                         >
                           <QrCode className="h-4 w-4" />
                         </Button>
                       </div>
                       {validationError ? (
                         <p className="text-xs text-destructive font-medium">{validationError}</p>
                       ) : (
                         <p className="text-xs text-muted-foreground">
                           Enter their Nostr pubkey, npub address, or scan their QR code
                         </p>
                       )}
                     </div>

                    <div className="space-y-2">
                      <Label htmlFor="partner-permission">Permission Level</Label>
                      <Select
                        value={newPartnerPermission}
                        onValueChange={(value) =>
                          setNewPartnerPermission(value as 'view' | 'edit')
                        }
                      >
                        <SelectTrigger id="partner-permission">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              View Only
                            </div>
                          </SelectItem>
                          <SelectItem value="edit">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Can Edit
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddPartner}
                        disabled={!newPartnerPubkey.trim() || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsAdding(false);
                          setNewPartnerPubkey('');
                          setNewPartnerPermission('edit');
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Partners list */}
          <div className="space-y-2">
            <Label>Current Partners ({partners.length})</Label>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading partners from Nostr...</p>
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No partners yet</p>
                {isOwner && (
                  <p className="text-xs mt-1">Add someone to collaborate on this budget</p>
                )}
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-2">
                  {partners.map((partner) => (
                    <PartnerRow
                      key={partner.pubkey}
                      partner={partner}
                      isOwner={isOwner}
                      onRemove={handleRemovePartner}
                      onChangePermission={changePartnerPermission}
                      formatPubkey={formatPubkey}
                      getPermissionIcon={getPermissionIcon}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Info box */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                <strong>ℹ️ How it works:</strong> Partners are saved automatically to Nostr. 
                Share this app URL with your partner so they can log in with their Nostr 
                account and see the shared budget.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                <strong>Permissions:</strong> Partners with "Can Edit" permission can add
                transactions and modify categories. "View Only" partners can see everything
                but cannot make changes.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
       </DialogContent>
     </Dialog>

     {/* QR Scanner Dialog */}
     <QRScanner
       open={showQRScanner}
       onOpenChange={setShowQRScanner}
       onScan={handleQRScan}
       title="Scan Partner's npub"
       description="Point your camera at their QR code to get their Nostr address"
     />

     {/* My QR Code — show your npub so your partner can scan it */}
     <MyNpubQr open={showMyQr} onOpenChange={setShowMyQr} />
    </>
   );
  }

/**
 * Pending Invite Card - shows a received invite with accept/decline actions
 */
interface PendingInviteCardProps {
  invite: BudgetPartnerInvite;
  isProcessing: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function PendingInviteCard({
  invite,
  isProcessing,
  onAccept,
  onDecline,
}: PendingInviteCardProps) {
  const inviterProfile = useAuthor(invite.from);
  const inviterMetadata = inviterProfile.data?.metadata;
  const inviterName =
    inviterMetadata?.name || inviterMetadata?.display_name || genUserName(invite.from);
  const inviterPicture = inviterMetadata?.picture;

  return (
    <Card className="border-l-4 border-l-primary bg-primary/[0.04]">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Inviter info */}
        <div className="flex items-center gap-3">
          {inviterPicture ? (
            <img
              src={inviterPicture}
              alt={inviterName}
              className="h-10 w-10 rounded-full object-cover flex-shrink-0 border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{inviterName}</p>
            <p className="text-xs text-muted-foreground">
              invited you to collaborate on a budget
            </p>
          </div>
        </div>

        {/* Invite details */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Budget Month</span>
            <span className="font-medium">
              {invite.month
                ? formatMonth(invite.month)
                : 'Unknown'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Permission</span>
            <Badge
              variant={invite.permission === 'editor' ? 'default' : 'secondary'}
              className="w-fit text-[10px]"
            >
              {invite.permission === 'editor' ? (
                <>
                  <Shield className="h-2.5 w-2.5 mr-1" />
                  Can Edit
                </>
              ) : (
                <>
                  <Eye className="h-2.5 w-2.5 mr-1" />
                  View Only
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Info message about what happens on accept */}
        <div className="p-2 rounded bg-muted/50 border border-muted">
          <p className="text-[11px] text-muted-foreground">
            Accepting will connect you to the shared budget. Data will sync
            automatically. You'll be able to{' '}
            {invite.permission === 'editor'
              ? 'add transactions and edit categories'
              : 'view transactions'}.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onDecline}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Decline
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={onAccept}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * PartnerRow — displays a single partner with their Nostr profile picture.
 */
interface PartnerRowProps {
  partner: BudgetPartner;
  isOwner: boolean;
  onRemove: (pubkey: string) => void;
  onChangePermission: (pubkey: string, permission: 'view' | 'edit') => void;
  formatPubkey: (pubkey: string) => string;
  getPermissionIcon: (permission: 'view' | 'edit') => ReactNode;
}

function PartnerRow({
  partner,
  isOwner,
  onRemove,
  onChangePermission,
  formatPubkey,
  getPermissionIcon,
}: PartnerRowProps) {
  const profile = useAuthor(partner.pubkey);
  const metadata = profile.data?.metadata;
  const name = partner.name || metadata?.name || metadata?.display_name || formatPubkey(partner.pubkey);
  const picture = metadata?.picture;

  return (
    <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
      {/* Top row: avatar, name, and status badges */}
      <div className="flex flex-wrap items-center gap-2">
        {picture ? (
          <img
            src={picture}
            alt={name}
            className="h-7 w-7 rounded-full object-cover flex-shrink-0 border border-border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <span className="text-sm font-medium truncate flex-1 min-w-0">
          {name}
        </span>
        {partner.status === 'pending' && (
          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 shrink-0">
            Pending
          </Badge>
        )}
        {partner.status === 'accepted' && (
          <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800 shrink-0">
            Accepted ✓
          </Badge>
        )}
        {partner.status === 'declined' && (
          <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 shrink-0">
            Declined
          </Badge>
        )}
      </div>

      {partner.lastActive && (
        <p className="text-xs text-muted-foreground">
          Last active{' '}
          {new Date(partner.lastActive * 1000).toLocaleDateString()}
        </p>
      )}

      {/* Bottom row: permission controls and remove button */}
      {isOwner ? (
        <div className="flex items-center gap-2 pt-1">
          <Select
            value={partner.permission}
            onValueChange={(value) =>
              onChangePermission(partner.pubkey, value as 'view' | 'edit')
            }
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>View Only</span>
                </div>
              </SelectItem>
              <SelectItem value="edit">
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  <span>Can Edit</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={() => onRemove(partner.pubkey)}
            title="Remove partner"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Badge
          variant="secondary"
          className="flex items-center gap-1 w-fit"
        >
          {getPermissionIcon(partner.permission)}
          <span className="capitalize text-xs">
            {partner.permission === 'edit' ? 'Editor' : 'Viewer'}
          </span>
        </Badge>
      )}
    </div>
  );
}
