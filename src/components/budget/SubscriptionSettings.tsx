import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Zap, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, useApplyTestCode, useCreateInvoice, useVerifyPayment } from '@/hooks/useSubscription';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { formatDistanceToNow } from 'date-fns';
import { LoginArea } from '@/components/auth/LoginArea';
import { InvoiceDisplay } from './InvoiceDisplay';
import { Input } from '@/components/ui/input';

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
    description: 'Add 1 additional bucket for this month',
  },
  {
    id: 'plus-2',
    name: '+2 Buckets',
    price: 2,
    buckets: 2,
    description: 'Add 2 additional buckets for this month',
  },
  {
    id: 'plus-3',
    name: '+3 Buckets',
    price: 3,
    buckets: 3,
    description: 'Add 3 additional buckets for this month',
  },
  {
    id: 'plus-4',
    name: '+4 Buckets',
    price: 4,
    buckets: 4,
    description: 'Add 4 additional buckets for this month',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 5,
    buckets: Infinity,
    description: 'Unlimited buckets and items for this month',
  },
  {
    id: 'yearly',
    name: 'Yearly Unlimited',
    price: 50,
    buckets: Infinity,
    description: 'Unlimited everything for 12 months',
  },
];

type SettingsState = 'status' | 'selecting' | 'invoice' | 'success';

export function SubscriptionSettings() {
  const { data: subscription, refetch: refetchSubscription } = useSubscription();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { data: priceData } = useBitcoinPrice();
  const createInvoice = useCreateInvoice();
  const verifyPayment = useVerifyPayment();
  const applyTestCode = useApplyTestCode();

  const [state, setState] = useState<SettingsState>('status');
  const [selectedTier, setSelectedTier] = useState<UpgradeTier | null>(null);
  const [invoiceData, setInvoiceData] = useState<{ pr: string; invoiceId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [testCodeInput, setTestCodeInput] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const satsPerUsd = priceData?.satsPerUsd ?? 0;

  // Clean up polling when component unmounts or state changes
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  // Start polling when invoice is shown
  useEffect(() => {
    if (state !== 'invoice' || !invoiceData) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await verifyPayment(invoiceData.invoiceId);
        if (result.success && (result.paid || result.alreadyPaid)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setState('success');
          toast({
            title: 'Power-Up Activated!',
            description: `Your ${selectedTier?.name} is now active.`,
          });
          setTimeout(() => {
            refetchSubscription();
            setState('status');
            setSelectedTier(null);
            setInvoiceData(null);
          }, 2000);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state, invoiceData, verifyPayment, toast, selectedTier, refetchSubscription]);

  const handleSelectTier = async (tier: UpgradeTier) => {
    if (!satsPerUsd) {
      toast({
        title: 'Error',
        description: 'Unable to fetch Bitcoin price. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedTier(tier);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const satoshis = Math.round(tier.price * satsPerUsd);
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
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive',
      });
      setState('status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTestCode = async () => {
    if (!testCodeInput.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a test code',
        variant: 'destructive',
      });
      return;
    }

    setIsApplyingCode(true);
    try {
      const result = await applyTestCode(testCodeInput);
      toast({
        title: 'Success!',
        description: result.message || 'Test code applied',
      });
      setTestCodeInput('');
      refetchSubscription();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply test code',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleBackToStatus = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setState('status');
    setSelectedTier(null);
    setInvoiceData(null);
    setErrorMessage('');
  };

  // Not logged in
  if (!user?.pubkey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Power-Ups & Access
          </CardTitle>
          <CardDescription>
            Sign in with Nostr to unlock Power-Ups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bh-panel p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Sign in to access:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>✓ Power-Ups for more buckets</li>
              <li>✓ Subscription status tracking</li>
              <li>✓ Encrypted budget sync across devices</li>
            </ul>
          </div>
          <LoginArea className="flex w-full justify-center" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading Power-Ups info...</p>
        </CardContent>
      </Card>
    );
  }

  const tierColors = {
    trial: 'bg-blue-50 dark:bg-blue-950',
    paid: 'bg-green-50 dark:bg-green-950',
    free: 'bg-gray-50 dark:bg-gray-950',
  };

  const tierBadgeColors = {
    trial: 'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100',
    paid: 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100',
    free: 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  };

  const isUnlimited = subscription.buckets >= 999999;

  // ─── SELECTING STATE (test payment flow) ───
  if (state === 'selecting') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Select a Power-Up to test</p>
          <Button variant="ghost" size="sm" onClick={handleBackToStatus}>
            Back
          </Button>
        </div>

        <div className="grid gap-2">
          {UPGRADE_TIERS.map((tier) => (
            <button
              key={tier.id}
              onClick={() => handleSelectTier(tier)}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition-colors text-left ${
                selectedTier?.id === tier.id
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                  : 'border-border hover:border-amber-300 hover:bg-muted'
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
                    {satsPerUsd ? `~${Math.round(tier.price * satsPerUsd).toLocaleString()} sats` : 'Loading price...'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded border-l-4 border-l-amber-500 text-xs">
          <p className="text-amber-900 dark:text-amber-100">
            <strong>Test mode:</strong> This will generate a real Lightning invoice. Payment will be verified by the backend. This is for testing the payment flow.
          </p>
        </div>
      </div>
    );
  }

  // ─── SUCCESS STATE ───
  if (state === 'success') {
    return (
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
    );
  }

  // ─── INVOICE STATE ───
  if (state === 'invoice' && invoiceData && selectedTier) {
    return (
      <div className="space-y-4">
        <div className="bh-panel p-3 rounded-lg bg-green-50 dark:bg-green-950 border-l-4 border-l-green-500 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              ✓ {selectedTier.name}
            </p>
            <p className="text-xs text-green-800 dark:text-green-200 mt-1">
              {selectedTier.description}
            </p>
          </div>
          <p className="font-mono text-lg font-semibold text-green-900 dark:text-green-100">
            ${selectedTier.price}
          </p>
        </div>

        <InvoiceDisplay
          invoice={invoiceData.pr}
          amount={Math.round(selectedTier.price * satsPerUsd) * 1000}
        />

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-pulse" />
          Waiting for payment... Keep this window open.
        </div>

        <Button variant="outline" onClick={handleBackToStatus} className="w-full">
          Cancel Payment
        </Button>
      </div>
    );
  }

  // ─── STATUS STATE (default) ───
  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Your Power-Ups
          </CardTitle>
          <CardDescription>
            Manage your Sat Sorter Power-Ups and budget bucket access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`p-4 rounded-lg ${tierColors[subscription.tier]}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Current Plan</p>
                <Badge className={tierBadgeColors[subscription.tier]}>
                  {subscription.tier === 'trial'
                    ? 'Free Trial'
                    : subscription.tier === 'paid'
                      ? subscription.payment_type === 'yearly' ? 'Yearly' : 'Paid'
                      : 'Free'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Budget Buckets</p>
                  <p className="font-semibold text-lg">
                    {isUnlimited ? '∞' : subscription.buckets}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Items per Bucket</p>
                  <p className="font-semibold text-lg">
                    {subscription.items_per_bucket >= 999999 ? '∞' : subscription.items_per_bucket}
                  </p>
                </div>
              </div>

              {subscription.expires_at && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Access expires</p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(subscription.expires_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              )}

              {subscription.tier === 'trial' && (
                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900 rounded border-l-4 border-l-blue-500">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                    You're on the free trial for this month! Enjoy unlimited buckets and items.
                    Next month you'll revert to the free tier (5 buckets) unless you upgrade.
                  </p>
                </div>
              )}

              {subscription.tier === 'free' && (
                <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900 rounded border-l-4 border-l-amber-500">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    You're on the free tier: 5 buckets, 4 items per bucket.
                    Choose a Power-Up below to add more.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Power-Up Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Power-Up Your Budget
          </CardTitle>
          <CardDescription>
            Choose a Power-Up to unlock more buckets this month. Pay once — no recurring charges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {UPGRADE_TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => handleSelectTier(tier)}
                disabled={isLoading}
                className={`p-3 rounded-lg border-2 transition-colors text-left ${
                  selectedTier?.id === tier.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                    : 'border-border hover:border-amber-300 hover:bg-muted'
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
                      {satsPerUsd ? `~${Math.round(tier.price * satsPerUsd).toLocaleString()} sats` : 'Loading price...'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 rounded border-l-4 border-l-amber-500 text-xs">
            <p className="text-amber-900 dark:text-amber-100">
              <strong>How it works:</strong> Pay once for this calendar month.
              Next month you can choose to pay again or use the free tier (5 buckets).
              No recurring charges, no surprises.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Code */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4" />
            Test Access Code
          </CardTitle>
          <CardDescription className="text-amber-800 dark:text-amber-200">
            Enter a code to unlock unlimited access (for testing/development)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Enter test code..."
              value={testCodeInput}
              onChange={(e) => setTestCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && testCodeInput.trim()) {
                  handleApplyTestCode();
                }
              }}
            />
            <Button
              onClick={handleApplyTestCode}
              disabled={isApplyingCode || !testCodeInput.trim()}
            >
              {isApplyingCode ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Payment Flow — hidden unless ?dev=true in URL */}
      {new URLSearchParams(window.location.search).get('dev') === 'true' && (
        <Card className="border-dashed border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4" />
              Test Payment Flow
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400 text-xs">
              Test the Power-Up payment flow with a real Lightning invoice. This bypasses your current subscription status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setState('selecting');
              }}
              className="text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <Zap className="h-3 w-3 mr-1" />
              Test Payment Flow
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
