import { useState } from 'react';
import { Settings2, Zap, Globe, Server, Zaplier, CreditCard, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet, saveLNbitsConfig, clearLNbitsConfig, saveNodeConfig, clearNodeConfig, type LNbitsConfig, type DirectNodeConfig } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';

interface WalletMethodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletMethodsDialog({ open, onOpenChange }: WalletMethodsDialogProps) {
  const { hasNWC, hasWebLN, availableMethods } = useWallet();
  const { addToast } = useToast();
  
  // LNbits state
  const [lnbitsUrl, setLnbitsUrl] = useState('');
  const [lnbitsKey, setLnbitsKey] = useState('');
  const [lnbitsLoading, setLnbitsLoading] = useState(false);

  // Direct Node state
  const [nodeType, setNodeType] = useState<'lnd' | 'clightning' | 'eclair'>('lnd');
  const [nodeHost, setNodeHost] = useState('');
  const [nodePort, setNodePort] = useState('10009');
  const [nodeMacaroon, setNodeMacaroon] = useState('');
  const [nodeTlsCert, setNodeTlsCert] = useState('');
  const [nodeLoading, setNodeLoading] = useState(false);

  // Validate LNbits connection
  const handleLNbitsTest = async () => {
    if (!lnbitsUrl || !lnbitsKey) {
      addToast('Please enter both URL and admin key', 'error');
      return;
    }

    setLnbitsLoading(true);
    try {
      // Test the connection by fetching wallet info
      const response = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
        headers: {
          'X-Api-Key': lnbitsKey,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid credentials or connection failed');
      }

      const data = await response.json();
      
      // Save the config
      saveLNbitsConfig({ url: lnbitsUrl, adminKey: lnbitsKey });
      addToast('LNbits wallet connected successfully!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      addToast(`Failed to connect: ${message}`, 'error');
    } finally {
      setLnbitsLoading(false);
    }
  };

  // Handle LNbits disconnect
  const handleLNbitsDisconnect = () => {
    clearLNbitsConfig();
    setLnbitsUrl('');
    setLnbitsKey('');
    addToast('LNbits configuration removed', 'success');
  };

  // Validate Direct Node connection
  const handleNodeTest = async () => {
    if (!nodeHost || !nodePort) {
      addToast('Please enter host and port', 'error');
      return;
    }

    if (nodeType === 'lnd' && !nodeMacaroon) {
      addToast('LND requires a macaroon file', 'error');
      return;
    }

    setNodeLoading(true);
    try {
      // Basic validation - actual implementation would depend on node type
      // For now, just validate connection format
      const port = parseInt(nodePort);
      if (port < 1 || port > 65535) {
        throw new Error('Invalid port number');
      }

      // Save the config
      saveNodeConfig({
        type: nodeType,
        host: nodeHost,
        port,
        macaroon: nodeMacaroon || undefined,
        tlsCert: nodeTlsCert || undefined,
      });

      addToast(`${nodeType} node configured successfully!`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed';
      addToast(`Failed to configure: ${message}`, 'error');
    } finally {
      setNodeLoading(false);
    }
  };

  // Handle node disconnect
  const handleNodeDisconnect = () => {
    clearNodeConfig();
    setNodeHost('');
    setNodePort('10009');
    setNodeMacaroon('');
    setNodeTlsCert('');
    addToast('Node configuration removed', 'success');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Payment Methods
          </DialogTitle>
          <DialogDescription>
            Configure multiple wallet connection methods for maximum compatibility
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Available Methods Summary */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm font-medium mb-2">Active Methods:</p>
            <div className="flex flex-wrap gap-2">
              {availableMethods.includes('nwc') && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  NWC
                </Badge>
              )}
              {availableMethods.includes('webln') && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  WebLN
                </Badge>
              )}
              {availableMethods.includes('lnbits') && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  LNbits
                </Badge>
              )}
              {availableMethods.includes('node') && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  Direct Node
                </Badge>
              )}
              {availableMethods.length === 1 && availableMethods[0] === 'manual' && (
                <Badge variant="outline">Manual Only</Badge>
              )}
            </div>
          </div>

          <Tabs defaultValue="webln" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="webln">
                <Globe className="h-4 w-4 mr-2" />
                WebLN
              </TabsTrigger>
              <TabsTrigger value="lnbits">
                <CreditCard className="h-4 w-4 mr-2" />
                LNbits
              </TabsTrigger>
              <TabsTrigger value="node">
                <Server className="h-4 w-4 mr-2" />
                Node
              </TabsTrigger>
            </TabsList>

            {/* WebLN Tab */}
            <TabsContent value="webln" className="space-y-4">
              <Alert>
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  WebLN automatically detects browser extension wallets like Alby, Nos2x, and Nostrich. No configuration needed!
                </AlertDescription>
              </Alert>

              {hasWebLN ? (
                <div className="rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/30 p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Zaplier className="h-4 w-4" />
                    <span>WebLN wallet detected and ready to use</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                    Your browser has a compatible wallet extension installed.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No WebLN wallet detected. Install Alby or another WebLN-compatible extension to enable this method.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => window.open('https://getalby.com', '_blank')}
                  >
                    Get Alby
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* LNbits Tab */}
            <TabsContent value="lnbits" className="space-y-4">
              <Alert>
                <Server className="h-4 w-4" />
                <AlertDescription>
                  LNbits is perfect for self-hosted Lightning setups. Enter your LNbits instance URL and admin key.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="lnbits-url">LNbits Instance URL</Label>
                  <Input
                    id="lnbits-url"
                    placeholder="https://lnbits.example.com"
                    value={lnbitsUrl}
                    onChange={(e) => setLnbitsUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Your self-hosted or public LNbits instance URL
                  </p>
                </div>

                <div>
                  <Label htmlFor="lnbits-key">Admin Key</Label>
                  <Input
                    id="lnbits-key"
                    type="password"
                    placeholder="sk_..."
                    value={lnbitsKey}
                    onChange={(e) => setLnbitsKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Found in LNbits wallet settings (Admin/API section)
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleLNbitsTest}
                    disabled={lnbitsLoading || !lnbitsUrl || !lnbitsKey}
                    className="flex-1"
                  >
                    {lnbitsLoading ? 'Testing...' : 'Test & Connect'}
                  </Button>
                  {lnbitsUrl && lnbitsKey && (
                    <Button
                      variant="destructive"
                      onClick={handleLNbitsDisconnect}
                      size="icon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Direct Node Tab */}
            <TabsContent value="node" className="space-y-4">
              <Alert>
                <Zaplier className="h-4 w-4" />
                <AlertDescription>
                  Connect directly to your Lightning node (LND, C-Lightning, or Eclair) for full control.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="node-type">Node Type</Label>
                  <Select value={nodeType} onValueChange={(v) => setNodeType(v as any)}>
                    <SelectTrigger id="node-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lnd">LND (Lightning Network Daemon)</SelectItem>
                      <SelectItem value="clightning">C-Lightning</SelectItem>
                      <SelectItem value="eclair">Eclair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="node-host">Host</Label>
                    <Input
                      id="node-host"
                      placeholder="localhost"
                      value={nodeHost}
                      onChange={(e) => setNodeHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="node-port">Port</Label>
                    <Input
                      id="node-port"
                      placeholder="10009"
                      value={nodePort}
                      onChange={(e) => setNodePort(e.target.value)}
                    />
                  </div>
                </div>

                {nodeType === 'lnd' && (
                  <div>
                    <Label htmlFor="node-macaroon">Macaroon (Base64)</Label>
                    <Input
                      id="node-macaroon"
                      type="password"
                      placeholder="Paste base64 encoded macaroon"
                      value={nodeMacaroon}
                      onChange={(e) => setNodeMacaroon(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Get from ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
                    </p>
                  </div>
                )}

                {(nodeType === 'lnd' || nodeType === 'eclair') && (
                  <div>
                    <Label htmlFor="node-tls">TLS Certificate (optional)</Label>
                    <Input
                      id="node-tls"
                      type="password"
                      placeholder="Paste base64 encoded certificate"
                      value={nodeTlsCert}
                      onChange={(e) => setNodeTlsCert(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleNodeTest}
                    disabled={nodeLoading || !nodeHost || !nodePort}
                    className="flex-1"
                  >
                    {nodeLoading ? 'Configuring...' : 'Configure & Connect'}
                  </Button>
                  {nodeHost && (
                    <Button
                      variant="destructive"
                      onClick={handleNodeDisconnect}
                      size="icon"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Priority Info */}
          <div className="rounded-lg border border-blue-500/50 bg-blue-50 dark:bg-blue-950/30 p-3">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">Connection Priority:</p>
            <ol className="text-xs text-blue-600 dark:text-blue-500 space-y-1 ml-3 list-decimal">
              <li>NWC (Nostr Wallet Connect)</li>
              <li>WebLN (Browser Extensions)</li>
              <li>LNbits (Self-hosted or public)</li>
              <li>Direct Node API (Advanced)</li>
              <li>Manual Payment Entry</li>
            </ol>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
              The app will automatically use the first available method.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
