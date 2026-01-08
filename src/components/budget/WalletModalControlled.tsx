import { useState, useRef, useEffect } from 'react';
import {
  Wallet, Plus, Trash2, Zap, Globe, CheckCircle, Server,
  RefreshCw, FileSpreadsheet, QrCode, CreditCard, Lightbulb, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNWC } from '@/hooks/useNWCContext';
import { useWallet, saveLNbitsConfig, clearLNbitsConfig, saveNodeConfig, clearNodeConfig } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { useNWCSync } from '@/hooks/useNWCSync';
import { DataSourcesDialog } from './DataSourcesDialog';
import { QRScanner } from './QRScanner';
import type { NWCConnection } from '@/hooks/useNWC';

interface WalletModalControlledProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModalControlled({ open, onOpenChange }: WalletModalControlledProps) {
  const [showDataSources, setShowDataSources] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // LNbits state
  const [lnbitsUrl, setLnbitsUrl] = useState('');
  const [lnbitsKey, setLnbitsKey] = useState('');
  const [lnbitsLoading, setLnbitsLoading] = useState(false);

  // Direct Node state
  const [nodeType, setNodeType] = useState<'lnd' | 'clightning' | 'eclair'>('lnd');
  const [nodeHost, setNodeHost] = useState('');
  const [nodePort, setNodePort] = useState('10009');
  const [nodeMacaroon, setNodeMacaroon] = useState('');
  const [nodeLoading, setNodeLoading] = useState(false);

  const { toast, addToast } = useToast();
  const { hasNWC, hasWebLN, webln, availableMethods } = useWallet();
  const { isSyncing, syncTransactions, autoSyncEnabled, startAutoSync, stopAutoSync, lastSyncTimestamp } = useNWCSync();

  const {
    connections,
    activeConnection,
    addConnection,
    removeConnection,
    setActiveConnection
  } = useNWC();

  const handleQRScan = (result: string) => {
    if (result.startsWith('nostr+walletconnect://') || result.startsWith('nostrwalletconnect://')) {
      setConnectionUri(result);
      setShowQRScanner(false);
    }
  };

  const handleAddNWCConnection = async () => {
    if (!connectionUri.trim()) {
      toast({
        title: 'Connection URI required',
        description: 'Please enter a valid NWC connection URI.',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const success = await addConnection(connectionUri.trim(), alias.trim() || undefined);
      if (success) {
        toast({
          title: 'Wallet connected!',
          description: 'Your NWC wallet has been connected successfully.',
        });
        setConnectionUri('');
        setAlias('');
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveConnection = (connectionString: string) => {
    removeConnection(connectionString);
  };

  const handleSetActive = (connectionString: string) => {
    setActiveConnection(connectionString);
    toast({
      title: 'Active wallet changed',
      description: 'The selected wallet is now active.',
    });
  };

  // LNbits handlers
  const handleLNbitsTest = async () => {
    if (!lnbitsUrl || !lnbitsKey) {
      addToast('Please enter both URL and admin key', 'error');
      return;
    }

    setLnbitsLoading(true);
    try {
      const response = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
        headers: { 'X-Api-Key': lnbitsKey },
      });

      if (!response.ok) {
        throw new Error('Invalid credentials or connection failed');
      }

      saveLNbitsConfig({ url: lnbitsUrl, adminKey: lnbitsKey });
      addToast('LNbits wallet connected!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      addToast(`Failed to connect: ${message}`, 'error');
    } finally {
      setLnbitsLoading(false);
    }
  };

  const handleLNbitsDisconnect = () => {
    clearLNbitsConfig();
    setLnbitsUrl('');
    setLnbitsKey('');
    addToast('LNbits configuration removed', 'success');
  };

  // Direct Node handlers
  const handleNodeConnect = async () => {
    if (!nodeHost || !nodePort) {
      addToast('Please enter host and port', 'error');
      return;
    }

    if (nodeType === 'lnd' && !nodeMacaroon) {
      addToast('LND requires a macaroon', 'error');
      return;
    }

    setNodeLoading(true);
    try {
      const port = parseInt(nodePort);
      if (port < 1 || port > 65535) {
        throw new Error('Invalid port number');
      }

      saveNodeConfig({
        type: nodeType,
        host: nodeHost,
        port,
        macaroon: nodeMacaroon || undefined,
      });

      addToast(`${nodeType.toUpperCase()} node configured!`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed';
      addToast(`Failed to configure: ${message}`, 'error');
    } finally {
      setNodeLoading(false);
    }
  };

  const handleNodeDisconnect = () => {
    clearNodeConfig();
    setNodeHost('');
    setNodePort('10009');
    setNodeMacaroon('');
    addToast('Node configuration removed', 'success');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[550px] max-h-[90vh] rounded-lg sm:rounded-lg p-0 overflow-hidden">
          <div className="p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader className="pb-4 pr-8">
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Connections
              </DialogTitle>
              <DialogDescription>
                Connect your wallet to track Lightning transactions
              </DialogDescription>
            </DialogHeader>

            {/* Active Methods Summary */}
            <div className="rounded-lg border bg-muted/50 p-3 mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Connected Methods:</p>
              <div className="flex flex-wrap gap-2">
                {availableMethods.includes('nwc') && (
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                    <Zap className="h-3 w-3" />
                    NWC
                  </Badge>
                )}
                {availableMethods.includes('webln') && (
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                    <Globe className="h-3 w-3" />
                    WebLN
                  </Badge>
                )}
                {availableMethods.includes('lnbits') && (
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                    <CreditCard className="h-3 w-3" />
                    LNbits
                  </Badge>
                )}
                {availableMethods.includes('node') && (
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                    <Server className="h-3 w-3" />
                    Node
                  </Badge>
                )}
                {availableMethods.length === 1 && availableMethods[0] === 'manual' && (
                  <Badge variant="outline" className="text-muted-foreground">No wallets connected</Badge>
                )}
              </div>
            </div>

            <Tabs defaultValue="nwc" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="nwc" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  NWC
                </TabsTrigger>
                <TabsTrigger value="webln" className="text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  WebLN
                </TabsTrigger>
                <TabsTrigger value="lnbits" className="text-xs">
                  <CreditCard className="h-3 w-3 mr-1" />
                  LNbits
                </TabsTrigger>
                <TabsTrigger value="node" className="text-xs">
                  <Server className="h-3 w-3 mr-1" />
                  Node
                </TabsTrigger>
              </TabsList>

              {/* NWC Tab */}
              <TabsContent value="nwc" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect using Nostr Wallet Connect (NWC) for secure wallet integration.
                </div>

                {/* Manual Sync Section - Show when wallet is connected */}
                {connections.length > 0 && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Sync Transactions</p>
                        {lastSyncTimestamp && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {new Date(lastSyncTimestamp * 1000).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncTransactions(true)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Refresh Now
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Auto-sync every 5 min</span>
                      <Button
                        size="sm"
                        variant={autoSyncEnabled ? "default" : "outline"}
                        onClick={autoSyncEnabled ? stopAutoSync : startAutoSync}
                      >
                        {autoSyncEnabled ? 'On' : 'Off'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Connected NWC Wallets */}
                {connections.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Connected Wallets:</p>
                    {connections.map((conn: NWCConnection) => (
                      <div
                        key={conn.connectionString}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-2">
                          {conn.isConnected ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{conn.alias || 'NWC Wallet'}</p>
                            <p className="text-xs text-muted-foreground">
                              {conn.isConnected ? 'Connected' : 'Connecting...'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeConnection === conn.connectionString ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetActive(conn.connectionString)}
                            >
                              Set Active
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveConnection(conn.connectionString)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add NWC Connection */}
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">Add NWC Wallet:</p>
                  <div>
                    <Label htmlFor="nwc-alias" className="text-xs">Wallet Name (optional)</Label>
                    <Input
                      id="nwc-alias"
                      placeholder="My Wallet"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nwc-uri" className="text-xs">Connection URI</Label>
                    <Textarea
                      id="nwc-uri"
                      placeholder="nostr+walletconnect://..."
                      value={connectionUri}
                      onChange={(e) => setConnectionUri(e.target.value)}
                      rows={2}
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddNWCConnection}
                      disabled={isConnecting || !connectionUri.trim()}
                      className="flex-1"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowQRScanner(true)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* WebLN Tab */}
              <TabsContent value="webln" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  WebLN auto-detects browser extension wallets like Alby. No setup needed!
                </div>

                {hasWebLN ? (
                  <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      WebLN wallet detected and ready to use!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
                      <Globe className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        No WebLN wallet detected. Install a browser extension to use this method.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://getalby.com', '_blank')}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Get Alby Extension
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* LNbits Tab */}
              <TabsContent value="lnbits" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect to your self-hosted or public LNbits instance.
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="lnbits-url" className="text-xs">LNbits URL</Label>
                    <Input
                      id="lnbits-url"
                      placeholder="https://lnbits.example.com"
                      value={lnbitsUrl}
                      onChange={(e) => setLnbitsUrl(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lnbits-key" className="text-xs">Admin Key</Label>
                    <Input
                      id="lnbits-key"
                      type="password"
                      placeholder="sk_..."
                      value={lnbitsKey}
                      onChange={(e) => setLnbitsKey(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleLNbitsTest}
                      disabled={lnbitsLoading || !lnbitsUrl || !lnbitsKey}
                      className="flex-1"
                    >
                      {lnbitsLoading ? 'Testing...' : 'Connect'}
                    </Button>
                    {(lnbitsUrl || lnbitsKey) && (
                      <Button variant="destructive" size="icon" onClick={handleLNbitsDisconnect}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Direct Node Tab */}
              <TabsContent value="node" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect directly to your Lightning node (advanced).
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="node-type" className="text-xs">Node Type</Label>
                    <Select value={nodeType} onValueChange={(v) => setNodeType(v as 'lnd' | 'clightning' | 'eclair')}>
                      <SelectTrigger id="node-type" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lnd">LND</SelectItem>
                        <SelectItem value="clightning">C-Lightning</SelectItem>
                        <SelectItem value="eclair">Eclair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="node-host" className="text-xs">Host</Label>
                      <Input
                        id="node-host"
                        placeholder="localhost"
                        value={nodeHost}
                        onChange={(e) => setNodeHost(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="node-port" className="text-xs">Port</Label>
                      <Input
                        id="node-port"
                        placeholder="10009"
                        value={nodePort}
                        onChange={(e) => setNodePort(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {nodeType === 'lnd' && (
                    <div>
                      <Label htmlFor="node-macaroon" className="text-xs">Macaroon (Base64)</Label>
                      <Input
                        id="node-macaroon"
                        type="password"
                        placeholder="Paste base64 macaroon"
                        value={nodeMacaroon}
                        onChange={(e) => setNodeMacaroon(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleNodeConnect}
                      disabled={nodeLoading || !nodeHost || !nodePort}
                      className="flex-1"
                    >
                      {nodeLoading ? 'Connecting...' : 'Connect'}
                    </Button>
                    {nodeHost && (
                      <Button variant="destructive" size="icon" onClick={handleNodeDisconnect}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Import Transactions Section */}
            <Separator className="my-4" />
            <div className="space-y-3">
              <p className="text-sm font-medium">Import Transactions</p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowDataSources(true)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import from CSV file
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      <DataSourcesDialog open={showDataSources} onOpenChange={setShowDataSources} />
      <QRScanner
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onScan={handleQRScan}
        title="Scan NWC QR Code"
        description="Scan the QR code from your wallet app"
      />
    </>
  );
}
