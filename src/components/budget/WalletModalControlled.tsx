import { useState, forwardRef } from 'react';
import {
  Wallet, Plus, Trash2, Zap, Globe, WalletMinimal, CheckCircle, X,
  RefreshCw, Clock, QrCode, Shield, ArrowLeft,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
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
import { QRScanner } from './QRScanner';
import type { NWCConnection, NWCInfo } from '@/hooks/useNWC';
import type { WebLNProvider } from "@webbtc/webln-types";

interface WalletModalControlledProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Privacy Banner ───
function PrivacyBanner() {
  return (
    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
      <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-green-900 dark:text-green-100">Your data stays private</p>
        <p className="text-green-700 dark:text-green-300 text-xs mt-1">
          Your wallet connection is encrypted and stored locally. Transaction data never leaves your device — not even we can see it.
        </p>
      </div>
    </div>
  );
}

// ─── Per-wallet connection guides ───
// Novice path: pick your wallet, follow the taps, paste the string.
const WALLET_GUIDES: { id: string; name: string; steps: string[]; note?: string }[] = [
  {
    id: 'primal',
    name: 'Primal',
    steps: [
      'Open the Primal app and go to your Wallet',
      'Open Wallet settings and find "Nostr Wallet Connect" (connected apps)',
      'Create a connection and enable "list_transactions" — Sat Sorter needs it for auto-import',
      'Copy the nostr+walletconnect:// string and paste it below',
    ],
    note: 'Primal is non-custodial: the Primal app must be running for Sat Sorter to read transactions (or use Primal\'s Remote Signer).',
  },
  {
    id: 'alby',
    name: 'Alby Hub / Alby',
    steps: [
      'Open Alby Hub → Apps → "New app" (or the Alby extension → Settings → Nostr Wallet Connect)',
      'Name the connection "Sat Sorter"',
      'Grant at least "list_transactions" (add get_balance and pay_invoice if you want zaps)',
      'Copy the nostr+walletconnect:// string and paste it below',
    ],
  },
  {
    id: 'zeus',
    name: 'Zeus',
    steps: [
      'Open Zeus → Settings → "Nostr Wallet Connect"',
      'Create a new connection named "Sat Sorter" with "list_transactions" enabled',
      'Copy the connection string and paste it below',
    ],
  },
  {
    id: 'coinos',
    name: 'Coinos',
    steps: [
      'Log in to Coinos → Account settings → Nostr Wallet Connect',
      'Create a connection with "list_transactions" enabled',
      'Copy the connection string and paste it below',
    ],
  },
  {
    id: 'other',
    name: 'Other wallet',
    steps: [
      'In your wallet, look for "Nostr Wallet Connect", "NWC", or "Connect to app"',
      'Create a connection and enable "list_transactions" if available',
      'Copy the nostr+walletconnect:// string and paste it below',
    ],
  },
];

// ─── Add Wallet Form ───
const AddWalletContent = forwardRef<HTMLDivElement, {
  alias: string;
  setAlias: (value: string) => void;
  connectionUri: string;
  setConnectionUri: (value: string) => void;
  onScanQR?: () => void;
}>(({ alias, setAlias, connectionUri, setConnectionUri, onScanQR }, ref) => {
  const [selectedGuide, setSelectedGuide] = useState('other');
  const guide = WALLET_GUIDES.find((g) => g.id === selectedGuide) ?? WALLET_GUIDES[WALLET_GUIDES.length - 1];

  return (
    <div className="space-y-4 px-4" ref={ref}>
      {/* Step 1: pick your wallet — shows exact taps for each one */}
      <div className="space-y-2">
        <Label>Which wallet are you connecting?</Label>
        <div className="flex flex-wrap gap-1.5">
          {WALLET_GUIDES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGuide(g.id)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                selectedGuide === g.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/60'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside bg-muted/20 border border-border/40 rounded-lg p-3">
          {guide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {guide.note && (
          <p className="text-xs text-amber-600 dark:text-amber-400">💡 {guide.note}</p>
        )}
      </div>

      {/* Step 2: paste the connection string */}
      <div>
        <Label htmlFor="connection-uri">Connection string</Label>
        <Textarea
          id="connection-uri"
          placeholder="nostr+walletconnect://..."
          value={connectionUri}
          onChange={(e) => setConnectionUri(e.target.value)}
          rows={3}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
          Looks like nostr+walletconnect://… — paste it exactly as copied.
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

      {/* Step 3: optional name — auto-filled from the wallet on connect anyway */}
      <div>
        <Label htmlFor="alias">Wallet Name (optional)</Label>
        <Input
          id="alias"
          placeholder={guide.name}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
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

// ─── Wallet Content (main body) ───
const WalletContent = forwardRef<HTMLDivElement, {
  webln: WebLNProvider | null;
  hasNWC: boolean;
  connections: NWCConnection[];
  connectionInfo: Record<string, NWCInfo>;
  activeConnection: string | null;
  handleSetActive: (cs: string) => void;
  handleRemoveConnection: (cs: string) => void;
  setAddDialogOpen: (open: boolean) => void;
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  lastSyncTimestamp: number | null;
  onSync: () => void;
  onToggleAutoSync: () => void;
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
}, ref) => {
  // Connection-protocol details (WebLN, NWC capabilities) are power-user
  // info — collapsed by default so novices see only what matters.
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
  <div className="space-y-6 px-4 pb-4" ref={ref}>
    <PrivacyBanner />

    {/* Connection details — power-user info, collapsed by default */}
    <div>
      <button
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? '▾' : '▸'} Advanced — connection details
      </button>
      {showAdvanced && (
      <div className="space-y-3 mt-2">
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
      )}
    </div>

    {/* Transaction Sync Section — only when a wallet is connected */}
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
                Automatically import new Lightning transactions every 5 minutes
              </p>
            </div>
            <Switch
              checked={autoSyncEnabled}
              onCheckedChange={onToggleAutoSync}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Transaction sync requires your wallet to support the
            <code className="mx-1 px-1 bg-muted rounded">list_transactions</code>
            method. Not all wallets support this feature.
          </p>
        </div>
      </>
    )}

    <Separator />

    {/* Connected Wallets Management */}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Lightning Wallets</h3>
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Wallet
        </Button>
      </div>
      {connections.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
            <WalletMinimal className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">No wallets connected</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Connect your Lightning wallet (Alby, Zeus, Primal, etc.) to automatically import transactions when you send or receive sats.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Connect Wallet
          </Button>
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

    {/* Help text for users with no connections */}
    {!webln && connections.length === 0 && (
      <>
        <Separator />
        <div className="space-y-3">
          <h3 className="font-medium text-sm">How it works</h3>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Connect your Lightning wallet using its NWC connection string</li>
            <li>Enable auto-sync to automatically import new transactions</li>
            <li>Imported transactions appear as unassigned — organize them into your budget categories</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Your wallet connection is encrypted and stored locally. We never see your transactions.
          </p>
        </div>
      </>
    )}
  </div>
  );
});
WalletContent.displayName = 'WalletContent';

// ─── Main Component ───
export function WalletModalControlled({ open, onOpenChange }: WalletModalControlledProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const isMobile = useIsMobile();

  const handleQRScan = (result: string) => {
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
    syncTransactions(true).catch((error) => {
      console.error('Sync failed:', error);
    });
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
  };

  if (isMobile) {
    return (
      <>
        {/* Main wallet view as a Drawer (browsing, no text inputs) */}
        <Drawer open={open && !addDialogOpen} onOpenChange={(v) => {
          if (!v) {
            setAddDialogOpen(false);
            onOpenChange(false);
          }
        }}>
          <DrawerContent className="max-h-[90vh] flex flex-col">
            <DrawerHeader className="text-center relative flex-shrink-0">
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
              <DrawerTitle className="flex items-center justify-center gap-2 pt-2">
                <Wallet className="h-5 w-5" />
                Lightning Wallet
              </DrawerTitle>
              <DrawerDescription>
                Connect your wallet for automatic transaction imports
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
              <WalletContent {...walletContentProps} />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Add Wallet form as a separate Dialog on mobile.
            Using a Dialog instead of keeping the form inside the Drawer
            because vaul (the Drawer library) conflicts with mobile keyboards:
            tapping an input causes the viewport to shift, and scrolling
            triggers the Drawer's drag-to-close gesture, dismissing the form.
            A Dialog uses position:fixed centering with no drag behavior. */}
        <Dialog open={open && addDialogOpen} onOpenChange={(v) => {
          if (!v) setAddDialogOpen(false);
        }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[425px] max-h-[85dvh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 -ml-2"
                  onClick={() => setAddDialogOpen(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Connect Wallet
                </DialogTitle>
              </div>
              <DialogDescription>
                Enter your connection string or scan a QR code.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-6">
              <AddWalletContent
                alias={alias}
                setAlias={setAlias}
                connectionUri={connectionUri}
                setConnectionUri={setConnectionUri}
                onScanQR={() => setShowQRScanner(true)}
              />
            </div>
            <DialogFooter className="px-6 py-4 flex-shrink-0 border-t">
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          {addDialogOpen ? (
            /* ─── Inline Add Wallet View ───
               Rendered inside the same dialog to avoid nested-dialog
               positioning and focus-trap conflicts. */
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </Button>
                  <DialogTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Connect Lightning Wallet
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Enter your connection string or scan a QR code from your wallet app.
                </DialogDescription>
              </DialogHeader>
              <AddWalletContent
                alias={alias}
                setAlias={setAlias}
                connectionUri={connectionUri}
                setConnectionUri={setConnectionUri}
                onScanQR={() => setShowQRScanner(true)}
              />
              <div className="px-4">
                <Button
                  onClick={handleAddConnection}
                  disabled={isConnecting || !connectionUri.trim()}
                  className="w-full"
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </>
          ) : (
            /* ─── Main Wallet View ─── */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Lightning Wallet
                </DialogTitle>
                <DialogDescription>
                  Connect your wallet for automatic transaction imports
                </DialogDescription>
              </DialogHeader>
              <WalletContent {...walletContentProps} />
            </>
          )}
        </DialogContent>
      </Dialog>
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
