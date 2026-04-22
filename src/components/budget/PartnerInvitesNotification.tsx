import { useState } from 'react';
import { Bell, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePartnerInvites } from '@/hooks/usePartnerInvites';
import { useBudget } from '@/hooks/useBudget';
import { useAuthor } from '@/hooks/useAuthor';
import type { BudgetPartnerInvite } from '@/lib/budgetTypes';
import { genUserName } from '@/lib/genUserName';

export function PartnerInvitesNotification() {
  const { receivedInvites, isLoadingInvites, acceptInvite, declineInvite } =
    usePartnerInvites();
  const { fullState } = useBudget();
  const [selectedInvite, setSelectedInvite] = useState<BudgetPartnerInvite | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get inviter profile info
  const inviterProfile = useAuthor(selectedInvite?.fromPubkey || '');

  // Filter to only pending invites
  const pendingInvites = receivedInvites.filter((i) => i.status === 'pending');

  if (pendingInvites.length === 0) {
    return null;
  }

  const handleAccept = async () => {
    if (!selectedInvite) return;
    setIsProcessing(true);
    try {
      const success = await acceptInvite(selectedInvite, fullState);
      if (success) {
        setShowDialog(false);
        setSelectedInvite(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedInvite) return;
    setIsProcessing(true);
    try {
      const success = await declineInvite(selectedInvite);
      if (success) {
        setShowDialog(false);
        setSelectedInvite(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInviteClick = (invite: BudgetPartnerInvite) => {
    setSelectedInvite(invite);
    setShowDialog(true);
  };

  return (
    <>
      {/* Notification banner */}
      {pendingInvites.length > 0 && (
        <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/30 mb-4">
          <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-blue-900 dark:text-blue-100">
              You have {pendingInvites.length} partner invite
              {pendingInvites.length !== 1 ? 's' : ''} to review
            </span>
            <div className="flex gap-2">
              {pendingInvites.map((invite) => (
                <Button
                  key={invite.id}
                  size="sm"
                  variant="outline"
                  onClick={() => handleInviteClick(invite)}
                  className="text-xs"
                >
                  View
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Invite Details Dialog */}
      {selectedInvite && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Budget Partner Invite</DialogTitle>
              <DialogDescription>
                You've been invited to collaborate on a shared budget
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Inviter Info */}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">From</p>
                <p className="font-medium">
                  {inviterProfile.data?.metadata?.name ||
                    genUserName(selectedInvite.fromPubkey)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedInvite.fromPubkey.slice(0, 16)}...
                </p>
              </div>

              {/* Invite Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Budget Month:</span>
                  <span className="font-medium">
                    {new Date(`${selectedInvite.budgetMonth}-01`).toLocaleDateString(
                      'en-US',
                      { month: 'long', year: 'numeric' }
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Permission:</span>
                  <Badge
                    variant={
                      selectedInvite.permission === 'edit' ? 'default' : 'secondary'
                    }
                  >
                    {selectedInvite.permission === 'edit' ? 'Can Edit' : 'View Only'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invited:</span>
                  <span className="font-medium text-xs">
                    {new Date(selectedInvite.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Permission explanation */}
              {selectedInvite.permission === 'edit' && (
                <div className="p-2 rounded bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200/50">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    This partner can add, edit, and delete transactions in this budget.
                  </p>
                </div>
              )}
              {selectedInvite.permission === 'view' && (
                <div className="p-2 rounded bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200/50">
                  <p className="text-xs text-blue-900 dark:text-blue-200">
                    This partner can only view transactions. They cannot make changes.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleDecline}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Decline
              </Button>
              <Button onClick={handleAccept} disabled={isProcessing}>
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Accept
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
