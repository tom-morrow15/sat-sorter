import { useState, useEffect } from 'react';
import { Copy, Check, QrCode as QrCodeIcon, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface InvoiceDisplayProps {
  invoice: string; // bolt11 invoice
  amount: number; // amount in millisatoshis
}

export function InvoiceDisplay({ invoice, amount }: InvoiceDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [qrImage, setQrImage] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(true);
  const { toast } = useToast();

  // Generate QR code in useEffect (not during render)
  useEffect(() => {
    if (!showQR || !invoice) return;

    setQrLoading(true);
    QRCode.toDataURL(invoice, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrImage(url);
        setQrLoading(false);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        setQrLoading(false);
        setShowQR(false);
      });
  }, [invoice, showQR]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Invoice copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = invoice;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast({ title: 'Copied!', description: 'Invoice copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast({
          title: 'Error',
          description: 'Failed to copy invoice',
          variant: 'destructive',
        });
      }
      document.body.removeChild(textarea);
    }
  };

  const satoshis = Math.round(amount / 1000);

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="bh-panel p-4 text-center border-l-4 border-l-amber-500">
        <p className="bh-caption text-muted-foreground mb-1">Amount Due</p>
        <p className="font-mono text-2xl font-semibold">{satoshis.toLocaleString()} sats</p>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="flex justify-center">
          <div className="bh-panel p-2.5 rounded-lg">
            {qrLoading ? (
              <div className="w-[240px] h-[240px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : qrImage ? (
              <img
                src={qrImage}
                alt="Lightning invoice QR code"
                className="w-[240px] h-[240px]"
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Copy invoice button */}
      <div className="space-y-2">
        <p className="bh-caption text-muted-foreground">Lightning Invoice</p>
        <div className="flex gap-2">
          <div className="flex-1 bh-panel p-3 rounded-lg overflow-auto max-h-20">
            <code className="text-xs font-mono text-muted-foreground break-all">
              {invoice}
            </code>
          </div>
          <Button
            size="icon"
            onClick={handleCopy}
            className={cn(
              'flex-shrink-0',
              copied && 'bg-green-600 hover:bg-green-700'
            )}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bh-panel p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          How to pay:
        </p>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
          <li>Open your Lightning wallet</li>
          <li>Scan the QR code, or paste the invoice</li>
          <li>Confirm and send the payment</li>
          <li>Your buckets will unlock automatically — keep this window open</li>
        </ol>
      </div>

      {/* Toggle QR/Invoice view */}
      {qrImage && (
        <Button
          variant="outline"
          onClick={() => setShowQR(!showQR)}
          className="w-full flex items-center justify-center gap-2"
        >
          <QrCodeIcon className="h-4 w-4" />
          {showQR ? 'Hide QR Code' : 'Show QR Code'}
        </Button>
      )}
    </div>
  );
}
