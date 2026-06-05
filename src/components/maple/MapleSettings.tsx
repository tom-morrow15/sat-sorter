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
import { useMapleSettings } from '@/hooks/useMapleSettings';
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
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs space-y-2">
            <p className="font-semibold text-sm">Setup Required</p>
            <p>
              Budget Buddy connects to Maple's privacy-first AI through the
              Maple Proxy. To use it:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>
                Download the Maple app from{' '}
                <a
                  href="https://trymaple.ai/downloads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 font-semibold underline inline-flex items-center gap-0.5"
                >
                  trymaple.ai
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Open it and start the Local Proxy (under API settings)</li>
              <li>Paste your Maple API key below and tap Test</li>
            </ol>
            <p className="text-muted-foreground pt-1">
              <strong>On your phone?</strong> Keep the Maple app running on your
              Mac, connect both devices to the same WiFi, and set the Proxy URL
              below to your Mac's IP (e.g. <code className="bg-amber-100 px-1 rounded">http://192.168.1.50:8080/v1</code>).
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

        {/* Proxy URL */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <Label htmlFor="maple-proxy-url">Proxy URL</Label>
          </div>
          <Input
            id="maple-proxy-url"
            type="text"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder="http://localhost:8080/v1"
          />
          <p className="text-xs text-muted-foreground">
            Where the Maple Proxy is running. Use{' '}
            <code className="bg-muted px-1 py-0.5 rounded">http://localhost:8080/v1</code>{' '}
            on the same machine, or your Mac's IP for phone access.
          </p>
        </div>

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
