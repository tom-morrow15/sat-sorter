import { useState } from 'react';
import { useState } from 'react';
import { Copy, Check, AlertCircle, Zap, LogIn, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSubscription, useApplyTestCode } from '@/hooks/useSubscription';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';
import { LoginArea } from '@/components/auth/LoginArea';

const WORKER_URL = 'https://sat-sorter-worker.satsorter.workers.dev';

export function SubscriptionSettings() {
  const { data: subscription } = useSubscription();
  const { user } = useCurrentUser();
  const applyTestCode = useApplyTestCode();
  const { showToast } = useToast();
  const [testCodeInput, setTestCodeInput] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText('satsorter@getalby.com');
      setCopied(true);
      showToast({ title: 'Copied!', description: 'Lightning address copied' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  const handleApplyTestCode = async () => {
    if (!testCodeInput.trim()) {
      showToast({
        title: 'Error',
        description: 'Please enter a test code',
        variant: 'destructive',
      });
      return;
    }

    setIsApplyingCode(true);
    try {
      const result = await applyTestCode(testCodeInput);
      showToast({
        title: 'Success!',
        description: result.message || 'Test code applied',
      });
      setTestCodeInput('');
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply test code',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingCode(false);
    }
  };

  const handleResetToFree = async () => {
    if (!user?.pubkey) return;
    setIsResetting(true);
    try {
      const response = await fetch(`${WORKER_URL}/api/subscription/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: user.pubkey }),
      });
      if (!response.ok) throw new Error('Failed to reset');
      showToast({ title: 'Reset to Free Tier', description: 'You now have 5 buckets and 4 items per bucket.' });
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // If not logged in, show login prompt
  if (!user?.pubkey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Your Subscription
          </CardTitle>
          <CardDescription>
            Sign in with Nostr to manage your subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bh-panel p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Sign in to access:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>✓ Paid upgrade tiers for more buckets</li>
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
          <p className="text-muted-foreground">Loading subscription info...</p>
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

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Your Subscription
          </CardTitle>
          <CardDescription>
            Manage your Sat Sorter subscription and budget bucket access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    Upgrade from the budget page to add more.
                  </p>
                </div>
              )}

              {/* Reset to Free (for testing) */}
              {subscription.tier !== 'free' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToFree}
                  disabled={isResetting}
                  className="mt-3 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {isResetting ? 'Resetting...' : 'Reset to Free Tier'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lightning Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lightning Address</CardTitle>
          <CardDescription>
            Send payments to this Lightning address to upgrade your plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value="satsorter@getalby.com"
              readOnly
              className="font-mono"
            />
            <Button
              onClick={handleCopyAddress}
              size="icon"
              variant="outline"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Code (always visible for logged-in users — useful for testing) */}
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
    </div>
  );
}
