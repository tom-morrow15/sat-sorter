import { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

interface BudgetKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetNsec?: string;
  budgetNpub?: string;
}

export function BudgetKeyDialog({
  open,
  onOpenChange,
  budgetNsec,
  budgetNpub,
}: BudgetKeyDialogProps) {
  const [showKey, setShowKey] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const { toast } = useToast();

  // Generate QR whenever dialog opens and we have a key
  useEffect(() => {
    if (open && budgetNsec) {
      QRCode.toDataURL(budgetNsec, {
        width: 280,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then(setQrCodeUrl)
        .catch((err) => {
          console.error('Failed to generate budget key QR:', err);
          setQrCodeUrl('');
        });
    } else {
      setQrCodeUrl('');
      setShowKey(false);
    }
  }, [open, budgetNsec]);

  const copyKey = async () => {
    if (!budgetNsec) return;
    try {
      await navigator.clipboard.writeText(budgetNsec);
      toast({
        title: 'Copied!',
        description: 'Budget key copied to clipboard. Share securely with your partner.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the key. Please select and copy manually.',
        variant: 'destructive',
      });
    }
  };

  const copyNpub = async () => {
    if (!budgetNpub) return;
    try {
      await navigator.clipboard.writeText(budgetNpub);
      toast({
        title: 'Copied!',
        description: 'Budget public key copied.',
      });
    } catch {
      // ignore
    }
  };

  if (!budgetNsec) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Budget Key (Build Key)
            </DialogTitle>
            <DialogDescription>
              No budget key has been generated yet.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            A shared budget key is created automatically the first time you add a Budget Partner.
            Go to <strong>Budget Partners</strong> in the menu and invite someone to generate your build key.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Budget Key (Build Key)
          </DialogTitle>
          <DialogDescription>
            This is the shared secret key for your budget. Scan or copy it to let a budget partner join and sync data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
            ⚠️ This key controls access to the entire shared budget. Only share it with people you trust completely.
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Budget key QR code"
                  className="w-[240px] h-[240px] sm:w-[260px] sm:h-[260px]"
                />
              ) : (
                <div className="w-[240px] h-[240px] flex items-center justify-center text-muted-foreground">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Scan this with your partner's phone to share the budget key
            </p>
          </div>

          {/* The actual key (masked) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Secret key (nsec)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="h-7 px-2 text-xs"
              >
                {showKey ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Show
                  </>
                )}
              </Button>
            </div>

            <div className="relative rounded-lg border bg-muted/40 p-3 font-mono text-xs break-all select-all">
              {showKey ? budgetNsec : '•'.repeat(12) + ' ' + budgetNsec.slice(-8)}
            </div>

            <div className="flex gap-2">
              <Button onClick={copyKey} className="flex-1" variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy key
              </Button>
              {budgetNpub && (
                <Button onClick={copyNpub} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy npub
                </Button>
              )}
            </div>
          </div>

          {budgetNpub && (
            <div className="text-[10px] text-muted-foreground break-all">
              Public key: {budgetNpub}
            </div>
          )}
        </div>

        <div className="pt-2 text-[10px] text-muted-foreground">
          Partners will usually receive this key automatically via encrypted Nostr invite. Use this QR/manual copy only for direct sharing.
        </div>
      </DialogContent>
    </Dialog>
  );
}
