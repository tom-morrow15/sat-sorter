import { useState, useRef } from 'react';
import { formatSats, usdToSats } from '@/hooks/useBitcoinPrice';
import {
  Upload,
  Wallet,
  FileSpreadsheet,
  Shield,
  CheckCircle,
  ChevronRight,
  Zap,
  RefreshCw,
  Clock,
  Link2,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { useNWC } from '@/hooks/useNWCContext';
import { useNWCSync } from '@/hooks/useNWCSync';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { categorizeMerchant } from '@/lib/merchantUtils';

interface DataSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  isIncome: boolean;
}

// Privacy banner component
function PrivacyBanner() {
  return (
    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
      <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-green-900 dark:text-green-100">
          Your data stays private
        </p>
        <p className="text-green-700 dark:text-green-300 text-xs mt-1">
          All connections and transactions are stored locally in your browser.
          No one else can see your financial data — not even us.
        </p>
      </div>
    </div>
  );
}

// Data source card component
function DataSourceCard({
  icon: Icon,
  title,
  description,
  status,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  status?: 'connected' | 'available' | 'coming-soon';
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || status === 'coming-soon'}
      className={`
        w-full flex items-center gap-4 p-4 border rounded-lg text-left transition-all
        ${status === 'connected'
          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
          : 'hover:border-primary hover:bg-muted/50'
        }
        ${disabled || status === 'coming-soon' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className={`
        h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0
        ${status === 'connected' ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}
      `}>
        <Icon className={`h-5 w-5 ${status === 'connected' ? 'text-green-600' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{title}</p>
          {status === 'connected' && (
            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {status === 'coming-soon' && (
            <Badge variant="secondary" className="text-xs">
              Coming Soon
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

// NWC Connection Panel
function NWCPanel({ onBack }: { onBack: () => void }) {
  const [connectionUri, setConnectionUri] = useState('');
  const [alias, setAlias] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const { connections, addConnection, removeConnection } = useNWC();
  const {
    isSyncing,
    autoSyncEnabled,
    lastSyncTimestamp,
    syncTransactions,
    startAutoSync,
    stopAutoSync,
  } = useNWCSync();

  const handleConnect = async () => {
    if (!connectionUri.trim()) {
      toast({
        title: 'Connection URI required',
        description: 'Please enter a valid NWC connection string.',
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
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const formatLastSync = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp * 1000;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        ← Back to sources
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
          <Zap className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold">Nostr Wallet Connect</h3>
          <p className="text-sm text-muted-foreground">Connect any NWC-compatible wallet</p>
        </div>
      </div>

      <PrivacyBanner />

      {/* Connected Wallets */}
      {connections.length > 0 && (
        <div className="space-y-3">
          <Label>Connected Wallets</Label>
          {connections.map((conn) => (
            <div key={conn.connectionString} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{conn.alias || 'Lightning Wallet'}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeConnection(conn.connectionString)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Sync Controls */}
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Last synced: {formatLastSync(lastSyncTimestamp)}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncTransactions(true)}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Auto-sync</p>
                <p className="text-xs text-muted-foreground">
                  Import new transactions every 5 minutes
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={() => autoSyncEnabled ? stopAutoSync() : startAutoSync()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add New Connection */}
      <div className="space-y-3 pt-3 border-t">
        <Label>{connections.length > 0 ? 'Add Another Wallet' : 'Connect Your Wallet'}</Label>

        <div className="space-y-3">
          <div>
            <Label htmlFor="nwc-alias" className="text-xs text-muted-foreground">Wallet Name (optional)</Label>
            <Input
              id="nwc-alias"
              placeholder="My Lightning Wallet"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="nwc-uri" className="text-xs text-muted-foreground">NWC Connection String</Label>
            <Textarea
              id="nwc-uri"
              placeholder="nostr+walletconnect://..."
              value={connectionUri}
              onChange={(e) => setConnectionUri(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            onClick={handleConnect}
            disabled={isConnecting || !connectionUri.trim()}
            className="w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Get your NWC connection string from wallets like Alby, Zeus, or Primal.
        </p>
      </div>
    </div>
  );
}

// CSV Import Panel
function CSVPanel({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [csvUnit, setCsvUnit] = useState<'usd' | 'sats'>('usd');
  const [previewRows, setPreviewRows] = useState<ParsedTransaction[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addTransaction, currentBudget } = useBudget();
  const { data: priceData } = useBitcoinPrice();

  const parseCSV = (text: string, unit: 'usd' | 'sats'): ParsedTransaction[] => {
    const lines = text.trim().split('\n');
    const transactions: ParsedTransaction[] = [];

    // Try to detect header
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('date') || firstLine.includes('amount') || firstLine.includes('description');
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV - handle quoted fields
      const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));

      if (parts.length < 3) continue;

      try {
        const date = parts[0];
        const description = parts[1];
        const amountStr = parts[2];

        const raw = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (!raw || raw === 0) continue;

        const isIncome = raw > 0;

        // Validate date
        if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
          const parsed = new Date(date);
          if (isNaN(parsed.getTime())) {
            console.warn(`Skipping invalid date: ${date}`);
            continue;
          }
        }

        // Convert to sats if the CSV was authored in USD
        let amount = Math.abs(raw);
        if (unit === 'usd' && priceData) {
          amount = usdToSats(amount, priceData.usdPerBtc);
        }

        if (amount <= 0) continue;

        transactions.push({
          date: date.includes('T') ? date : `${date}T12:00:00.000Z`,
          description,
          amount,
          isIncome,
        });
      } catch (error) {
        console.warn(`Skipping invalid line: ${line}`);
        continue;
      }
    }

    return transactions;
  };

  const handleFileSelectForPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    try {
      const text = await file.text();
      const parsed = parseCSV(text, csvUnit);
      setPreviewRows(parsed.slice(0, 5)); // show up to 5 preview rows
    } catch {
      setPreviewRows([]);
    }
  };

  const handleUnitChange = async (newUnit: 'usd' | 'sats') => {
    setCsvUnit(newUnit);
    if (selectedFile) {
      try {
        const text = await selectedFile.text();
        const parsed = parseCSV(text, newUnit);
        setPreviewRows(parsed.slice(0, 5));
      } catch {
        setPreviewRows([]);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text, csvUnit);

      if (parsed.length === 0) {
        toast({
          title: 'No transactions found',
          description: 'Could not parse any valid transactions from the CSV file.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const existingTransactions = currentBudget.transactions;
      let imported = 0;
      let skipped = 0;

      for (const transaction of parsed) {
        const isDuplicate = existingTransactions.some(
          (t) =>
            t.date.split('T')[0] === transaction.date.split('T')[0] &&
            t.amount === transaction.amount &&
            t.description === transaction.description
        );

        if (isDuplicate) {
          skipped++;
          continue;
        }

        const categoryHint = categorizeMerchant(transaction.description);

        addTransaction({
          amount: transaction.amount,
          description: transaction.description,
          date: transaction.date,
          isIncome: transaction.isIncome,
          source: 'manual',
          merchantName: transaction.description,
          categoryHint: categoryHint ?? undefined,
          bucketId: null,
          lineItemId: null,
        });

        imported++;
      }

      setImportedCount(imported);

      toast({
        title: 'Import successful!',
        description: `Imported ${imported} transaction${imported !== 1 ? 's' : ''}${
          skipped > 0 ? ` (${skipped} duplicates skipped)` : ''
        }`,
      });

      if (imported > 0) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Import failed',
        description: `Error reading file: ${errorMsg}`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setPreviewRows([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        ← Back to sources
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold">CSV Import</h3>
          <p className="text-sm text-muted-foreground">Import from any wallet or bank</p>
        </div>
      </div>

      <PrivacyBanner />

      {/* Success message */}
      {importedCount > 0 && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Successfully imported {importedCount} transaction{importedCount !== 1 ? 's' : ''}!
          </AlertDescription>
        </Alert>
      )}

      {/* Unit Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Amounts in CSV are:</Label>
        <div className="flex gap-2">
          <Button
            variant={csvUnit === 'usd' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleUnitChange('usd')}
            className="flex-1"
          >
            USD ($)
          </Button>
          <Button
            variant={csvUnit === 'sats' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleUnitChange('sats')}
            className="flex-1"
          >
            Sats (₿)
          </Button>
        </div>
      </div>

      {/* File Upload + Preview */}
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelectForPreview}
          disabled={isProcessing}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full"
          size="lg"
          variant="outline"
        >
          <Upload className="h-4 w-4 mr-2" />
          Select CSV File
        </Button>

        {/* Preview */}
        {previewRows.length > 0 && (
          <div className="rounded-lg border p-3 bg-muted/50 text-xs space-y-2">
            <p className="font-medium text-muted-foreground">Preview (first {previewRows.length} rows)</p>
            {previewRows.map((row, idx) => (
              <div key={idx} className="font-mono flex justify-between">
                <span className="truncate pr-2">{row.description}</span>
                <span className={row.isIncome ? 'text-green-600' : 'text-destructive'}>
                  {row.isIncome ? '+' : ''}{formatSats(row.amount)} sats
                </span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1">
              Detected unit: <strong>{csvUnit.toUpperCase()}</strong>. Import will convert to sats using the live BTC price.
            </p>
          </div>
        )}

        {/* Import button — only visible after a file is chosen */}
        {selectedFile && previewRows.length > 0 && (
          <Button onClick={handleImport} disabled={isProcessing} className="w-full" size="lg">
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${previewRows.length > 0 ? 'CSV' : ''}`
            )}
          </Button>
        )}
      </div>

      {/* Format Help (example matches chosen unit) */}
      <div className="space-y-3 p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">CSV Format</p>
        <p className="text-xs text-muted-foreground">
          Columns: <strong>date, description, amount</strong>
        </p>
        <div className="font-mono text-xs bg-background p-2 rounded border">
          date,description,amount<br />
          {csvUnit === 'usd' ? (
            <>2024-01-15,Coffee Shop,-4.50<br />2024-01-14,Paycheck,5000</>
          ) : (
            <>2024-01-15,Coffee Shop,-450<br />2024-01-14,Paycheck,5000000</>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {csvUnit === 'usd'
            ? 'Negative = expense, positive = income. Amounts in USD.'
            : 'Negative = expense, positive = income. Amounts in sats.'}
        </p>
      </div>

      {/* Supported Exports */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Works with exports from:</p>
        <div className="flex flex-wrap gap-2">
          {['Strike', 'Cash App', 'River', 'Swan', 'Fold', 'Any Bank'].map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main dialog content
function DataSourcesContent({ onClose }: { onClose: () => void }) {
  const [activePanel, setActivePanel] = useState<'list' | 'nwc' | 'csv' | 'alby'>('list');
  const { connections } = useNWC();

  const hasNWC = connections.length > 0;

  if (activePanel === 'nwc') {
    return <NWCPanel onBack={() => setActivePanel('list')} />;
  }

  if (activePanel === 'csv') {
    return <CSVPanel onBack={() => setActivePanel('list')} onSuccess={onClose} />;
  }

  return (
    <div className="space-y-4">
      <PrivacyBanner />

      <div className="space-y-2">
        <p className="text-sm font-medium">Connect a Data Source</p>
        <p className="text-xs text-muted-foreground">
          Import your transactions automatically or manually
        </p>
      </div>

      <div className="space-y-3">
        {/* NWC - Lightning Wallets */}
        <DataSourceCard
          icon={Zap}
          title="Lightning Wallet (NWC)"
          description="Alby, Zeus, Primal, and other NWC wallets"
          status={hasNWC ? 'connected' : 'available'}
          onClick={() => setActivePanel('nwc')}
        />

        {/* CSV Import */}
        <DataSourceCard
          icon={FileSpreadsheet}
          title="CSV Import"
          description="Import from Strike, Cash App, or any bank"
          status="available"
          onClick={() => setActivePanel('csv')}
        />

        {/* Alby OAuth - Coming Soon */}
        <DataSourceCard
          icon={Link2}
          title="Alby Account"
          description="Direct connection to your Alby account"
          status="coming-soon"
        />

        {/* On-chain - Coming Soon */}
        <DataSourceCard
          icon={Wallet}
          title="On-chain Wallet"
          description="Watch-only connection via xPub"
          status="coming-soon"
        />
      </div>

      <Separator />

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          More integrations coming soon! Have a request?{' '}
          <a href="https://primal.net/p/npub1acu2u940prfg429x4axskgu2e5auvjx4y6ejme8y8t4ns4tz82pqs5l3q0"
             target="_blank"
             rel="noopener noreferrer"
             className="text-primary hover:underline">
            Let us know
          </a>
        </p>
      </div>
    </div>
  );
}

export function DataSourcesDialog({ open, onOpenChange }: DataSourcesDialogProps) {
  const isMobile = useIsMobile();

  const handleClose = () => {
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="text-center relative flex-shrink-0">
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
            <DrawerTitle className="flex items-center justify-center gap-2 pt-2">
              <Link2 className="h-5 w-5" />
              Data Sources
            </DrawerTitle>
            <DrawerDescription>
              Connect your wallets and import transactions
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
            <DataSourcesContent onClose={handleClose} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Data Sources
          </DialogTitle>
          <DialogDescription>
            Connect your wallets and import transactions
          </DialogDescription>
        </DialogHeader>
        <DataSourcesContent onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
