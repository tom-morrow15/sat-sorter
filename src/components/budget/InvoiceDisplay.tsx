import { useState } from 'react';
import { Copy, Check, QrCode as QrCodeIcon } from 'lucide-react';
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
  const { showToast } = useToast();

  // Generate QR code on mount
  if (!qrImage && showQR) {
    QRCode.toDataURL(invoice, {
      errorCorrectionLevel: 'H',
      type: 'image/webp',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(setQrImage)
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        setShowQR(false);
      });
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      setCopied(true);
      showToast({ title: 'Copied!', description: 'Invoice copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast({ 
        title: 'Error', 
        description: 'Failed to copy invoice',
        variant: 'destructive'
      });
    }
  };

  const satoshis = Math.round(amount / 1000);

  return (
    <div className="space-y-4">
      {/* Amount display */}
      <div className="bh-panel p-4 text-center border-l-4 border-l-amber-500">
        <p className="bh-caption text-muted-foreground mb-1">Amount</p>
        <p className="font-mono text-2xl font-semibold">{satoshis.toLocaleString()} sats</p>
      </div>

      {/* QR Code */}
      {showQR && qrImage && (
        <div className="flex justify-center">
          <div className="bh-panel p-3 rounded-lg">
            <img 
              src={qrImage} 
              alt="Lightning invoice QR code" 
              className="w-64 h-64"
            />
          </div>
        </div>
      )}

      {/* Copy invoice button */}
      <div className="space-y-2">
        <p className="bh-caption text-muted-foreground">Invoice</p>
        <div className="flex gap-2">
          <div className="flex-1 bh-panel p-3 rounded-lg overflow-auto">
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
          <li>Scan the QR code with your Lightning wallet, or</li>
          <li>Copy and paste the invoice into your wallet</li>
          <li>Confirm the payment in your wallet</li>
          <li>Your access will unlock once payment is received</li>
        </ol>
      </div>

      {/* Toggle QR/Invoice view */}
      {showQR && qrImage && (
        <Button
          variant="outline"
          onClick={() => setShowQR(!showQR)}
          className="w-full flex items-center justify-center gap-2"
        >
          <QrCodeIcon className="h-4 w-4" />
          {showQR ? 'Show Invoice' : 'Show QR Code'}
        </Button>
      )}
    </div>
  );
}
