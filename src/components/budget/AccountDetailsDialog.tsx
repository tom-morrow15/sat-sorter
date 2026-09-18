import { useState } from 'react';
import { Eye, EyeOff, Copy, KeyRound, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { useNostrLogin } from '@nostrify/react/login';
import { nip19 } from 'nostr-tools';
import { genUserName } from '@/lib/genUserName';

interface AccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDetailsDialog({ open, onOpenChange }: AccountDetailsDialogProps) {
  const { logins } = useNostrLogin();
  const { toast } = useToast();
  const [showNsec, setShowNsec] = useState(false);

  // Find the current user's nsec from the login store
  const nsecLogin = logins.find((l: any) => l.type === 'nsec' && l.data?.nsec);
  const nsec = (nsecLogin?.data as { nsec?: string } | undefined)?.nsec;

  // Get pubkey from the first available login
  const pubkey = logins.find((l: any) => l.pubkey)?.pubkey as string | undefined;
  const npub = pubkey ? nip19.npubEncode(pubkey) : '';

  // Get display name
  const name = pubkey ? genUserName(pubkey) : 'Unknown';

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Details
          </DialogTitle>
          <DialogDescription>
            Your Nostr identity keys. Keep your private key (nsec) secure — anyone with it can access your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Profile */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/20 border border-border/40">
            <Avatar className="w-10 h-10">
              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-xs text-muted-foreground">Nostr identity</p>
            </div>
          </div>

          {/* Public key (npub) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Public Key (npub)</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => npub && handleCopy(npub, 'Public key')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="p-2.5 rounded-md bg-muted/30 border border-border/40 font-mono text-[11px] break-all">
              {npub || 'Not available'}
            </div>
          </div>

          {/* Private key (nsec) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Private Key (nsec)</span>
              <div className="flex items-center gap-1">
                {nsec && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => setShowNsec(!showNsec)}
                  >
                    {showNsec ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {showNsec && nsec && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => handleCopy(nsec, 'Private key')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 font-mono text-[11px] break-all">
              {nsec ? (
                showNsec ? nsec : '•'.repeat(20) + ' ' + nsec.slice(-8)
              ) : (
                <span className="text-muted-foreground">Not available (extension login)</span>
              )}
            </div>
            {showNsec && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Anyone with this key has full access to your account. Never share it.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
