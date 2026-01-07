import { useState, forwardRef, useEffect, useRef } from 'react';
import {
  Wallet, Plus, Trash2, Zap, Globe, WalletMinimal, CheckCircle, X,
  RefreshCw, Clock, FileSpreadsheet, Link2, QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useNWC } from '@/hooks/useNWCContext';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useNWCSync } from '@/hooks/useNWCSync';
import { DataSourcesDialog } from './DataSourcesDialog';
import { QRScanner } from './QRScanner';
import type { NWCConnection, NWCInfo } from '@/hooks/useNWC';
import type { WebLNProvider } from "@webbtc/webln-types";

interface WalletModalControlledProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Extracted AddWalletContent
const AddWalletContent = forwardRef<HTMLDivElement, {
  alias: string;
  setAlias: (value: string) => void;
  connectionUri: string;
  setConnectionUri: (value: string) => void;
  onScanQR?: () => void;
}>(({ alias, setAlias, connectionUri, setConnectionUri, onScanQR }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle keyboard visibility on mobile - scroll focused input into view
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Use setTimeout to wait for keyboard to appear
        setTimeout(() => {
          e.target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('focusin', handleFocus);
      return () => {
        container.removeEventListener('focusin', handleFocus);
      };
    }
  }, []);

  return (
    <div className="space-y-4 px-4" ref={(node) => {
      // Handle both refs
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }}>
      <div>
        <Label htmlFor="alias">Wallet Name (optional)</Label>
        <Input
          id="alias"
          placeholder="My Lightning Wallet"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="connection-uri">Connection URI</Label>
        <Textarea
          id="connection-uri"
          placeholder="nostr+walletconnect://..."
          value={connectionUri}
          onChange={(e) => setConnectionUri(e.target.value)}
          rows={3}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            Get this from your wallet app (e.g., Alby, Zeus, Primal).
          </p>
          {onScanQR && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onScanQR}
            >
              <QrCode className="h-4 w-4 mr-1" />
              Scan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
AddWalletContent.displayName = 'AddWalletContent';

// Format relative time
function formatLastSync(timestamp: number | null): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp * 1000;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Extracted WalletContent
const WalletContent = forwardRef<HTMLDivElement, {
  webln: WebLNProvider | null;
  hasNWC: boolean;
  connections: NWCConnection[];
  connectionInfo: Record<string, NWCInfo>;
  activeConnection: string | null;
  handleSetActive: (cs: string) => void;
  handleRemoveConnection: (cs: string) => void;
  setAddDialogOpen: (open: boolean) => void;
  // Sync props
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  lastSyncTimestamp: number | null;
  onSync: () => void;
  onToggleAutoSync: () => void;
  // Data sources
  onOpenDataSources: () => void;
}>(({
  webln,
  hasNWC,
  connections,
  connectionInfo,
  activeConnection,
  handleSetActive,
  handleRemoveConnection,
  setAddDialogOpen,
  isSyncing,
  autoSyncEnabled,
  lastSyncTimestamp,
  onSync,
  onToggleAutoSync,
  onOpenDataSources,
}, ref) => (
  <div className="space-y-6 px-4 pb-4" ref={ref}>
    {/* Current Status */}
    <div className="space-y-3">
      <h3 className="font-medium">Connection Status</h3>
      <div className="grid gap-3">
        {/* WebLN */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">WebLN</p>
              <p className="text-xs text-muted-foreground">Browser extension</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {webln && <CheckCircle className="h-4 w-4 text-green-600" />}
            <Badge variant={webln ? "default" : "secondary"} className="text-xs">
              {webln ? "Ready" : "Not Found"}
            </Badge>
          </div>
        </div>
        {/* NWC */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <WalletMinimal className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Nostr Wallet Connect</p>
              <p className="text-xs text-muted-foreground">
                {connections.length > 0
                  ? `${connections.length} wallet${connections.length !== 1 ? 's' : ''} connected`
                  : "Remote wallet connection"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasNWC && <CheckCircle className="h-4 w-4 text-green-600" />}
            <Badge variant={hasNWC ? "default" : "secondary"} className="text-xs">
              {hasNWC ? "Ready" : "None"}
            </Badge>
          </div>
        </div>
      </div>
    </div>

    {/* Transaction Sync Section - Only show when wallet connected */}
    {hasNWC && (
      <>
        <Separator />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Transaction Sync</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>

          {/* Last Sync Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last synced: {formatLastSync(lastSyncTimestamp)}</span>
            </div>
          </div>

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Auto-sync</p>
              <p className="text-xs text-muted-foreground">
                Automatically import new transactions every 5 minutes
              </p>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={onToggleAutoSync}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            💡 <strong>Note:</strong> Transaction sync requires your wallet to support the
            <code className="mx-1 px-1 bg-muted rounded">list_transactions</code>
            method. Not all wallets support this feature.
          </p>
        </div>
      </>
    )}

    <Separator />

    {/* Import Transactions Section */}
    <div className="space-y-3">
      <h3 className="font-medium">Import Transactions</h3>
      <p className="text-sm text-muted-foreground">
        Import transactions from your wallet or a CSV file
      </p>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={onOpenDataSources}
      >
        <Link2 className="h-4 w-4 mr-2" />
        Connect Data Sources
        <span className="ml-auto text-xs text-muted-foreground">NWC, CSV, more...</span>
      </Button>
    </div>

    <Separator />
    {/* NWC Management */}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Nostr Wallet Connect</h3>
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Wallet
        </Button>
      </div>
      {/* Connected Wallets List */}
      {connections.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No wallets connected</p>
          <p className="text-xs mt-1">Connect your Lightning wallet to track transactions</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => {
            const info = connectionInfo[connection.connectionString];
            const isActive = activeConnection === connection.connectionString;
            return (
              <div key={connection.connectionString} className={`flex items-center justify-between p-3 border rounded-lg ${isActive ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-center gap-3">
                  <WalletMinimal className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {connection.alias || info?.alias || 'Lightning Wallet'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NWC Connection
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetActive(connection.connectionString)}
                    >
                      <Zap className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveConnection(connection.connectionString)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    {/* Help */}
    {!webln && connections.length === 0 && (
      <>
        <Separator />
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to automatically track your Lightning transactions.
          </p>
        </div>
      </>
    )}
  </div>
));
WalletContent.displayName = 'WalletContent';

export function WalletModalControlled({ open, onOpenChange }: WalletModalControlledProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const isMobile = useIsMobile();

  const handleQRScan = (result: string) => {
    // Check if it's a valid NWC URI
    if (result.startsWith('nostr+walletconnect://') || result.startsWith('nostrwalletconnect://')) {
      setConnectionUri(result);
      setShowQRScanner(false);
    }
  };

  const {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection
  } = useNWC();

  const { webln } = useWallet();

  const {
    isSyncing,
    autoSyncEnabled,
    lastSyncTimestamp,
    syncTransactions,
    startAutoSync,
    stopAutoSync,
  } = useNWCSync();

  const hasNWC = connections.length > 0 && connections.some(c => c.isConnected);
  const { toast } = useToast();

  const handleAddConnection = async () => {
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
        setConnectionUri('');
        setAlias('');
        setAddDialogOpen(false);
      }
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

  const handleSync = () => {
    syncTransactions(true);
  };

  const handleToggleAutoSync = () => {
    if (autoSyncEnabled) {
      stopAutoSync();
    } else {
      startAutoSync();
    }
  };

  const walletContentProps = {
    webln,
    hasNWC,
    connections,
    connectionInfo,
    activeConnection,
    handleSetActive,
    handleRemoveConnection,
    setAddDialogOpen,
    isSyncing,
    autoSyncEnabled,
    lastSyncTimestamp,
    onSync: handleSync,
    onToggleAutoSync: handleToggleAutoSync,
    onOpenDataSources: () => setShowDataSources(true),
  };

  // Use Dialog on both mobile and desktop for consistent, fixed positioning
  // Force centered modal behavior, not drawer-like popup from bottom
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[85vh] overflow-y-auto rounded-lg fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Lightning Wallet
            </DialogTitle>
            <DialogDescription>
              Connect your wallet to track transactions automatically.
            </DialogDescription>
          </DialogHeader>
          <WalletContent {...walletContentProps} />
        </DialogContent>
      </Dialog>
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[85vh] overflow-y-auto rounded-lg fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <DialogHeader>
            <DialogTitle>Connect NWC Wallet</DialogTitle>
            <DialogDescription>
              Enter your connection string or scan a QR code.
            </DialogDescription>
          </DialogHeader>
          <AddWalletContent
            alias={alias}
            setAlias={setAlias}
            connectionUri={connectionUri}
            setConnectionUri={setConnectionUri}
            onScanQR={() => setShowQRScanner(true)}
          />
          <DialogFooter className="px-4 pt-2">
            <Button
              onClick={handleAddConnection}
              disabled={isConnecting || !connectionUri.trim()}
              className="w-full"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
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
