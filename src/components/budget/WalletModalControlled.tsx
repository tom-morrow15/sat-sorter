import { useState } from 'react';
import {
  Wallet, Trash2, Zap, CheckCircle,
  RefreshCw, FileSpreadsheet, QrCode, RotateCcw, Clock
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNWC } from '@/hooks/useNWCContext';
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

  const { toast } = useToast();
  const {
    isSyncing,
    syncTransactions,
    walletInfo,
    supportsListTransactions,
    autoSyncEnabled,
    startAutoSync,
    stopAutoSync,
    lastSyncTimestamp,
  } = useNWCSync();

  const {
    connections,
    addConnection,
    removeConnection,
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

    if (!alias.trim()) {
      toast({
        title: 'Wallet name required',
        description: 'Please enter a name for this wallet (e.g., "Alby Hub", "Mutiny"). This will help you identify transactions from each wallet.',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const success = await addConnection(connectionUri.trim(), alias.trim());
      if (success) {
        toast({
          title: 'Wallet connected!',
          description: 'Your wallet has been connected.',
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

  // Check connection status
  const hasAlbyHub = connections.length > 0;

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
            {hasAlbyHub && (
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-3 mb-4">
                <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">Connected:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-600">
                    <Zap className="h-3 w-3 mr-1" />
                    NWC Wallet
                  </Badge>
                </div>
              </div>
            )}

            <Tabs defaultValue="csv" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="csv" className="text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  CSV Import
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

              {/* Alby Hub Tab */}
              <TabsContent value="alby" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Connect via NWC (Nostr Wallet Connect) for automatic transaction import.
                </div>

                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    <strong>Requires list_transactions support.</strong> Currently only Alby Hub is known to support this. Most NWC wallets only support payments.
                  </AlertDescription>
                </Alert>

                {/* Connected wallets */}
                {connections.length > 0 && (
                  <div className="space-y-2">
                    {connections.map((conn: NWCConnection) => (
                      <div
                        key={conn.connectionString}
                        className="flex flex-col p-3 rounded-lg border bg-card gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <div>
                              <p className="text-sm font-medium">{conn.alias || 'NWC Wallet'}</p>
                              <p className="text-xs text-muted-foreground">Connected</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => syncTransactions(true)}
                              disabled={isSyncing}
                              title="Sync transactions now"
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

                        {/* Show wallet capabilities */}
                        {walletInfo?.methods && (
                          <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
                            <span className="font-medium">Capabilities: </span>
                            {walletInfo.methods.includes('list_transactions') ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                ✓ Transaction listing
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                ⚠ Payments only
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Auto-sync toggle - show if wallet info says it supports list_transactions OR if we couldn't fetch wallet info (assume it might work) */}
                        {(supportsListTransactions || !walletInfo) && (
                          <div className="flex items-center justify-between border-t pt-2 mt-1">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">Auto-sync every 5 min</span>
                            </div>
                            <Switch
                              checked={autoSyncEnabled}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  startAutoSync();
                                } else {
                                  stopAutoSync();
                                }
                              }}
                            />
                          </div>
                        )}

                        {/* Last sync time */}
                        {lastSyncTimestamp && (
                          <div className="text-xs text-muted-foreground">
                            Last synced: {new Date(lastSyncTimestamp * 1000).toLocaleString()}
                          </div>
                        )}

                        {/* Warning if list_transactions explicitly not supported */}
                        {walletInfo && walletInfo.methods && walletInfo.methods.length > 0 && !supportsListTransactions && (
                          <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/30 py-2">
                            <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                              This wallet doesn't support transaction listing. Use CSV import instead, or try a different wallet like Alby Hub.
                            </AlertDescription>
                          </Alert>
                        )}
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
                    <Label htmlFor="nwc-alias" className="text-xs">
                      Wallet Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nwc-alias"
                      placeholder="e.g., Alby Hub, Mutiny, Zeus"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This name will appear on all transactions from this wallet, helping you identify which wallet each payment came from.
                    </p>
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
                      disabled={isConnecting || !connectionUri.trim() || !alias.trim()}
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
