import { useState, useEffect } from 'react';
import { AlertCircle, Zap, Loader2, Check } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  validateStrikeApiKey,
  saveStrikeConfig,
  getStrikeConfig,
  clearStrikeConfig,
} from '@/lib/strikeUtils';
import { useToast } from '@/hooks/useToast';

interface StrikeConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function StrikeConnectionDialog({
  open,
  onOpenChange,
  onConnected,
}: StrikeConnectionDialogProps) {
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();

  // Load existing config
  useEffect(() => {
    if (open) {
      const config = getStrikeConfig();
      if (config) {
        setApiKey(config.apiKey);
        setUsername(config.username || '');
        setIsConnected(true);
      }
    }
  }, [open]);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'API key required',
        description: 'Please enter your Strike API key.',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await validateStrikeApiKey(apiKey.trim());

      if (!isValid) {
        toast({
          title: 'Authentication failed',
          description: 'The API key is invalid or expired. Please check and try again.',
          variant: 'destructive',
        });
        setIsValidating(false);
        return;
      }

      // Save the config
      saveStrikeConfig({
        apiKey: apiKey.trim(),
        username: username.trim() || undefined,
        lastSyncDate: undefined,
      });

      setIsConnected(true);
      toast({
        title: 'Connected!',
        description: 'Your Strike account has been successfully connected.',
      });

      onConnected?.();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Connection failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = () => {
    clearStrikeConfig();
    setApiKey('');
    setUsername('');
    setIsConnected(false);
    toast({
      title: 'Disconnected',
      description: 'Your Strike account has been disconnected.',
    });
  };

  const handleClose = () => {
    if (!isConnected) {
      setApiKey('');
      setUsername('');
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Connect Strike Account
          </DialogTitle>
          <DialogDescription>
            Connect your Strike account to automatically import transactions into your budget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isConnected ? (
            <>
              {/* Connected State */}
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Strike Connected
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {username || 'Your Strike account is ready to sync'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your transactions can now be imported from Strike. Use the sync button in the
                  budget view to fetch new transactions.
                </p>
              </div>

              <Button
                variant="destructive"
                onClick={handleDisconnect}
                className="w-full"
              >
                Disconnect Strike
              </Button>
            </>
          ) : (
            <>
              {/* Connection Instructions */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You'll need a Strike API key to connect. Get one from your Strike account settings.
                </AlertDescription>
              </Alert>

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Enter your Strike API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isValidating}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Username Input (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="username">Strike Username (optional)</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Your Strike username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isValidating}
                />
              </div>

              {/* Help Text */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>How to get your API key:</strong>
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Log in to your Strike account</li>
                  <li>Go to Settings → API or Developer Settings</li>
                  <li>Create a new API token</li>
                  <li>Copy and paste it here</li>
                </ol>
              </div>

              {/* Connect Button */}
              <Button
                onClick={handleConnect}
                disabled={!apiKey.trim() || isValidating}
                className="w-full"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Connect Strike'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
