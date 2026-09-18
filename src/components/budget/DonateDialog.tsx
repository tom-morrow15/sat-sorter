import { useState, useEffect, useCallback, useMemo } from 'react';
import { Heart, Zap, Copy, Check, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { useWallet } from '@/hooks/useWallet';
import { useNWC } from '@/hooks/useNWCContext';
import { useBitcoinPrice, usdToSats, formatSats, formatUsd } from '@/hooks/useBitcoinPrice';

// Lightning address that supports Sat Sorter development.
export const SAT_SORTER_LIGHTNING_ADDRESS = 'satsorter@getalby.com';

// The suggested default donation, in USD.
const DEFAULT_USD = 5;

// Quick-pick presets, in USD.
const USD_PRESETS = [1, 5, 10, 21];

type Stage = 'amount' | 'invoice' | 'success';

interface DonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Resolve a Lightning address (user@domain) to its LNURL-pay metadata.
 */
async function resolveLightningAddress(address: string): Promise<{
  callback: string;
  minSendable: number; // millisats
  maxSendable: number; // millisats
}> {
  const [name, domain] = address.split('@');
  if (!name || !domain) {
    throw new Error('Invalid Lightning address.');
  }

  const res = await fetch(`https://${domain}/.well-known/lnurlp/${name}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error('Could not reach the Lightning service.');
  }

  const data = await res.json();
  if (data.status === 'ERROR' || !data.callback) {
    throw new Error(data.reason || 'Lightning service returned an error.');
  }

  return {
    callback: data.callback,
    minSendable: data.minSendable ?? 1000,
    maxSendable: data.maxSendable ?? 100_000_000_000,
  };
}

/**
 * Request a bolt11 invoice from an LNURL-pay callback for a given amount.
 */
async function requestInvoice(
  callback: string,
  amountSats: number,
  comment: string
): Promise<string> {
  const amountMillisats = amountSats * 1000;
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMillisats));
  if (comment.trim()) {
    url.searchParams.set('comment', comment.trim().slice(0, 200));
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  if (!res.ok || data.status === 'ERROR' || !data.pr) {
    throw new Error(data.reason || 'Could not generate a Lightning invoice.');
  }

  return data.pr as string;
}

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
  const { toast } = useToast();
  const { data: priceData } = useBitcoinPrice();
  const { webln, activeNWC } = useWallet();
  const { sendPayment } = useNWC();

  const [stage, setStage] = useState<Stage>('amount');
  const [unit, setUnit] = useState<'usd' | 'sats'>('usd');
  const [amountInput, setAmountInput] = useState(String(DEFAULT_USD));
  const [comment, setComment] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset everything when the dialog opens.
  useEffect(() => {
    if (open) {
      setStage('amount');
      setUnit('usd');
      setAmountInput(String(DEFAULT_USD));
      setComment('');
      setIsWorking(false);
      setInvoice(null);
      setQrCodeUrl('');
      setCopied(false);
    }
  }, [open]);

  // Compute the donation amount in sats from the current input + unit.
  const amountSats = useMemo(() => {
    const num = parseFloat(amountInput);
    if (!num || num <= 0) return 0;
    if (unit === 'usd') {
      if (!priceData) return 0;
      return usdToSats(num, priceData.usdPerBtc);
    }
    return Math.round(num);
  }, [amountInput, unit, priceData]);

  // A friendly secondary label showing the converted value.
  const conversionLabel = useMemo(() => {
    if (amountSats <= 0) return '';
    if (unit === 'usd') {
      return `≈ ${formatSats(amountSats)} sats`;
    }
    if (priceData) {
      const usd = (amountSats / 100_000_000) * priceData.usdPerBtc;
      return `≈ ${formatUsd(usd)}`;
    }
    return '';
  }, [amountSats, unit, priceData]);

  const handlePreset = (usd: number) => {
    setUnit('usd');
    setAmountInput(String(usd));
  };

  // Generate the QR code whenever we have an invoice to show.
  useEffect(() => {
    let cancelled = false;
    if (!invoice) {
      setQrCodeUrl('');
      return;
    }
    QRCode.toDataURL(invoice.toUpperCase(), {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrCodeUrl(url);
      })
      .catch((err) => console.error('Failed to generate QR code:', err));
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  const handleDonate = useCallback(async () => {
    if (amountSats <= 0) {
      toast({ title: 'Enter an amount', variant: 'destructive' });
      return;
    }

    setIsWorking(true);
    try {
      const { callback } = await resolveLightningAddress(SAT_SORTER_LIGHTNING_ADDRESS);
      const pr = await requestInvoice(callback, amountSats, comment);

      // Try NWC first (auto-pay) if a wallet is connected.
      if (activeNWC && activeNWC.connectionString && activeNWC.isConnected) {
        try {
          await sendPayment(activeNWC, pr);
          setStage('success');
          setIsWorking(false);
          toast({
            title: 'Thank you! 🧡',
            description: `You donated ${formatSats(amountSats)} sats to Sat Sorter.`,
          });
          return;
        } catch (nwcErr) {
          console.error('NWC donation failed, falling back to QR:', nwcErr);
          // Fall through to QR / manual.
        }
      }

      // Try WebLN next.
      if (webln) {
        try {
          // WebLN providers' enable() returns void per spec; just await it.
          if (typeof webln.enable === 'function') {
            await webln.enable();
          }
          await webln.sendPayment(pr);
          setStage('success');
          setIsWorking(false);
          toast({
            title: 'Thank you! 🧡',
            description: `You donated ${formatSats(amountSats)} sats to Sat Sorter.`,
          });
          return;
        } catch (weblnErr) {
          console.error('WebLN donation failed, falling back to QR:', weblnErr);
          // Fall through to QR / manual.
        }
      }

      // No wallet, or auto-pay failed: show the invoice for manual payment.
      setInvoice(pr);
      setStage('invoice');
      setIsWorking(false);
    } catch (err) {
      console.error('Donation error:', err);
      toast({
        title: 'Could not start donation',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setIsWorking(false);
    }
  }, [amountSats, comment, activeNWC, webln, sendPayment, toast]);

  const handleCopy = async () => {
    if (!invoice) return;
    await navigator.clipboard.writeText(invoice);
    setCopied(true);
    toast({ title: 'Invoice copied', description: 'Lightning invoice copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const openInWallet = () => {
    if (invoice) window.open(`lightning:${invoice}`, '_blank');
  };

  const canDonate = amountSats > 0 && !isWorking && (unit === 'sats' || !!priceData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Support Sat Sorter
          </DialogTitle>
          <DialogDescription>
            {stage === 'success'
              ? 'Your support keeps Sat Sorter free and open.'
              : 'Zap some sats to help keep Sat Sorter running and thriving.'}
          </DialogDescription>
        </DialogHeader>

        {/* AMOUNT STAGE */}
        {stage === 'amount' && (
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Sat Sorter is free and open source. If it's useful to you, consider
              chipping in around <span className="font-semibold text-foreground">$5/month</span> to
              help cover hosting and keep development alive. Any amount is appreciated.
            </p>

            {/* Quick presets */}
            <div className="grid grid-cols-4 gap-2">
              {USD_PRESETS.map((usd) => {
                const active = unit === 'usd' && parseFloat(amountInput) === usd;
                return (
                  <button
                    key={usd}
                    type="button"
                    onClick={() => handlePreset(usd)}
                    className={cn(
                      'rounded-lg border-2 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted bg-muted/40 hover:bg-muted'
                    )}
                  >
                    ${usd}
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="donate-amount">Custom amount</Label>
                <div className="inline-flex rounded-md border p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setUnit('usd')}
                    className={cn(
                      'px-2 py-0.5 rounded-sm transition-colors',
                      unit === 'usd' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('sats')}
                    className={cn(
                      'px-2 py-0.5 rounded-sm transition-colors',
                      unit === 'sats' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    sats
                  </button>
                </div>
              </div>
              <div className="relative">
                {unit === 'usd' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                )}
                <Input
                  id="donate-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={unit === 'usd' ? '0.01' : '1'}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={cn(unit === 'usd' && 'pl-7')}
                  placeholder={unit === 'usd' ? '5.00' : '5000'}
                />
              </div>
              {conversionLabel && (
                <p className="text-xs text-muted-foreground">{conversionLabel}</p>
              )}
            </div>

            {/* Optional comment */}
            <div className="space-y-2">
              <Label htmlFor="donate-comment">Note (optional)</Label>
              <Textarea
                id="donate-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 200))}
                placeholder="Say hi or leave a message..."
                rows={2}
                className="resize-none"
              />
            </div>

            <Button className="w-full" onClick={handleDonate} disabled={!canDonate}>
              {isWorking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Donate {amountSats > 0 ? `${formatSats(amountSats)} sats` : ''}
                </>
              )}
            </Button>
          </div>
        )}

        {/* INVOICE STAGE */}
        {stage === 'invoice' && invoice && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground text-center">
              Scan with any Lightning wallet to donate{' '}
              <span className="font-semibold text-foreground">{formatSats(amountSats)} sats</span>.
            </p>

            {qrCodeUrl && (
              <div className="flex justify-center">
                <img
                  src={qrCodeUrl}
                  alt="Lightning donation QR code"
                  className="h-56 w-56 rounded-lg border bg-white p-2"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="donate-invoice">Lightning Invoice</Label>
              <div className="flex gap-2">
                <Input
                  id="donate-invoice"
                  value={invoice}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={openInWallet}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Lightning Wallet
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStage('amount')}>
              Back
            </Button>
          </div>
        )}

        {/* SUCCESS STAGE */}
        {stage === 'success' && (
          <div className="space-y-4 py-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-success/10 p-4">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Thank you! 🧡</h3>
              <p className="text-sm text-muted-foreground">
                You donated {formatSats(amountSats)} sats to Sat Sorter. Your support
                directly funds hosting and ongoing development.
              </p>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
