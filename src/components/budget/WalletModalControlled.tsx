import { useState, useEffect } from 'react';
import {
  Wallet, Plus, Trash2, Zap, CheckCircle,
  RefreshCw, FileSpreadsheet, QrCode, CreditCard, RotateCcw
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNWC } from '@/hooks/useNWCContext';
import { useToast } from '@/hooks/useToast';
import { useNWCSync } from '@/hooks/useNWCSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { DataSourcesDialog } from './DataSourcesDialog';
import { QRScanner } from './QRScanner';
import { useBudget } from '@/hooks/useBudget';
import type { NWCConnection } from '@/hooks/useNWC';

interface LNbitsConfig {
  url: string;
  adminKey: string;
}

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
  const [lnbitsSyncing, setLnbitsSyncing] = useState(false);
  const [lnbitsConfig, setLnbitsConfig] = useLocalStorage<LNbitsConfig | null>('lnbits-config', null);

  const { toast } = useToast();
  const { isSyncing, syncTransactions } = useNWCSync();
  const { addTransaction } = useBudget();

  const {
    connections,
    activeConnection,
    addConnection,
    removeConnection,
    setActiveConnection
  } = useNWC();

  // Load saved LNbits config
  useEffect(() => {
    if (lnbitsConfig) {
      setLnbitsUrl(lnbitsConfig.url);
      setLnbitsKey(lnbitsConfig.adminKey);
    }
  }, [lnbitsConfig]);

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
          description: 'Your Alby Hub wallet has been connected.',
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
  const handleLNbitsConnect = async () => {
    if (!lnbitsUrl || !lnbitsKey) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both URL and admin key.',
        variant: 'destructive',
      });
      return;
    }

    setLnbitsLoading(true);
    try {
      // Test connection
      const response = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
        headers: { 'X-Api-Key': lnbitsKey },
      });

      if (!response.ok) {
        throw new Error('Invalid credentials or connection failed');
      }

      const data = await response.json();
      
      // Save config
      setLnbitsConfig({ url: lnbitsUrl, adminKey: lnbitsKey });
      
      toast({
        title: 'LNbits connected!',
        description: `Connected to wallet: ${data.name || 'LNbits Wallet'}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLnbitsLoading(false);
    }
  };

  const handleLNbitsDisconnect = () => {
    setLnbitsConfig(null);
    setLnbitsUrl('');
    setLnbitsKey('');
    toast({
      title: 'LNbits disconnected',
      description: 'Your LNbits configuration has been removed.',
    });
  };

  const handleLNbitsSync = async () => {
    if (!lnbitsConfig) {
      toast({
        title: 'Not connected',
        description: 'Please connect to LNbits first.',
        variant: 'destructive',
      });
      return;
    }

    setLnbitsSyncing(true);
    try {
      // Fetch payments from LNbits
      const response = await fetch(`${lnbitsConfig.url}/api/v1/payments`, {
        headers: { 'X-Api-Key': lnbitsConfig.adminKey },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const payments = await response.json();
      
      if (!Array.isArray(payments) || payments.length === 0) {
        toast({
          title: 'No transactions found',
          description: 'No transactions found in your LNbits wallet.',
        });
        setLnbitsSyncing(false);
        return;
      }

      // Get existing payment hashes to avoid duplicates
      const existingHashes = new Set(
        JSON.parse(localStorage.getItem('lnbits-synced-hashes') || '[]')
      );

      let imported = 0;
      let skipped = 0;

      for (const payment of payments) {
        // Skip if already synced
        if (existingHashes.has(payment.payment_hash)) {
          skipped++;
          continue;
        }

        // Skip pending payments
        if (!payment.pending === false && payment.status !== 'success') {
          skipped++;
          continue;
        }

        const amountSats = Math.abs(Math.round(payment.amount / 1000)); // Convert from msats
        if (amountSats === 0) {
          skipped++;
          continue;
        }

        const isIncome = payment.amount > 0;

        addTransaction({
          amount: amountSats,
          description: payment.memo || payment.description || 'LNbits payment',
          date: new Date(payment.time * 1000).toISOString(),
          lineItemId: null,
          bucketId: null,
          isIncome,
          source: 'nwc',
          paymentHash: payment.payment_hash,
        });

        existingHashes.add(payment.payment_hash);
        imported++;
      }

      // Save synced hashes
      localStorage.setItem('lnbits-synced-hashes', JSON.stringify([...existingHashes]));

      toast({
        title: 'Sync complete',
        description: `Imported ${imported} transaction${imported !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      toast({
        title: 'Sync failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLnbitsSyncing(false);
    }
  };

  // Check connection status
  const hasAlbyHub = connections.length > 0;
  const hasLNbits = !!lnbitsConfig;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[85vh] rounded-lg p-0 overflow-hidden">
          <div className="p-6 overflow-y-auto max-h-[85vh]">
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Import Transactions
              </DialogTitle>
              <DialogDescription>
                Connect a wallet or import transactions manually
              </DialogDescription>
            </DialogHeader>

            {/* Connection Status */}
            {(hasAlbyHub || hasLNbits) && (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-3 mb-4">
                <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">Connected:</p>
                <div className="flex flex-wrap gap-2">
                  {hasAlbyHub && (
                    <Badge className="bg-green-600">
                      <Zap className="h-3 w-3 mr-1" />
                      Alby Hub
                    </Badge>
                  )}
                  {hasLNbits && (
                    <Badge className="bg-green-600">
                      <CreditCard className="h-3 w-3 mr-1" />
                      LNbits
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <Tabs defaultValue="csv" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="csv" className="text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  CSV Import
                </TabsTrigger>
                <TabsTrigger value="lnbits" className="text-xs">
                  <CreditCard className="h-3 w-3 mr-1" />
                  LNbits
                </TabsTrigger>
                <TabsTrigger value="alby" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Alby Hub
                </TabsTrigger>
              </TabsList>

              {/* CSV Import Tab */}
              <TabsContent value="csv" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Export transactions from your wallet app and import them here. Works with any wallet.
                </div>

                <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
                    <strong>Recommended for most users.</strong> Export a CSV from Phoenix, BlueWallet, Zeus, or any other wallet, then import it here.
                  </AlertDescription>
                </Alert>

                <Button
                  className="w-full"
                  onClick={() => setShowDataSources(true)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import CSV File
                </Button>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>How to export from popular wallets:</strong></p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li><strong>Phoenix:</strong> Settings → Payment History → Export</li>
                    <li><strong>BlueWallet:</strong> Wallet → ••• → Export Transactions</li>
                    <li><strong>Zeus:</strong> History → Export</li>
                  </ul>
                </div>
              </TabsContent>

              {/* LNbits Tab */}
              <TabsContent value="lnbits" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect to LNbits for automatic transaction import. Works with any LNbits instance.
                </div>

                {lnbitsConfig ? (
                  <div className="space-y-4">
                    <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-400">
                        Connected to LNbits
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={handleLNbitsSync}
                        disabled={lnbitsSyncing}
                      >
                        {lnbitsSyncing ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Import Transactions
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleLNbitsDisconnect}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="lnbits-url" className="text-xs">LNbits URL</Label>
                      <Input
                        id="lnbits-url"
                        placeholder="https://legend.lnbits.com"
                        value={lnbitsUrl}
                        onChange={(e) => setLnbitsUrl(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lnbits-key" className="text-xs">Admin Key (not Invoice Key)</Label>
                      <Input
                        id="lnbits-key"
                        type="password"
                        placeholder="Your admin key"
                        value={lnbitsKey}
                        onChange={(e) => setLnbitsKey(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Find this in your LNbits wallet under "API Info"
                      </p>
                    </div>
                    <Button
                      onClick={handleLNbitsConnect}
                      disabled={lnbitsLoading || !lnbitsUrl || !lnbitsKey}
                      className="w-full"
                    >
                      {lnbitsLoading ? 'Connecting...' : 'Connect to LNbits'}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Alby Hub Tab */}
              <TabsContent value="alby" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect to Alby Hub for automatic transaction import via NWC.
                </div>

                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    <strong>Alby Hub only.</strong> Other NWC wallets (Primal, Zeus) don't support transaction listing.
                  </AlertDescription>
                </Alert>

                {/* Connected wallets */}
                {connections.length > 0 && (
                  <div className="space-y-2">
                    {connections.map((conn: NWCConnection) => (
                      <div
                        key={conn.connectionString}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="text-sm font-medium">{conn.alias || 'Alby Hub'}</p>
                            <p className="text-xs text-muted-foreground">Connected</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncTransactions(true)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                          </Button>
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

                {/* Add connection */}
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">
                    {connections.length > 0 ? 'Add Another Wallet:' : 'Connect Alby Hub:'}
                  </p>
                  <div>
                    <Label htmlFor="nwc-alias" className="text-xs">Wallet Name (optional)</Label>
                    <Input
                      id="nwc-alias"
                      placeholder="My Alby Hub"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nwc-uri" className="text-xs">NWC Connection URI</Label>
                    <Textarea
                      id="nwc-uri"
                      placeholder="nostr+walletconnect://..."
                      value={connectionUri}
                      onChange={(e) => setConnectionUri(e.target.value)}
                      rows={2}
                      className="mt-1 text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      In Alby Hub: Settings → Connections → Add App → Copy URI
                    </p>
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
            </Tabs>

            {/* Manual Entry */}
            <Separator className="my-4" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">
                Or add transactions one at a time from the main screen
              </p>
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
        description="Scan the QR code from Alby Hub"
      />
    </>
  );
}
