import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Zap, CheckCircle2, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { InvoiceDisplay } from './InvoiceDisplay';
import { useCreateInvoice, useVerifyPayment, type SubscriptionStatus } from '@/hooks/useSubscription';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketCount: number;
  maxBucketsForFreeTier: number;
  onUpgradeComplete?: () => void;
}

interface UpgradeTier {
  id: string;
  name: string;
  price: number; // in USD
  buckets: number;
  description: string;
}

const SATS_PER_USD = 50000;

const UPGRADE_TIERS: UpgradeTier[] = [
  {
    id: 'plus-1',
    name: '+1 Bucket',
    price: 1,
    buckets: 1,
    description: 'Add 1 additional budget bucket for this month',
  },
  {
    id: 'plus-2',
    name: '+2 Buckets',
    price: 2,
    buckets: 2,
    description: 'Add 2 additional budget buckets for this month',
  },
  {
    id: 'plus-3',
    name: '+3 Buckets',
    price: 3,
    buckets: 3,
    description: 'Add 3 additional budget buckets for this month',
  },
  {
    id: 'plus-4',
    name: '+4 Buckets',
    price: 4,
    buckets: 4,
    description: 'Add 4 additional budget buckets for this month',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 5,
    buckets: Infinity,
    description: 'Unlimited buckets and line items for this month',
  },
];

type DialogState = 'selecting' | 'invoice' | 'verifying' | 'success' | 'error';

export function UpgradeDialog({
  open,
  onOpenChange,
  bucketCount,
  maxBucketsForFreeTier,
  onUpgradeComplete,
}: UpgradeDialogProps) {
  const [state, setState] = useState<DialogState>('selecting');
  const [selectedTier, setSelectedTier] = useState<UpgradeTier | null>(null);
  const [invoiceData, setInvoiceData] = useState<{ pr: string; invoiceId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();
  const createInvoice = useCreateInvoice();
  const verifyPayment = useVerifyPayment();

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling when dialog closes
  useEffect(() => {
    if (!open) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setState('selecting');
      setSelectedTier(null);
      setInvoiceData(null);
      setErrorMessage('');
    }
  }, [open]);

  // Start polling for payment when invoice is shown
  useEffect(() => {
    if (state !== 'invoice' || !invoiceData) return;

    // Poll every 4 seconds
    pollRef.current = setInterval(async () => {
      try {
        const result = await verifyPayment(invoiceData.invoiceId);

        if (result.success && (result.paid || result.alreadyPaid)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setState('success');
          showToast({
            title: 'Payment Received!',
            description: 'Your subscription has been upgraded.',
          });

          // Notify parent after a short delay so user sees the success state
          setTimeout(() => {
            onUpgradeComplete?.();
            onOpenChange(false);
          }, 2000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't show error on every poll failure — just keep trying
      }
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state, invoiceData, verifyPayment, showToast, onUpgradeComplete, onOpenChange]);

  const handleSelectTier = async (tier: UpgradeTier) => {
    setSelectedTier(tier);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const satoshis = tier.price * SATS_PER_USD;
      const millisatoshis = satoshis * 1000;

      const result = await createInvoice(
        millisatoshis,
        `Sat Sorter - ${tier.name}`
      );

      setInvoiceData({
        pr: result.invoice.pr,
        invoiceId: result.invoiceId,
      });
      setState('invoice');
    } catch (error) {
      console.error('Error creating invoice:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create invoice');
      setState('error');
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setState('selecting');
    setSelectedTier(null);
    setInvoiceData(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setState('selecting');
    setSelectedTier(null);
    setInvoiceData(null);
    setErrorMessage('');
    onOpenChange(false);
  };

  const remainingBucketsNeeded = bucketCount - maxBucketsForFreeTier;
  const suggestedTier = UPGRADE_TIERS.find(t => t.buckets >= remainingBucketsNeeded && t.buckets !== Infinity) ?? UPGRADE_TIERS[UPGRADE_TIERS.length - 1];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : state === 'error' ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            )}
            {state === 'success'
              ? 'Payment Confirmed!'
              : state === 'error'
                ? 'Something Went Wrong'
                : 'Bucket Limit Reached'}
          </DialogTitle>
          <DialogDescription>
            {state === 'success'
              ? 'Your subscription has been upgraded. You can now add more buckets.'
              : state === 'error'
                ? errorMessage
                : `You've reached the limit of ${maxBucketsForFreeTier} free budget buckets. Upgrade this month to add more.`}
          </DialogDescription>
        </DialogHeader>

        {/* ─── SUCCESS STATE ─── */}
        {state === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-lg font-medium text-foreground">
              {selectedTier?.name} activated!
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedTier?.description}
            </p>
          </div>
        )}

        {/* ─── ERROR STATE ─── */}
        {state === 'error' && (
          <div className="py-4 space-y-4">
            <div className="bh-panel p-4 rounded-lg bg-red-50 dark:bg-red-950 border-l-4 border-l-red-500">
              <p className="text-sm text-red-900 dark:text-red-100">{errorMessage}</p>
            </div>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {/* ─── INVOICE STATE (waiting for payment) ─── */}
        {state === 'invoice' && invoiceData && selectedTier && (
          <div className="space-y-4 py-4">
            {/* Selected tier summary */}
            <div className="bh-panel p-3 rounded-lg bg-green-50 dark:bg-green-950 border-l-4 border-l-green-500 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  ✓ {selectedTier.name}
                </p>
                <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                  {selectedTier.description}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold text-green-900 dark:text-green-100">
                  ${selectedTier.price}
                </p>
              </div>
            </div>

            {/* QR code + invoice */}
            <InvoiceDisplay
              invoice={invoiceData.pr}
              amount={selectedTier.price * SATS_PER_USD * 1000}
            />

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-pulse" />
              Waiting for payment... Keep this window open.
            </div>
          </div>
        )}

        {/* ─── TIER SELECTION STATE ─── */}
        {state === 'selecting' && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Choose how many additional buckets you need for this month:
            </p>

            <div className="grid gap-2">
              {UPGRADE_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => handleSelectTier(tier)}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border-2 transition-colors text-left ${
                    selectedTier?.id === tier.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-border hover:border-blue-300 hover:bg-muted'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {tier.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tier.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold">
                        ${tier.price}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{(tier.price * SATS_PER_USD).toLocaleString()} sats
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Suggestion */}
            {remainingBucketsNeeded > 0 && suggestedTier && (
              <div className="bh-panel p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500 text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  You need {remainingBucketsNeeded} more bucket{remainingBucketsNeeded > 1 ? 's' : ''}.
                  We suggest {suggestedTier.name} (${suggestedTier.price}).
                </p>
              </div>
            )}

            {/* Trial info */}
            <div className="bh-panel p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border-l-4 border-l-amber-500 text-xs">
              <p className="text-amber-900 dark:text-amber-100">
                <strong>How it works:</strong> Pay once for this calendar month.
                Next month you can choose to pay again or use the free tier (5 buckets).
                No recurring charges, no surprises.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {state === 'success' ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : state === 'error' ? (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          ) : state === 'invoice' ? (
            <Button variant="outline" onClick={handleClose}>
              Cancel Payment
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {isLoading && (
                <Button disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Invoice...
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
