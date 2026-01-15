import { useState } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import type { PendingInvitation } from '@/lib/budgetTypes';

interface PendingInvitationBannerProps {
  invitation: PendingInvitation;
  onAccept: (invitation: PendingInvitation) => Promise<boolean>;
  onDecline: (invitation: PendingInvitation) => Promise<boolean>;
}

export function PendingInvitationBanner({
  invitation,
  onAccept,
  onDecline,
}: PendingInvitationBannerProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  
  const author = useAuthor(invitation.fromPubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || genUserName(invitation.fromPubkey);
  const picture = metadata?.picture;

  const handleAccept = async () => {
    setIsAccepting(true);
    await onAccept(invitation);
    setIsAccepting(false);
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    await onDecline(invitation);
    setIsDeclining(false);
  };

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Mail className="h-4 w-4 text-primary" />
      <AlertDescription>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={picture} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm">
                <strong>{displayName}</strong> invited you to collaborate on
              </p>
              <p className="text-sm font-semibold">
                "{invitation.invitation.budgetName}"
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDecline}
              disabled={isAccepting || isDeclining}
            >
              {isDeclining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Decline
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
            >
              {isAccepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
