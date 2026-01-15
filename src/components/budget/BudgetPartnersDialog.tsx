import { useState } from 'react';
import {
  Users,
  UserPlus,
  Send,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Info,
  Crown,
  X,
  Menu,
  ScanLine,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { QRScanner } from './QRScanner';

interface BudgetPartnersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isShared: boolean;
  ownerPubkey?: string;
  partnerPubkeys?: string[];
  onInvitePartner: (npub: string) => Promise<boolean>;
  onRemovePartner?: (pubkey: string) => Promise<boolean>;
}

export function BudgetPartnersDialog({
  open,
  onOpenChange,
  isShared,
  ownerPubkey,
  partnerPubkeys = [],
  onInvitePartner,
  onRemovePartner,
}: BudgetPartnersDialogProps) {
  const { user } = useCurrentUser();
  const [inviteInput, setInviteInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const isOwner = user?.pubkey === ownerPubkey;
  const hasPartners = partnerPubkeys.length > 0;

  // Handle scanned QR code
  const handleQRScan = (result: string) => {
    // Clean up the result - handle nostr: URIs and raw npubs
    let npub = result.trim();
    if (npub.startsWith('nostr:')) {
      npub = npub.replace('nostr:', '');
    }
    setInviteInput(npub);
    setInviteError('');
  };

  const handleInvite = async () => {
    if (!inviteInput.trim()) return;

    setIsInviting(true);
    setInviteError('');
    setInviteSuccess(false);

    try {
      const success = await onInvitePartner(inviteInput.trim());
      if (success) {
        setInviteSuccess(true);
        setInviteInput('');
        setTimeout(() => setInviteSuccess(false), 3000);
      } else {
        setInviteError('Failed to send invite. Please check the address and try again.');
      }
    } catch {
      setInviteError('Invalid Nostr address. Use an npub or NIP-05 address.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Budget Partners
          </DialogTitle>
          <DialogDescription>
            Share your budget with a spouse or partner for collaborative budgeting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Info box for new users */}
          {!isShared && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">How Budget Partners Works</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Invite your partner using their Nostr address</li>
                    <li>• They'll receive an invite and can accept it when they log in</li>
                    <li>• Both of you can view and edit the same budget</li>
                    <li>• Changes sync automatically between devices</li>
                    <li>• Your data stays encrypted — only you and your partner can read it</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Learn more about Nostr in the <Menu className="h-3 w-3 inline mx-0.5" /> menu
                    under <strong>"Learn About Nostr"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Partners */}
          {(isShared || hasPartners) && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">Current Partners</h3>
              <div className="space-y-2">
                {/* Owner */}
                {ownerPubkey && (
                  <PartnerRow
                    pubkey={ownerPubkey}
                    isOwner={true}
                    isCurrentUser={user?.pubkey === ownerPubkey}
                    onRemove={undefined}
                  />
                )}

                {/* Partners */}
                {partnerPubkeys
                  .filter(pk => pk !== ownerPubkey)
                  .map(pubkey => (
                    <PartnerRow
                      key={pubkey}
                      pubkey={pubkey}
                      isOwner={false}
                      isCurrentUser={user?.pubkey === pubkey}
                      onRemove={isOwner && onRemovePartner ? () => onRemovePartner(pubkey) : undefined}
                    />
                  ))
                }
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {/* Invite Section */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite a Partner
            </h3>

            {!user ? (
              <div className="p-4 rounded-lg bg-muted text-center">
                <p className="text-sm text-muted-foreground">
                  Log in with Nostr to invite a budget partner.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="partner-address" className="text-xs">
                    Partner's Nostr Address
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="partner-address"
                      value={inviteInput}
                      onChange={(e) => {
                        setInviteInput(e.target.value);
                        setInviteError('');
                      }}
                      placeholder="npub1... or user@domain.com"
                      className="flex-1"
                      disabled={isInviting}
                    />
                    {/* QR Scan button - visible on tablet and mobile */}
                    <Button
                      variant="outline"
                      onClick={() => setShowQRScanner(true)}
                      disabled={isInviting}
                      className="lg:hidden"
                      title="Scan QR code"
                    >
                      <ScanLine className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleInvite}
                      disabled={!inviteInput.trim() || isInviting}
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : inviteSuccess ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {inviteError && (
                  <p className="text-xs text-destructive">{inviteError}</p>
                )}

                {inviteSuccess && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ Invite sent! They'll see it when they open Sat Sorter.
                  </p>
                )}

                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    <strong>Don't have their Nostr address?</strong> Ask them to sign up at{' '}
                    <a
                      href="https://primal.net/downloads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Primal <ExternalLink className="h-3 w-3" />
                    </a>
                    {' '}and share their npub with you.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* QR Scanner Dialog - placed outside main dialog to avoid nesting issues */}
    <QRScanner
      open={showQRScanner}
      onOpenChange={setShowQRScanner}
      onScan={handleQRScan}
      title="Scan Partner's npub"
      description="Scan a QR code containing your partner's Nostr address (npub)"
    />
    </>
  );
}

// Partner row component
function PartnerRow({
  pubkey,
  isOwner,
  isCurrentUser,
  onRemove
}: {
  pubkey: string;
  isOwner: boolean;
  isCurrentUser: boolean;
  onRemove?: () => Promise<boolean>;
}) {
  const author = useAuthor(pubkey);
  const [isRemoving, setIsRemoving] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || genUserName(pubkey);
  const picture = metadata?.picture;

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    await onRemove();
    setIsRemoving(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Avatar className="h-10 w-10">
        <AvatarImage src={picture} />
        <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{displayName}</span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs">You</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Badge variant="outline" className="text-xs gap-1">
              <Crown className="h-3 w-3" />
              Owner
            </Badge>
          )}
        </div>
      </div>

      {onRemove && !isCurrentUser && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
