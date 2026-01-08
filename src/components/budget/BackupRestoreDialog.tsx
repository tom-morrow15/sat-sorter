import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  Smartphone,
  Laptop,
  Wifi,
  Plus,
  X,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppContext } from '@/hooks/useAppContext';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { BudgetState } from '@/lib/budgetTypes';

interface BackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Relay {
  url: string;
  read: boolean;
  write: boolean;
}

export function BackupRestoreDialog({ open, onOpenChange }: BackupRestoreDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { mutate: publishEvent } = useNostrPublish();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showRelaySettings, setShowRelaySettings] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  const {
    remoteBudget,
    remoteTimestamp,
    isLoadingRemote,
    uploadBudget,
    downloadBudget,
    syncStatus,
    canSync,
  } = useBudgetSync();

  // Access local budget state
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Relay management
  const relays = config.relayMetadata.relays;

  const normalizeRelayUrl = (url: string): string => {
    url = url.trim();
    try {
      return new URL(url).toString();
    } catch {
      try {
        return new URL(`wss://${url}`).toString();
      } catch {
        return url;
      }
    }
  };

  const isValidRelayUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  const saveRelays = (newRelays: Relay[]) => {
    const now = Math.floor(Date.now() / 1000);
    updateConfig((current) => ({
      ...current,
      relayMetadata: {
        relays: newRelays,
        updatedAt: now,
      },
    }));

    // Publish to Nostr if user is logged in (NIP-65)
    if (user) {
      const tags = newRelays.map(relay => {
        if (relay.read && relay.write) {
          return ['r', relay.url];
        } else if (relay.read) {
          return ['r', relay.url, 'read'];
        } else if (relay.write) {
          return ['r', relay.url, 'write'];
        }
        return null;
      }).filter((tag): tag is string[] => tag !== null);

      publishEvent({
        kind: 10002,
        content: '',
        tags,
      });
    }
  };

  const handleAddRelay = () => {
    if (!isValidRelayUrl(newRelayUrl)) {
      toast({
        title: 'Invalid relay URL',
        description: 'Please enter a valid relay URL (e.g., wss://relay.example.com)',
        variant: 'destructive',
      });
      return;
    }

    const normalized = normalizeRelayUrl(newRelayUrl);

    if (relays.some(r => r.url === normalized)) {
      toast({
        title: 'Relay already exists',
        description: 'This relay is already in your list.',
        variant: 'destructive',
      });
      return;
    }

    const newRelays = [...relays, { url: normalized, read: true, write: true }];
    saveRelays(newRelays);
    setNewRelayUrl('');

    toast({
      title: 'Relay added',
      description: 'Your budget will now sync to this relay.',
    });
  };

  const handleRemoveRelay = (url: string) => {
    if (relays.length <= 1) {
      toast({
        title: 'Cannot remove',
        description: 'You need at least one relay to sync your budget.',
        variant: 'destructive',
      });
      return;
    }
    const newRelays = relays.filter(r => r.url !== url);
    saveRelays(newRelays);

    toast({
      title: 'Relay removed',
      description: 'Your budget will no longer sync to this relay.',
    });
  };

  const handleToggleWrite = (url: string) => {
    const newRelays = relays.map(r =>
      r.url === url ? { ...r, write: !r.write } : r
    );
    saveRelays(newRelays);
  };

  const renderRelayUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return url;
    }
  };

  // Export to JSON file
  const handleExport = () => {
    const dataStr = JSON.stringify(localBudget, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `sat-sorter-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Backup exported',
      description: 'Your budget data has been downloaded as a JSON file.',
    });
  };

  // Import from JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BudgetState;

      if (!data.budgets || !Array.isArray(data.budgets)) {
        throw new Error('Invalid backup file format');
      }

      setLocalBudget(data);

      toast({
        title: 'Backup restored',
        description: `Imported ${data.budgets.length} month(s) of budget data.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not read backup file.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Sync to Nostr
  const handleUploadToNostr = async () => {
    const success = await uploadBudget(localBudget);
    if (success) {
      toast({
        title: 'Synced to Nostr relays',
        description: `Your budget is now stored on ${relays.filter(r => r.write).length} relay(s).`,
      });
    } else {
      toast({
        title: 'Sync failed',
        description: syncStatus.error || 'Could not upload budget data.',
        variant: 'destructive',
      });
    }
  };

  // Download from Nostr
  const handleDownloadFromNostr = async () => {
    const data = await downloadBudget();
    if (data) {
      setLocalBudget(data);
      toast({
        title: 'Downloaded from Nostr',
        description: 'Your budget has been restored from your relays.',
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Download failed',
        description: 'No backup found or could not decrypt data.',
        variant: 'destructive',
      });
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  const writeRelays = relays.filter(r => r.write);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Nostr Relay Sync
          </DialogTitle>
          <DialogDescription>
            Sync your budget across devices using Nostr relays
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 py-4 pr-2">
            {/* How it works */}
            <Alert className="border-primary/30 bg-primary/5">
              <Shield className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <strong>How it works:</strong> Your budget is encrypted with your Nostr keys and stored on relays you choose. 
                Only you can decrypt it. No central server, no third party.
              </AlertDescription>
            </Alert>

            {/* Nostr Relay Sync */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Sync Status
              </h3>
              
              {!user ? (
                <div className="p-4 border rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Log in with Nostr to sync your budget across devices
                  </p>
                </div>
              ) : !canSync ? (
                <div className="p-4 border rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                  <p className="text-sm text-muted-foreground">
                    Your signer doesn't support NIP-44 encryption. Try a different login method (Alby, nos2x, etc).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Status */}
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <Laptop className="h-4 w-4 text-muted-foreground" />
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Last Synced</p>
                        <p className="text-xs text-muted-foreground">
                          {isLoadingRemote ? (
                            'Checking relays...'
                          ) : remoteBudget ? (
                            formatTimestamp(remoteTimestamp!)
                          ) : (
                            'No backup found on relays'
                          )}
                        </p>
                      </div>
                    </div>
                    {remoteBudget && (
                      <Badge variant="secondary" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Found
                      </Badge>
                    )}
                  </div>

                  {/* Sync buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleUploadToNostr}
                      disabled={syncStatus.isSyncing}
                    >
                      {syncStatus.isSyncing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Push to Relays
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadFromNostr}
                      disabled={syncStatus.isSyncing || !remoteBudget}
                    >
                      {syncStatus.isSyncing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Pull from Relays
                    </Button>
                  </div>

                  {syncStatus.error && (
                    <p className="text-xs text-destructive">{syncStatus.error}</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Relay Management */}
            <div className="space-y-3">
              <Collapsible open={showRelaySettings} onOpenChange={setShowRelaySettings}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Your Relays ({relays.length})
                    </h3>
                    {showRelaySettings ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    Your encrypted budget syncs to these Nostr relays. Add or remove relays as needed.
                  </p>

                  {/* Relay List */}
                  <div className="space-y-2">
                    {relays.map((relay) => (
                      <div
                        key={relay.url}
                        className="flex items-center gap-3 p-3 rounded-md border bg-muted/20"
                      >
                        <Wifi className={`h-4 w-4 shrink-0 ${relay.write ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-sm truncate block" title={relay.url}>
                            {renderRelayUrl(relay.url)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {relay.write ? '✓ Writing budget here' : 'Read only'}
                          </span>
                        </div>

                        {/* Write Toggle */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48" align="end">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`write-${relay.url}`} className="text-sm cursor-pointer">
                                  Sync budget here
                                </Label>
                                <Switch
                                  id={`write-${relay.url}`}
                                  checked={relay.write}
                                  onCheckedChange={() => handleToggleWrite(relay.url)}
                                  className="data-[state=checked]:bg-green-500"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRelay(relay.url)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          disabled={relays.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Relay Form */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="wss://relay.example.com"
                        value={newRelayUrl}
                        onChange={(e) => setNewRelayUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddRelay();
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleAddRelay}
                      disabled={!newRelayUrl.trim()}
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Relay count summary */}
                  <p className="text-xs text-muted-foreground">
                    📡 Budget syncing to {writeRelays.length} relay{writeRelays.length !== 1 ? 's' : ''}: {writeRelays.map(r => renderRelayUrl(r.url)).join(', ')}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator />

            {/* Manual Backup */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Download className="h-4 w-4" />
                Manual Backup
              </h3>
              <p className="text-sm text-muted-foreground">
                Export your data as a JSON file for local safekeeping.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export File
                </Button>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="w-full"
                  >
                    {isImporting ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Import File
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              💡 Your budget is encrypted with your Nostr keys. Keep your nsec safe!
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
