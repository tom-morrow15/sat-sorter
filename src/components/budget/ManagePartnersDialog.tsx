import { useState } from 'react';
import { Plus, Trash2, Shield, Eye, QrCode, Loader2, Bell, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import type { BudgetPartnerInvite, BudgetState } from '@/lib/budgetTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { usePartners } from '@/hooks/usePartners';
import { usePartnerInvites } from '@/hooks/usePartnerInvites';
import { useBudget } from '@/hooks/useBudget';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { QRScanner } from './QRScanner';
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
  const { currentMonth, fullState, importBudgetState } = useBudget();
  const { user } = useCurrentUser();
  
  const [newPartnerPubkey, setNewPartnerPubkey] = useState('');
  const [newPartnerPermission, setNewPartnerPermission] = useState<'view' | 'edit'>('edit');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const { toast } = useToast();

  // Debug: log whenever partners changes
  console.log('[ManagePartnersDialog] Rendered with partners:', partners.length, 'userRole:', userRole, 'pending invites:', pendingInvites.length);

  const isOwner = userRole === 'owner';

  // Handle accepting a partner invite - downloads the owner's budget
  const handleAcceptInvite = async (invite: BudgetPartnerInvite & { budgetSnapshot?: BudgetState }) => {
    setProcessingInviteId(invite.id);
    try {
      const result = await acceptInvite(invite);
      if (result.success && result.budgetSnapshot) {
        // Import the owner's budget into our local state
        importBudgetState(result.budgetSnapshot, {
          asRole: invite.permission === 'edit' ? 'editor' : 'viewer',
          ownerPubkey: invite.fromPubkey,
        });

        toast({
          title: 'Budget Partner Invite Accepted!',
          description: `You now have ${invite.permission === 'edit' ? 'edit' : 'view-only'} access to the shared budget.`,
        });
      } else if (result.success) {
        toast({
          title: 'Invite Accepted',
          description: 'The invite was accepted but no budget data was included.',
        });
      } else {
        toast({
          title: 'Failed to accept invite',
          description: 'Please try again.',
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
    try {
      const success = await declineInvite(invite);
      if (success) {
        toast({
          title: 'Invite Declined',
          description: 'The partner has been notified.',
        });
      }
    } catch (error) {
      console.error('[ManagePartnersDialog] Failed to decline invite:', error);
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
         hexPubkey = decoded.data;
       } catch (error) {
         setValidationError('Invalid Nostr address format. Please check the address and try again.');
         console.warn('[ManagePartnersDialog] Failed to decode npub:', error);
         return;
       }
     } else if (isHex) {
       hexPubkey = pubkey.toLowerCase();
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

      setIsSubmitting(true);
      try {
        console.log('[ManagePartnersDialog] Adding partner:', hexPubkey, 'with permission:', newPartnerPermission);
        await addPartner(hexPubkey, newPartnerPermission);
        
        // Send Nostr invite to the partner with the current budget snapshot
        // so they can access the shared budget once they accept
        const inviteSent = await sendInvite(
          hexPubkey,
          currentMonth,
          newPartnerPermission,
          fullState, // Include current budget state
          user?.metadata?.name
        );

        toast({
          title: 'Partner Added',
          description: inviteSent
            ? `Invite sent to ${formatPubkey(hexPubkey)}. They'll see a notification in their Sat Sorter app.`
            : `${formatPubkey(hexPubkey)} has been added. They will see it when they log in.`,
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Partner
                </Button>
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
                    <div
                      key={partner.pubkey}
                      className="p-3 rounded-lg border bg-muted/50 space-y-2"
                    >
                      {/* Top row: pubkey and status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium truncate flex-1 min-w-0">
                          {partner.name || formatPubkey(partner.pubkey)}
                        </span>
                        {partner.status === 'pending' && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 shrink-0">
                            Pending
                          </Badge>
                        )}
                        {partner.status === 'accepted' && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 shrink-0">
                            Accepted ✓
                          </Badge>
                        )}
                        {partner.status === 'declined' && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 shrink-0">
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
                              changePartnerPermission(
                                partner.pubkey,
                                value as 'view' | 'edit'
                              )
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
                            onClick={() => handleRemovePartner(partner.pubkey)}
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
                <strong>💡 Permissions:</strong> Partners with "Can Edit" permission can add
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
    </>
   );
 }

/**
 * Pending Invite Card - shows a received invite with accept/decline actions
 */
interface PendingInviteCardProps {
  invite: BudgetPartnerInvite & { budgetSnapshot?: BudgetState };
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
  const inviterProfile = useAuthor(invite.fromPubkey);
  const inviterName =
    inviterProfile.data?.metadata?.name || genUserName(invite.fromPubkey);
  const hasBudgetData = !!invite.budgetSnapshot;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-blue-500/5">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Inviter info */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
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
              {new Date(`${invite.budgetMonth}-01`).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Permission</span>
            <Badge
              variant={invite.permission === 'edit' ? 'default' : 'secondary'}
              className="w-fit text-[10px]"
            >
              {invite.permission === 'edit' ? (
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
        {hasBudgetData && (
          <div className="p-2 rounded bg-muted/50 border border-muted">
            <p className="text-[11px] text-muted-foreground">
              💡 Accepting will download the shared budget to your device. You'll be
              able to {invite.permission === 'edit' ? 'add transactions and edit categories' : 'view transactions'}.
            </p>
          </div>
        )}

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
