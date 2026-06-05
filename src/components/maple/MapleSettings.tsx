import { useState } from 'react';
import {
  KeyRound,
  TestTube,
  ToggleLeft,
  FileText,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMapleSettings, DEFAULT_PROXY_URL } from '@/hooks/useMapleSettings';
import { useToast } from '@/hooks/useToast';
import { testKey } from '@/services/mapleAi';

export function MapleSettings() {
  const {
    apiKey,
    setApiKey,
    enabled,
    setEnabled,
    evergreenContext,
    setEvergreenContext,
    proxyUrl,
    setProxyUrl,
  } = useMapleSettings();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const hasKey = apiKey.length > 0;

   const handleTest = async () => {
     if (!apiKey.trim()) {
       toast({ title: 'Please enter an API key', variant: 'destructive' });
       return;
     }
     setIsTesting(true);
     try {
       const result = await testKey(apiKey.trim(), proxyUrl);
       if (result.ok) {
         toast({ title: '✅ Connected to Maple successfully!' });
       } else {
         toast({
           title: 'Connection failed',
           description: result.error || 'Check your key and proxy URL, then try again.',
           variant: 'destructive',
         });
       }
     } catch (error) {
       toast({
         title: "Can't reach Maple",
         description: error instanceof Error ? error.message : 'Check your connection and try again.',
         variant: 'destructive',
       });
     } finally {
       setIsTesting(false);
     }
   };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Maple AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <Alert className="border-primary/30 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs space-y-2">
            <p className="font-semibold text-sm">How to connect</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>
                Get a Maple account &amp; API key at{' '}
                <a
                  href="https://trymaple.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold underline inline-flex items-center gap-0.5"
                >
                  trymaple.ai
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                (requires a paid plan)
              </li>
              <li>Paste your API key below and tap Test</li>
              <li>Enable Budget Buddy and start chatting</li>
            </ol>
            <p className="text-muted-foreground pt-1">
              Works on any device — your private budget data is encrypted and
              processed inside Maple's secure enclave. Your API key stays on
              your device.
            </p>
          </AlertDescription>
        </Alert>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="maple-api-key">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="maple-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !apiKey.trim()}
            >
              <TestTube className="h-4 w-4 mr-1" />
              {isTesting ? 'Testing...' : 'Test'}
            </Button>
          </div>
           <p className="text-xs text-muted-foreground">
             Your API key is stored locally and never shared.
           </p>
        </div>

        {/* Advanced: Proxy URL */}
        <details className="group">
          <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
            <Server className="h-3.5 w-3.5" />
            Advanced: Proxy URL
          </summary>
          <div className="space-y-2 mt-3 pl-1">
            <Input
              id="maple-proxy-url"
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder={DEFAULT_PROXY_URL}
            />
            <p className="text-xs text-muted-foreground">
              Sat Sorter routes requests through a hosted Maple Proxy by
              default, so you don't need to run anything yourself. Only change
              this if you're running your own proxy.
            </p>
          </div>
        </details>

        {/* Enable toggle - only shown when key exists */}
        {hasKey && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ToggleLeft className="h-4 w-4" />
                <Label htmlFor="maple-enabled" className="text-sm font-medium cursor-pointer">
                  Enable Budget Buddy
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Shows the Buddy tab and Maple Insights card.
              </p>
            </div>
            <Switch
              id="maple-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        )}

        {/* Evergreen context - only shown when key exists */}
        {hasKey && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <Label htmlFor="maple-evergreen">Evergreen Context</Label>
            </div>
            <Textarea
              id="maple-evergreen"
              value={evergreenContext}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 800) {
                  setEvergreenContext(val);
                }
              }}
              placeholder="e.g., Saving $400/mo for Japan trip. Never overspend on Housing."
              rows={3}
              maxLength={800}
            />
            <p className="text-xs text-muted-foreground text-right">
              {evergreenContext.length}/800
            </p>
            <p className="text-xs text-muted-foreground">
              This context is included in every message to Maple. Use it for
              persistent goals or rules.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
