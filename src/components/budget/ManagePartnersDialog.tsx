import { useState } from 'react';
import { Plus, Trash2, Shield, Eye, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
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
import type { BudgetPartner } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface ManagePartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: BudgetPartner[];
  userRole?: 'owner' | 'editor' | 'viewer';
  onAddPartner: (pubkey: string, permission: 'view' | 'edit') => void;
  onRemovePartner: (pubkey: string) => void;
  onChangePermission: (pubkey: string, permission: 'view' | 'edit') => void;
}

export function ManagePartnersDialog({
  open,
  onOpenChange,
  partners,
  userRole = 'owner',
  onAddPartner,
  onRemovePartner,
  onChangePermission,
}: ManagePartnersDialogProps) {
  const [newPartnerPubkey, setNewPartnerPubkey] = useState('');
  const [newPartnerPermission, setNewPartnerPermission] = useState<'view' | 'edit'>('edit');
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { toast } = useToast();

  const isOwner = userRole === 'owner';

  const handleAddPartner = () => {
    const pubkey = newPartnerPubkey.trim();
    setValidationError('');
    
    if (!pubkey) {
      setValidationError('Please enter a Nostr address');
      return;
    }

    // Basic validation - should be 64 char hex or npub address (starts with 'npub1')
    const isHex = /^[0-9a-f]{64}$/i.test(pubkey);
    const isNpub = pubkey.startsWith('npub1') && pubkey.length >= 56;
    
    if (!isHex && !isNpub) {
      setValidationError('Invalid format. Use a 64-character hex key or npub1... address');
      console.warn('[ManagePartnersDialog] Invalid pubkey format:', pubkey);
      return;
    }

    // Check if partner already exists
    if (partners.some(p => p.pubkey === pubkey)) {
      setValidationError('This partner is already added');
      return;
    }

    console.log('[ManagePartnersDialog] Adding partner:', pubkey, 'with permission:', newPartnerPermission);
    onAddPartner(pubkey, newPartnerPermission);
    toast({
      title: 'Partner Added',
      description: `${formatPubkey(pubkey)} has been added with ${newPartnerPermission} permission.`,
    });
    setNewPartnerPubkey('');
    setValidationError('');
    setNewPartnerPermission('edit');
    setIsAdding(false);
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

  const handleRemovePartner = (pubkey: string) => {
    const partner = partners.find(p => p.pubkey === pubkey);
    if (confirm(`Remove ${partner?.name || formatPubkey(pubkey)} from this budget?`)) {
      onRemovePartner(pubkey);
      toast({
        title: 'Partner Removed',
        description: `${partner?.name || formatPubkey(pubkey)} has been removed.`,
      });
    }
  };

  const handleQRScan = (scannedValue: string) => {
    // Handle scanned QR code
    // Could be: npub1..., nostr:npub1..., or raw hex
    let pubkey = scannedValue.trim();
    
    // Remove nostr: prefix if present
    if (pubkey.startsWith('nostr:')) {
      pubkey = pubkey.substring(6);
    }
    
    setNewPartnerPubkey(pubkey);
    setShowQRScanner(false);
    console.log('[ManagePartnersDialog] QR scanned:', pubkey);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                You can add/remove partners and manage permissions. Don't forget to save to sync changes!
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
                        disabled={!newPartnerPubkey.trim()}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsAdding(false);
                          setNewPartnerPubkey('');
                          setNewPartnerPermission('edit');
                        }}
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
            <Label>Current Partners</Label>
            {partners.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No partners yet</p>
                {isOwner && (
                  <p className="text-xs mt-1">Add someone to collaborate on this budget</p>
                )}
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {partners.map((partner) => (
                    <div
                      key={partner.pubkey}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                    >
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="text-sm font-medium truncate">
                             {partner.name || formatPubkey(partner.pubkey)}
                           </span>
                           <Badge
                             variant="secondary"
                             className="flex items-center gap-1 shrink-0"
                           >
                             {getPermissionIcon(partner.permission)}
                             <span className="capitalize text-xs">
                               {partner.permission === 'edit' ? 'Editor' : 'Viewer'}
                             </span>
                           </Badge>
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
                          <p className="text-xs text-muted-foreground mt-1">
                            Last active{' '}
                            {new Date(partner.lastActive * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {isOwner && (
                        <div className="flex gap-1 ml-2 shrink-0">
                          <Select
                            value={partner.permission}
                            onValueChange={(value) =>
                              onChangePermission(
                                partner.pubkey,
                                value as 'view' | 'edit'
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">View</SelectItem>
                              <SelectItem value="edit">Edit</SelectItem>
                            </SelectContent>
                          </Select>

                           <Button
                             size="icon"
                             variant="ghost"
                             className="h-8 w-8 text-destructive hover:text-destructive"
                             onClick={() => handleRemovePartner(partner.pubkey)}
                             title="Remove partner"
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
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
                <strong>ℹ️ How it works:</strong> When you add a partner, they won't see the budget
                automatically. After adding them here, click the Save button in the bottom nav bar to
                sync the partner list to Nostr. Then share this app URL with them so they can log in
                with their Nostr account and see the shared budget.
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
