import { useState } from 'react';
import {
  KeyRound,
  TestTube,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  Server,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
    disclaimerAccepted,
    setDisclaimerAccepted,
    connections,
    addConnection,
    removeConnection,
    updateConnection,
    isCustom,
    activeName,
    connectionReady,
  } = useAISettings();
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [draft, setDraft] = useState({ name: '', baseUrl: '', apiKey: '', model: '' });

  const modelOptions = availableModels.length > 0
    ? availableModels
    : provider === 'maple'
      ? MAPLE_MODELS_FALLBACK
      : model
        ? [{ id: model, label: model, description: '' }]
        : [];

  const handleTest = async () => {
    if (!isCustom && !apiKey.trim()) {
      toast({ title: 'Please enter an API key', variant: 'destructive' });
      return;
    }
    if (!proxyUrl.trim()) {
      toast({ title: 'Add the server address first', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    try {
      const result = await testKey(apiKey, proxyUrl, model || undefined);
      if (result.ok) {
        toast({ title: 'Connection successful!', description: `Connected to ${activeName}.` });
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

  const handleAdd = () => {
    if (!draft.baseUrl.trim()) {
      toast({ title: 'Add the server address', variant: 'destructive' });
      return;
    }
    addConnection(draft);
    setDraft({ name: '', baseUrl: '', apiKey: '', model: '' });
    toast({ title: 'AI added', description: 'You can pick it in the Budget Buddy chat.' });
  };

  return (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">AI Provider</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['maple', 'ppq'] as const).map((p) => (
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
          {connections.map((connection) => (
            <button
              key={connection.id}
              onClick={() => handleProviderChange(connection.id)}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all press-feedback',
                provider === connection.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <p className="font-semibold text-sm">{connection.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{connection.baseUrl}</p>
            </button>
          ))}
        </div>
      </div>

      {isCustom ? (
        <div className="space-y-2">
          <Label htmlFor="custom-name">Name</Label>
          <Input
            id="custom-name"
            value={activeName}
            onChange={(event) => updateConnection(provider, { name: event.target.value })}
          />
          <Label htmlFor="custom-url">Server address</Label>
          <Input
            id="custom-url"
            value={proxyUrl}
            onChange={(event) => setProxyUrl(event.target.value)}
            placeholder="http://192.168.1.20:1234/v1"
            className="font-mono text-xs"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="text-xs text-muted-foreground">
            For LM Studio, use the address from its server tab and end it with /v1. A phone cannot use localhost. The address has to be https when you open Sat Sorter from the phone, because the app itself is https. Turn on CORS in LM Studio.
          </p>
        </div>
      ) : null}

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="api-key" className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          {isCustom ? 'API key, if the server asks for one' : `${provider === 'ppq' ? 'PPQ' : 'Maple'} API key`}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'maple' ? 'Enter Maple API key...' : provider === 'ppq' ? 'ppq_...' : 'Optional'}
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
            disabled={isTesting || !proxyUrl.trim() || (!isCustom && !apiKey.trim())}
          >
            {isTesting ? 'Testing...' : 'Test'}
          </Button>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        {modelOptions.length > 0 && (
        <Select value={model || modelOptions[0].id} onValueChange={setModel}>
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
        )}
        {isCustom && (
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Model name, if it is not in the list"
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
        {isCustom && (
          <Button variant="outline" className="w-full" onClick={() => removeConnection(provider)}>
            Remove this AI
          </Button>
        )}
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
      {!isCustom && (
      <details className="group">
        <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          <Server className="h-3.5 w-3.5" />
          Advanced: Custom proxy URL
        </summary>
        <div className="mt-2">
          <Input
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder={provider === 'ppq' ? PROVIDER_DEFAULTS.ppq.proxyUrl : PROVIDER_DEFAULTS.maple.proxyUrl}
            className="text-xs font-mono"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Only change this if you're running a local proxy (e.g., PPQ private mode or Maple desktop app).
          </p>
        </div>
      </details>
      )}

      <div className="space-y-2 rounded-xl border p-3">
        <Label className="text-sm font-semibold">Add another AI</Label>
        <Input
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Name, for example LM Studio"
        />
        <Input
          value={draft.baseUrl}
          onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
          placeholder="Server address, ending in /v1"
          className="font-mono text-xs"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Input
          value={draft.apiKey}
          onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
          placeholder="API key, if needed"
          type="password"
          autoCapitalize="none"
        />
        <Input
          value={draft.model}
          onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
          placeholder="Model name, optional"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <Button variant="outline" className="w-full" onClick={handleAdd}>Add AI</Button>
        <p className="text-xs text-muted-foreground">
          Any server that speaks the OpenAI chat format works. Maple and PPQ stay available, and you pick which one to talk to inside the chat.
        </p>
      </div>

      {/* Disclaimer — must be accepted to use Budget Buddy */}
      <div className={cn(
        'p-4 rounded-xl border space-y-3',
        disclaimerAccepted
          ? 'border-border bg-muted/30'
          : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
      )}>
        <div className="flex items-start gap-2">
          <AlertCircle className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            disclaimerAccepted ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'
          )} />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">
              Budget Buddy Disclaimer
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Budget Buddy is an AI assistant, not a certified financial advisor. It may produce
              inaccurate information (hallucinations) or suggest actions that are not appropriate
              for your financial situation. Always use your own judgment before making financial
              decisions. Sat Sorter is not responsible for advice given by the AI, and any
              financial decisions you make are your sole responsibility.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <Checkbox
            checked={disclaimerAccepted}
            onCheckedChange={(v) => setDisclaimerAccepted(Boolean(v))}
            className="mt-0.5"
          />
          <span className="text-xs font-medium">
            I understand Budget Buddy is not a financial advisor and I use it at my own risk.
          </span>
        </label>
      </div>

      {/* Status */}
      {connectionReady && disclaimerAccepted ? (
        <Alert className="border-green-500/30 bg-green-50 dark:bg-green-950/30">
          <AlertDescription className="text-xs text-green-700 dark:text-green-400">
            ✓ Budget Buddy is ready. Tap the chat icon to start asking questions about your budget.
          </AlertDescription>
        </Alert>
      ) : connectionReady && !disclaimerAccepted ? (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
            Accept the disclaimer above to activate Budget Buddy.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {isCustom
              ? 'Add the server address above to activate Budget Buddy.'
              : `Enter your ${provider === 'ppq' ? 'PPQ' : 'Maple'} API key above to activate Budget Buddy.`}
            {provider === 'ppq' && ' Get a key at ppq.ai — no signup required, pay per query with crypto.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
