import { useState } from 'react';
import { Copy, Check, AlertCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';

const WORKER_URL = 'https://sat-sorter-worker.satsorter.workers.dev';

export function SubscriptionSettings() {
  const { data: subscription } = useSubscription();
  const { user } = useCurrentUser();
  const { showToast } = useToast();
  const [testCodeInput, setTestCodeInput] = useState('');
  const [isApplyingCode, setIsApplyingCode] = useState(false);
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
      const response = await fetch(`${WORKER_URL}/api/subscription/apply-test-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubkey: user?.pubkey,
          testCode: testCodeInput,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid test code');
      }

      showToast({
        title: 'Success!',
        description: 'Test code applied. Refreshing...',
      });

      setTestCodeInput('');
      // Refetch subscription
      window.location.reload();
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
                      ? 'Paid'
                      : 'Free'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Budget Buckets</p>
                  <p className="font-semibold text-lg">
                    {subscription.buckets === 999 ? '∞' : subscription.buckets}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Items per Bucket</p>
                  <p className="font-semibold text-lg">
                    {subscription.items_per_bucket === 999 ? '∞' : subscription.items_per_bucket}
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
                    🎉 You're on the free trial for this month! Enjoy unlimited buckets and items.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Address */}
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

      {/* Test Code (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertCircle className="h-4 w-4" />
              Test Code
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              For development/testing only
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter test code..."
                value={testCodeInput}
                onChange={(e) => setTestCodeInput(e.target.value)}
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
      )}
    </div>
  );
}
