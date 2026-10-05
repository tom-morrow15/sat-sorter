import { useState } from 'react';
import { AlertCircle, ChevronLeft, Eye, EyeOff, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAISettings, PROVIDER_DEFAULTS, type AiConnection } from '@/hooks/useAISettings';
import { useToast } from '@/hooks/useToast';
import { testKey, MAPLE_MODELS_FALLBACK } from '@/services/mapleAi';
import { cn } from '@/lib/utils';

type Host = 'cloud' | 'local';
type View =
  | { name: 'list' }
  | { name: 'host' }
  | { name: 'cloud' }
  | { name: 'create'; host: Host; preset: 'maple' | 'ppq' | 'other' }
  | { name: 'edit'; id: string };

function hostOf(connection: AiConnection): Host {
  if (connection.host === 'local' || connection.host === 'cloud') return connection.host;
  const url = connection.baseUrl.toLowerCase();
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('http://')) return 'local';
  return 'cloud';
}

export function MapleSettings() {
  const settings = useAISettings();
  const { toast } = useToast();
  const [view, setView] = useState<View>({ name: 'list' });
  const [returnProvider, setReturnProvider] = useState(settings.provider);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [draft, setDraft] = useState({ name: '', baseUrl: '', apiKey: '', model: '' });

  const {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    proxyUrl,
    setProxyUrl,
    model,
    setModel,
    availableModels,
    modelsLoading,
    zdr,
    setZdr,
    evergreenContext,
    setEvergreenContext,
    disclaimerAccepted,
    setDisclaimerAccepted,
    connections,
    addConnection,
    removeConnection,
    updateConnection,
    maple,
    ppq,
    connectionReady,
    activeName,
  } = settings;

  const rows = [
    ...(maple.apiKey || provider === 'maple'
      ? [{ id: 'maple', name: 'Maple', host: 'cloud' as Host, ready: maple.apiKey.length > 0, detail: 'Cloud' }]
      : []),
    ...(ppq.apiKey || provider === 'ppq'
      ? [{ id: 'ppq', name: 'PPQ', host: 'cloud' as Host, ready: ppq.apiKey.length > 0, detail: 'Cloud' }]
      : []),
    ...connections.map((connection) => ({
      id: connection.id,
      name: connection.name,
      host: hostOf(connection),
      ready: connection.baseUrl.trim().length > 0,
      detail: hostOf(connection) === 'local' ? 'On your network' : 'Cloud',
    })),
  ];

  const openEdit = (id: string) => {
    setProvider(id);
    setShowKey(false);
    setView({ name: 'edit', id });
  };

  const runTest = async (key: string, url: string, modelId: string, needsKey: boolean) => {
    if (needsKey && !key.trim()) {
      toast({ title: 'Add an API key first', variant: 'destructive' });
      return;
    }
    if (!url.trim()) {
      toast({ title: 'Add the server address first', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    try {
      const result = await testKey(key, url, modelId || undefined);
      toast(result.ok
        ? { title: 'Connection successful' }
        : { title: 'Connection failed', description: result.error, variant: 'destructive' });
    } catch {
      toast({ title: 'Connection failed', description: 'Could not reach the server.', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const saveDraft = () => {
    if (view.name !== 'create' || view.preset === 'maple' || view.preset === 'ppq') return;
    if (!draft.baseUrl.trim()) {
      toast({ title: 'Add the server address', variant: 'destructive' });
      return;
    }
    if (view.host === 'cloud' && !draft.apiKey.trim()) {
      toast({ title: 'Add an API key', variant: 'destructive' });
      return;
    }
    const id = addConnection({ ...draft, host: view.host });
    setDraft({ name: '', baseUrl: '', apiKey: '', model: '' });
    setProvider(id);
    setView({ name: 'list' });
    toast({ title: 'Saved', description: 'This AI is ready to use in the chat.' });
  };

  const confirmSave = () => {
    if (view.name === 'create' && view.preset === 'other') {
      saveDraft();
      return;
    }
    if (view.name === 'create' && (view.preset === 'maple' || view.preset === 'ppq')) {
      if (!apiKey.trim()) {
        toast({ title: 'Add an API key first', variant: 'destructive' });
        return;
      }
      setReturnProvider(view.preset);
      toast({ title: 'Saved', description: 'This AI is ready to use in the chat.' });
      setView({ name: 'list' });
      return;
    }
    if (view.name === 'edit') {
      setProvider(view.id);
      toast({ title: 'Saved', description: 'This AI is ready to use in the chat.' });
      setView({ name: 'list' });
    }
  };

  const modelOptions = availableModels.length > 0
    ? availableModels
    : provider === 'maple'
      ? MAPLE_MODELS_FALLBACK
      : model
        ? [{ id: model, label: model, description: '' }]
        : [];

  const leaveForm = () => {
    if (view.name === 'create' && (view.preset === 'maple' || view.preset === 'ppq')) {
      setProvider(returnProvider);
    }
    setView({ name: 'list' });
  };

  const back = (
    <button type="button" onClick={leaveForm} className="flex items-center gap-1 text-sm text-muted-foreground">
      <ChevronLeft className="h-4 w-4" /> Back
    </button>
  );

  return (
    <div className="space-y-5">
      {view.name === 'list' && (
        <>
          <p className="text-sm text-muted-foreground">
            Add the AIs you want Budget Buddy to use. You can add more than one, then pick which one to talk to in the chat.
          </p>
          {rows.length === 0 ? (
            <p className="text-sm rounded-xl border border-dashed p-4 text-muted-foreground">No AI added yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openEdit(row.id)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left',
                    provider === row.id ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{row.name}</span>
                    {provider === row.id && <span className="text-[10px] text-primary">In use</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {row.detail}{row.ready ? '' : ' · Needs setup'}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Button className="w-full" onClick={() => setView({ name: 'host' })}>Add an AI</Button>
          {connectionReady && (
            <p className="text-xs text-muted-foreground">Talking to {activeName}. Change it here, or from the chat.</p>
          )}
        </>
      )}

      {view.name === 'host' && (
        <div className="space-y-3">
          {back}
          <p className="text-sm font-medium">Where does this AI run?</p>
          <button type="button" onClick={() => setView({ name: 'cloud' })} className="w-full rounded-xl border p-4 text-left hover:border-primary/40">
            <span className="block font-medium text-sm">Cloud hosted</span>
            <span className="mt-1 block text-xs text-muted-foreground">A service on the internet. You need an API key from that service.</span>
          </button>
          <button type="button" onClick={() => { setDraft({ name: '', baseUrl: '', apiKey: '', model: '' }); setView({ name: 'create', host: 'local', preset: 'other' }); }} className="w-full rounded-xl border p-4 text-left hover:border-primary/40">
            <span className="block font-medium text-sm">On your network</span>
            <span className="mt-1 block text-xs text-muted-foreground">An AI you run yourself, on a computer or a server you control.</span>
          </button>
        </div>
      )}

      {view.name === 'cloud' && (
        <div className="space-y-3">
          <button type="button" onClick={() => setView({ name: 'host' })} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <p className="text-sm font-medium">Choose a cloud service</p>
          <button type="button" onClick={() => { setReturnProvider(provider); setProvider('maple'); setView({ name: 'create', host: 'cloud', preset: 'maple' }); }} className="w-full rounded-xl border p-4 text-left">
            <span className="block font-medium text-sm">Maple</span>
            <span className="mt-1 block text-xs text-muted-foreground">Private models. Uses your Maple key.</span>
          </button>
          <button type="button" onClick={() => { setReturnProvider(provider); setProvider('ppq'); setView({ name: 'create', host: 'cloud', preset: 'ppq' }); }} className="w-full rounded-xl border p-4 text-left">
            <span className="block font-medium text-sm">PPQ</span>
            <span className="mt-1 block text-xs text-muted-foreground">Pay per question. No account required.</span>
          </button>
          <button type="button" onClick={() => { setDraft({ name: '', baseUrl: '', apiKey: '', model: '' }); setView({ name: 'create', host: 'cloud', preset: 'other' }); }} className="w-full rounded-xl border p-4 text-left">
            <span className="block font-medium text-sm">Another cloud service</span>
            <span className="mt-1 block text-xs text-muted-foreground">Any service that uses the standard chat address ending in /v1.</span>
          </button>
        </div>
      )}

      {(view.name === 'create' || view.name === 'edit') && (
        <div className="space-y-4">
          {back}
          <ConnectionForm
            title={view.name === 'edit'
              ? activeName
              : view.preset === 'maple'
                ? 'Maple'
                : view.preset === 'ppq'
                  ? 'PPQ'
                  : view.host === 'local'
                    ? 'AI on your network'
                    : 'Cloud AI'}
            host={view.name === 'edit'
              ? (view.id === 'maple' || view.id === 'ppq' ? 'cloud' : hostOf(connections.find((item) => item.id === view.id) || { id: view.id, name: '', baseUrl: proxyUrl, apiKey, model, host: 'cloud' }))
              : view.host}
            preset={view.name === 'create' ? view.preset : view.id === 'maple' ? 'maple' : view.id === 'ppq' ? 'ppq' : 'other'}
            name={view.name === 'create' && view.preset === 'other' ? draft.name : activeName}
            baseUrl={view.name === 'create' && view.preset === 'other' ? draft.baseUrl : proxyUrl}
            apiKeyValue={view.name === 'create' && view.preset === 'other' ? draft.apiKey : apiKey}
            modelValue={view.name === 'create' && view.preset === 'other' ? draft.model : model}
            showKey={showKey}
            onToggleKey={() => setShowKey((value) => !value)}
            onName={(value) => {
              if (view.name === 'create' && view.preset === 'other') setDraft((prev) => ({ ...prev, name: value }));
              else if (view.name === 'edit' && view.id !== 'maple' && view.id !== 'ppq') updateConnection(view.id, { name: value });
            }}
            onBaseUrl={(value) => {
              if (view.name === 'create' && view.preset === 'other') setDraft((prev) => ({ ...prev, baseUrl: value }));
              else setProxyUrl(value);
            }}
            onApiKey={(value) => {
              if (view.name === 'create' && view.preset === 'other') setDraft((prev) => ({ ...prev, apiKey: value }));
              else setApiKey(value);
            }}
            onModel={(value) => {
              if (view.name === 'create' && view.preset === 'other') setDraft((prev) => ({ ...prev, model: value }));
              else setModel(value);
            }}
            modelOptions={view.name === 'create' && view.preset === 'other' ? [] : modelOptions}
            modelsLoading={modelsLoading}
            zdr={zdr}
            onZdr={setZdr}
            isTesting={isTesting}
            onTest={() => {
              if (view.name === 'create' && view.preset === 'other') {
                void runTest(draft.apiKey, draft.baseUrl, draft.model, view.host === 'cloud');
              } else {
                void runTest(apiKey, proxyUrl, model, view.name === 'create' ? view.preset !== 'other' : view.id === 'maple' || view.id === 'ppq');
              }
            }}
            onSave={confirmSave}
            onRemove={view.name === 'edit' && view.id !== 'maple' && view.id !== 'ppq'
              ? () => {
                removeConnection(view.id);
                setView({ name: 'list' });
              }
              : undefined}
          />
        </div>
      )}

      {view.name === 'list' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="context" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Notes for every chat
            </Label>
            <Textarea
              id="context"
              value={evergreenContext}
              onChange={(event) => setEvergreenContext(event.target.value)}
              placeholder="Optional. Example: We are saving for a house. Keep monthly savings above $1,000."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">Included with every question, no matter which AI you pick.</p>
          </div>

          <div className={cn(
            'p-4 rounded-xl border space-y-3',
            disclaimerAccepted ? 'border-border bg-muted/30' : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30',
          )}>
            <div className="flex items-start gap-2">
              <AlertCircle className={cn('h-4 w-4 shrink-0 mt-0.5', disclaimerAccepted ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400')} />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Budget Buddy is not a financial advisor. It can be wrong. You are responsible for your own decisions.
              </p>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox checked={disclaimerAccepted} onCheckedChange={(value) => setDisclaimerAccepted(Boolean(value))} className="mt-0.5" />
              <span className="text-xs font-medium">I understand, and I want to use Budget Buddy.</span>
            </label>
          </div>

          {connectionReady && disclaimerAccepted ? (
            <Alert className="border-green-500/30 bg-green-50 dark:bg-green-950/30">
              <AlertDescription className="text-xs text-green-700 dark:text-green-400">
                Budget Buddy is ready.
              </AlertDescription>
            </Alert>
          ) : connectionReady && !disclaimerAccepted ? (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertDescription className="text-xs">Accept the note above to turn Budget Buddy on.</AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </div>
  );
}

function ConnectionForm({
  title,
  host,
  preset,
  name,
  baseUrl,
  apiKeyValue,
  modelValue,
  showKey,
  onToggleKey,
  onName,
  onBaseUrl,
  onApiKey,
  onModel,
  modelOptions,
  modelsLoading,
  zdr,
  onZdr,
  isTesting,
  onTest,
  onSave,
  onRemove,
}: {
  title: string;
  host: Host;
  preset: 'maple' | 'ppq' | 'other';
  name: string;
  baseUrl: string;
  apiKeyValue: string;
  modelValue: string;
  showKey: boolean;
  onToggleKey: () => void;
  onName: (value: string) => void;
  onBaseUrl: (value: string) => void;
  onApiKey: (value: string) => void;
  onModel: (value: string) => void;
  modelOptions: { id: string; label: string; description?: string }[];
  modelsLoading: boolean;
  zdr: boolean;
  onZdr: (value: boolean) => void;
  isTesting: boolean;
  onTest: () => void;
  onSave: () => void;
  onRemove?: () => void;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const showAddress = preset === 'other';
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{host === 'local' ? 'On your network' : 'Cloud hosted'}</p>
      {preset === 'other' && (
        <div className="space-y-2">
          <Label htmlFor="ai-name">Name</Label>
          <Input id="ai-name" value={name} onChange={(event) => onName(event.target.value)} placeholder={host === 'local' ? 'Home server' : 'Cloud AI'} />
        </div>
      )}
      {showAddress && (
        <div className="space-y-2">
          <Label htmlFor="ai-url">Server address</Label>
          <Input
            id="ai-url"
            value={baseUrl}
            onChange={(event) => onBaseUrl(event.target.value)}
            placeholder={host === 'local' ? 'https://your-server/v1' : 'https://api.example.com/v1'}
            className="font-mono text-xs"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <p className="text-xs text-muted-foreground">
            {host === 'local'
              ? 'Use the address from the program running the model. It usually ends in /v1. On a phone, localhost means the phone, not your computer. Use the computer’s network address, and it must start with https or the browser will block it.'
              : 'Use the base address from the service. It usually ends in /v1.'}
          </p>
        </div>
      )}
      {preset === 'maple' && (
        <p className="text-xs text-muted-foreground">Uses {PROVIDER_DEFAULTS.maple.label}. Paste the key from your Maple account.</p>
      )}
      {preset === 'ppq' && (
        <p className="text-xs text-muted-foreground">Uses {PROVIDER_DEFAULTS.ppq.label}. Get a key at ppq.ai. You can pay per question, with no account.</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="ai-key">{host === 'local' ? 'API key, if the server asks for one' : 'API key'}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="ai-key"
              type={showKey ? 'text' : 'password'}
              value={apiKeyValue}
              onChange={(event) => onApiKey(event.target.value)}
              placeholder={host === 'local' ? 'Optional' : 'Paste your key'}
              className="pr-10"
              autoCapitalize="none"
            />
            <button type="button" onClick={onToggleKey} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={onTest} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test'}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Model</Label>
        {modelOptions.length > 0 && (
          <Select value={modelValue || modelOptions[0].id} onValueChange={onModel}>
            <SelectTrigger>
              <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select a model'} />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {preset === 'other' && (
          <Input
            value={modelValue}
            onChange={(event) => onModel(event.target.value)}
            placeholder="Model name, if you know it"
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
      </div>
      {preset === 'ppq' && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Switch checked={zdr} onCheckedChange={onZdr} id="zdr-toggle" />
          <div>
            <Label htmlFor="zdr-toggle" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Don’t store prompts
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Sends your budget only to models that say they do not keep the question.</p>
          </div>
        </div>
      )}
      <Button className="w-full" onClick={onSave}>Save</Button>
      {onRemove && !confirmingRemove && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmingRemove(true)}
        >
          Remove this AI
        </Button>
      )}
      {confirmingRemove && (
        <div className="space-y-2 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm">Remove this AI? You can add it again later.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmingRemove(false)}>Cancel</Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={onRemove}>Remove</Button>
          </div>
        </div>
      )}
    </div>
  );
}
