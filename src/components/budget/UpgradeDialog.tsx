import { useState } from 'react';
import { AlertCircle, Loader2, Zap } from 'lucide-react';
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
import { useCreateInvoice } from '@/hooks/useSubscription';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketCount: number;
  maxBucketsForFreeTier: number;
}

interface UpgradeTier {
  id: string;
  name: string;
  price: number; // in USD
  buckets: number;
  description: string;
}

const UPGRADE_TIERS: UpgradeTier[] = [
  {
    id: 'plus-1',
    name: '+1 Bucket',
    price: 1,
    buckets: 1,
    description: 'Add 1 additional budget bucket',
  },
  {
    id: 'plus-2',
    name: '+2 Buckets',
    price: 2,
    buckets: 2,
    description: 'Add 2 additional budget buckets',
  },
  {
    id: 'plus-3',
    name: '+3 Buckets',
    price: 3,
    buckets: 3,
    description: 'Add 3 additional budget buckets',
  },
  {
    id: 'plus-4',
    name: '+4 Buckets',
    price: 4,
    buckets: 4,
    description: 'Add 4 additional budget buckets',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 5,
    buckets: Infinity,
    description: 'Unlimited buckets and line items for this month',
  },
];

export function UpgradeDialog({
  open,
  onOpenChange,
  bucketCount,
  maxBucketsForFreeTier,
}: UpgradeDialogProps) {
  const [selectedTier, setSelectedTier] = useState<UpgradeTier | null>(null);
  const [invoice, setInvoice] = useState<{ pr: string; verify: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const createInvoice = useCreateInvoice();

  const remainingBucketsAvailable = bucketCount - maxBucketsForFreeTier;
  const suggestedTier = UPGRADE_TIERS.find(t => t.buckets >= remainingBucketsAvailable);

  const handleSelectTier = async (tier: UpgradeTier) => {
    setSelectedTier(tier);
    setIsLoading(true);

    try {
      // Convert USD to millisatoshis (roughly)
      // Using 50,000 sats per dollar as average
      const satoshis = tier.price * 50000;
      const millisatoshis = satoshis * 1000;

      const result = await createInvoice(
        millisatoshis,
        `Sat Sorter - ${tier.name}`
      );

      setInvoice(result.invoice);
      showToast({
        title: 'Invoice Created',
        description: `Ready to pay for ${tier.name}`,
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      showToast({
        title: 'Error',
        description: 'Failed to create invoice. Please try again.',
        variant: 'destructive',
      });
      setSelectedTier(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTier(null);
    setInvoice(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Bucket Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've reached the limit of {maxBucketsForFreeTier} free budget buckets. Upgrade this month to add more.
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          // Invoice display state
          <div className="space-y-4 py-4">
            <div className="bh-panel p-3 rounded-lg bg-green-50 dark:bg-green-950 border-l-4 border-l-green-500">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                ✓ {selectedTier?.name} selected
              </p>
              <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                {selectedTier?.description}
              </p>
            </div>

            <InvoiceDisplay
              invoice={invoice.pr}
              amount={Math.round((selectedTier?.price ?? 5) * 50000 * 1000)}
            />

            <p className="text-xs text-center text-muted-foreground">
              Your access will activate once the payment is confirmed on the Lightning Network.
              This usually takes a few seconds.
            </p>
          </div>
        ) : (
          // Tier selection state
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
                        ~{Math.round(tier.price * 50000).toLocaleString()} sats
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {suggestedTier && (
              <div className="bh-panel p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500 text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  💡 We suggest {suggestedTier.name} to accommodate your {remainingBucketsAvailable} additional buckets.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {invoice ? (
            <Button
              onClick={handleClose}
              className="w-full"
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => selectedTier && handleSelectTier(selectedTier)}
                disabled={!selectedTier || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Get Invoice
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
