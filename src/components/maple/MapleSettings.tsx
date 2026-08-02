import { useState } from 'react';
import {
  KeyRound,
  TestTube,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAISettings, PROVIDER_DEFAULTS, type AIProvider } from '@/hooks/useAISettings';
import { useToast } from '@/hooks/useToast';
import { testKey, MAPLE_MODELS_FALLBACK } from '@/services/mapleAi';
import { cn } from '@/lib/utils';

export function MapleSettings() {
  const {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    evergreenContext,
    setEvergreenContext,
    proxyUrl,
    setProxyUrl,
    model,
    setModel,
    availableModels,
    modelsLoading,
    zdr,
    setZdr,
    maple,
    ppq,
  } = useAISettings();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const hasKey = apiKey.length > 0;
  const modelOptions = availableModels.length > 0 ? availableModels : MAPLE_MODELS_FALLBACK;

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast({ title: 'Please enter an API key', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    try {
      const result = await testKey(apiKey, proxyUrl, model);
      if (result.ok) {
        toast({ title: 'Connection successful!', description: `Connected to ${PROVIDER_DEFAULTS[provider].label}.` });
      } else {
        toast({ title: 'Connection failed', description: result.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Connection failed', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider as AIProvider);
  };

  return (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">AI Provider</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['maple', 'ppq'] as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all press-feedback',
                provider === p
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <p className="font-semibold text-sm">{PROVIDER_DEFAULTS[p].label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PROVIDER_DEFAULTS[p].description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="api-key" className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          {PROVIDER_DEFAULTS[provider].label} API Key
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'maple' ? 'Enter Maple API key...' : 'ppq_...'}
              className="pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
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
            {isTesting ? 'Testing...' : 'Test'}
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue placeholder="Select a model..." />
          </SelectTrigger>
          <SelectContent>
            {modelsLoading && <SelectItem value="loading" disabled>Loading models...</SelectItem>}
            {modelOptions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{m.label}</span>
                  {m.description && (
                    <span className="text-xs text-muted-foreground">{m.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* PPQ ZDR Toggle */}
      {provider === 'ppq' && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Switch
            checked={zdr}
            onCheckedChange={setZdr}
            id="zdr-toggle"
          />
          <div className="flex-1">
            <Label htmlFor="zdr-toggle" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Zero Data Retention (ZDR)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Routes requests only to endpoints that don't store your prompt data. Recommended for sensitive financial information.
            </p>
          </div>
        </div>
      )}

      {/* Evergreen Context (persistent instructions) */}
      <div className="space-y-2">
        <Label htmlFor="context" className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Persistent Context
        </Label>
        <Textarea
          id="context"
          value={evergreenContext}
          onChange={(e) => setEvergreenContext(e.target.value)}
          placeholder="Tell your Budget Buddy about your financial goals, situation, or preferences. Example: 'We're saving for a house down payment. We want to keep monthly savings above $1,000. We tithe 10% of our income.'"
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          This context is included with every conversation. Use it to give your Budget Buddy persistent instructions.
        </p>
      </div>

      {/* Advanced: Proxy URL */}
      <details className="group">
        <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          <Server className="h-3.5 w-3.5" />
          Advanced: Custom proxy URL
        </summary>
        <div className="mt-2">
          <Input
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[provider].proxyUrl}
            className="text-xs font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Only change this if you're running a local proxy (e.g., PPQ private mode or Maple desktop app).
          </p>
        </div>
      </details>

      {/* Status */}
      {hasKey ? (
        <Alert className="border-green-500/30 bg-green-50 dark:bg-green-950/30">
          <AlertDescription className="text-xs text-green-700 dark:text-green-400">
            ✓ Budget Buddy is ready. Tap the chat icon to start asking questions about your budget.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Enter your {PROVIDER_DEFAULTS[provider].label} API key above to activate Budget Buddy.
            {provider === 'ppq' && ' Get a key at ppq.ai — no signup required, pay per query with crypto.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
