import { useEffect, useState } from 'react';
import { QrCode, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { nip19 } from 'nostr-tools';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';

interface MyNpubQrProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shows the current user's npub as a QR code for easy partner linking.
 * The partner can scan this QR code to get your npub for the invite.
 */
export function MyNpubQr({ open, onOpenChange }: MyNpubQrProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!user?.pubkey) return null;

  const npub = nip19.npubEncode(user.pubkey);
  const displayName = user.metadata?.name || genUserName(user.pubkey);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast({ title: 'npub copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const range = document.createRange();
      const el = document.getElementById('npub-text');
      if (el) {
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Your Nostr Address
          </DialogTitle>
          <DialogDescription>
            Share this QR code or npub with your partner so they can send you a budget invite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* QR Code — generated client-side from the npub */}
          <div className="flex justify-center p-4 bg-white rounded-xl border">
            <NpubQrCode value={npub} size={200} />
          </div>

          {/* npub text — copyable */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code
                id="npub-text"
                className="flex-1 text-xs font-mono break-all select-all"
              >
                {npub}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
                title="Copy npub"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {displayName}
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your partner can scan this QR code or paste your npub to add you as a budget partner.
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simple QR code renderer using the qrcode package (already in dependencies).
 * Renders the npub as a QR code canvas.
 */
function NpubQrCode({ value, size }: { value: string; size: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Dynamic import to avoid bundling qrcode on every page load
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then((url: string) => setDataUrl(url))
        .catch(() => setDataUrl(null));
    });
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-muted rounded-lg"
      >
        <QrCode className="h-8 w-8 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Your Nostr npub QR code"
      width={size}
      height={size}
      className="rounded-lg"
    />
  );
}
