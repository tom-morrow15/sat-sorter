import { useEffect, useMemo, useState } from 'react';
import { SHARED_BUDGET_RELAYS } from '@/hooks/useSharedBudgetSync';
import {
  AlertTriangle,
  Check,
  Globe,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { useToast } from '@/hooks/useToast';
import type { Relay } from '@/contexts/AppContext';

interface RelaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Curated, well-run public relays offered to every user. */
const RECOMMENDED_RELAYS: { url: string; name: string; blurb: string }[] = [
  { url: 'wss://relay.primal.net', name: 'Primal', blurb: 'Fast, professionally operated' },
  { url: 'wss://relay.damus.io', name: 'Damus', blurb: 'Long-running community relay' },
  { url: 'wss://nos.lol', name: 'nos.lol', blurb: 'Popular free community relay' },
  { url: 'wss://relay.ditto.pub', name: 'Ditto', blurb: 'Reliable open-source relay' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.band', blurb: 'Search and indexing relay' },
];

const normalizeRelayUrl = (url: string): string => {
  const trimmed = url.trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`wss://${trimmed}`).toString();
    } catch {
      return trimmed;
    }
  }
};

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

/** Compare two relay URLs ignoring cosmetic differences (trailing slash,
 *  ws vs wss scheme) that break exact-string matching between stored NIP-65
 *  URLs and our recommended-relay list. */
function sameRelay(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const parsed = new URL(u);
      return `${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
      return u.replace(/\/+$/, '');
    }
  };
  return norm(a) === norm(b);
}

function StatusDot({ state }: { state: 'unknown' | 'testing' | 'connected' | 'failed' }) {
  if (state === 'connected') {
    return <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Connected" />;
  }
  if (state === 'failed') {
    return <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" title="Connection failed" />;
  }
  if (state === 'testing') {
    return <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0" title="Testing…" />;
  }
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" title="Not tested yet" />;
}

export function RelaySettingsDialog({ open, onOpenChange }: RelaySettingsDialogProps) {
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const { results, testAll, testing } = useRelayHealth();

  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const relays = config.relayMetadata.relays;

  // Health-check all relays whenever the dialog opens
  useEffect(() => {
    if (open && relays.length > 0) {
      testAll(relays.map(r => r.url));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isAdded = (url: string) => relays.some(r => sameRelay(r.url, url));

  /** Health result for a stored relay matching the given (recommended) URL. */
  const healthFor = (url: string) => {
    const match = relays.find(r => sameRelay(r.url, url));
    return match ? results[match.url] : undefined;
  };

  const saveRelays = (newRelays: Relay[]) => {
    updateConfig((current) => ({
      ...current,
      relayMetadata: {
        relays: newRelays,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    }));

    // Publish NIP-65 relay list (PUBLIC relays only — private relays never
    // leave this device). Other apps use this list to know where to reach us.
    if (user) {
      const publicRelays = newRelays.filter(r => !r.private);
      const tags = publicRelays.map(relay => {
        if (relay.read && relay.write) return ['r', relay.url];
        if (relay.read) return ['r', relay.url, 'read'];
        return ['r', relay.url, 'write'];
      });
      publishEvent({ kind: 10002, tags, content: '' });
    }
  };

  const addRelay = (url: string, options: { private: boolean }) => {
    const normalized = normalizeRelayUrl(url);
    if (!normalized.startsWith('ws')) {
      toast({
        title: 'Invalid relay address',
        description: 'Relay addresses look like wss://relay.example.com',
        variant: 'destructive',
      });
      return;
    }
    if (relays.some(r => sameRelay(r.url, normalized))) {
      toast({ title: 'Already added', description: 'This relay is already in your list.', variant: 'destructive' });
      return;
    }
    saveRelays([...relays, { url: normalized, read: true, write: true, private: options.private }]);
  };

  const removeRelay = (url: string) => {
    saveRelays(relays.filter(r => r.url !== url));
  };

  const toggleFlag = (url: string, flag: 'read' | 'write' | 'private') => {
    saveRelays(relays.map(r => (r.url === url ? { ...r, [flag]: !r[flag] } : r)));
  };

  const recommended = useMemo(
    () => RECOMMENDED_RELAYS.map(rec => ({ ...rec, added: isAdded(rec.url) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relays]
  );

  const customRelays = relays.filter(
    r => !RECOMMENDED_RELAYS.some(rec => sameRelay(rec.url, r.url))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Backup &amp; Sync
          </DialogTitle>
          <DialogDescription>
            Sat Sorter keeps your budget safe by saving encrypted copies to Nostr relays.
            Everything is encrypted on your device before it leaves — relays only ever
            store scrambled data they cannot read.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testAll(relays.map(r => r.url))}
            disabled={testing || relays.length === 0}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing…' : 'Test connections'}
          </Button>
        </div>

        {/* ── Recommended relays ─────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Recommended relays</h3>
          <p className="text-xs text-muted-foreground">
            Reliable, well-run public relays. One tap to add — most people are done here.
          </p>
          <div className="space-y-1.5">
            {recommended.map((rec) => {
              const health = healthFor(rec.url);
              return (
                <div
                  key={rec.url}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 border border-border/40"
                >
                  <StatusDot state={rec.added ? health?.state ?? 'unknown' : 'unknown'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {rec.name}
                      {rec.added && <Check className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{rec.blurb}</div>
                    {rec.added && health?.state === 'failed' && (
                      <div className="text-xs text-red-500 mt-0.5 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {health.reason}
                      </div>
                    )}
                  </div>
                  {rec.added ? (
                    <Button variant="ghost" size="sm" onClick={() => removeRelay(rec.url)}>
                      Remove
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => addRelay(rec.url, { private: false })}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Advanced ───────────────────────────────────────────────────── */}
        <div className="border-t border-border/40 pt-3">
          <button
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? '▾' : '▸'} Advanced — all other relays
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4">
              <p className="text-xs text-muted-foreground">
                Any relay beyond the recommended list — including relays you self-host.
                Self-hosting gives you full sovereignty: your encrypted backups live on
                hardware you control. Relays you add yourself are kept <strong>private</strong>
                {' '}by default, meaning they're used for your backups but never published in
                your public Nostr profile. Public relays appear in your public Nostr relay
                list so other apps can find you.
              </p>

              {/* Custom relay list */}
              <div className="space-y-1.5">
                {customRelays.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No custom relays yet.</p>
                )}
                {customRelays.map((relay) => {
                  const health = results[relay.url];
                  return (
                    <div
                      key={relay.url}
                      className="p-2.5 rounded-md bg-muted/20 border border-border/40 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <StatusDot state={health?.state ?? 'unknown'} />
                        <span className="font-mono text-xs flex-1 min-w-0 truncate">{hostOf(relay.url)}</span>
                        {relay.private ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" /> private
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" /> public
                          </span>
                        )}
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeRelay(relay.url)}
                          aria-label="Remove relay"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {health?.state === 'failed' && (
                        <div className="text-xs text-red-500 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          {health.reason}
                        </div>
                      )}
                      {health?.state === 'connected' && health.latencyMs != null && (
                        <div className="text-xs text-green-600">Connected ({health.latencyMs}ms)</div>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            id={`read-${relay.url}`}
                            checked={relay.read}
                            onCheckedChange={() => toggleFlag(relay.url, 'read')}
                          />
                          <Label htmlFor={`read-${relay.url}`} className="text-xs">Read</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            id={`write-${relay.url}`}
                            checked={relay.write}
                            onCheckedChange={() => toggleFlag(relay.url, 'write')}
                          />
                          <Label htmlFor={`write-${relay.url}`} className="text-xs">Write</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            id={`priv-${relay.url}`}
                            checked={!!relay.private}
                            onCheckedChange={() => toggleFlag(relay.url, 'private')}
                          />
                          <Label htmlFor={`priv-${relay.url}`} className="text-xs">Private</Label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add custom relay */}
              <div className="space-y-1.5">
                <Label htmlFor="new-relay" className="text-xs">Add your own relay</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-relay"
                    placeholder="wss://my-relay.example.com"
                    value={newRelayUrl}
                    onChange={(e) => setNewRelayUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newRelayUrl.trim()) {
                        addRelay(newRelayUrl, { private: true });
                        setNewRelayUrl('');
                      }
                    }}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newRelayUrl.trim()) {
                        addRelay(newRelayUrl, { private: true });
                        setNewRelayUrl('');
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added relays are private by default (used for your backups, never shared).
                  Toggle "Private" off to also publish them in your public Nostr profile.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Shared budget relays (read-only info) ──────────────────────── */}
        <div className="space-y-2 pt-3 border-t border-border/40">
          <h3 className="text-sm font-medium flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-petrol" />
            Shared budget relays
          </h3>
          <p className="text-xs text-muted-foreground">
            Used to sync budgets with your budget partners. These are managed by
            Sat Sorter so partners can always reach each other.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SHARED_BUDGET_RELAYS.map((url) => (
              <span
                key={url}
                className="font-mono text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted/20 border border-border/40"
              >
                {hostOf(url)}
              </span>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
