import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Shield,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { useBitcoinPrice, formatSats, satsToUsd, formatUsd } from '@/hooks/useBitcoinPrice';
import { useIsMobile } from '@/hooks/useIsMobile';
import { parseCSVTransactions, type ParsedCSVTransaction, type CSVParseResult } from '@/lib/csvImport';
import { categorizeMerchant } from '@/lib/merchantUtils';
import type { Transaction } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  existingTransactions: Transaction[];
  currency: 'sats' | 'usd';
}

export function CSVImportDialog({
  open,
  onOpenChange,
  onImport,
  existingTransactions,
  currency,
}: CSVImportDialogProps) {
  const { data: priceData } = useBitcoinPrice();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [csvUnit, setCsvUnit] = useState<'usd' | 'sats'>('usd');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setParseResult(null);
    setIsProcessing(false);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const processFile = useCallback(async (file: File, unit: 'usd' | 'sats') => {
    setSelectedFile(file);
    setIsProcessing(true);
    try {
      const text = await file.text();
      const result = parseCSVTransactions(text, unit, priceData?.usdPerBtc);
      setParseResult(result);

      if (result.transactions.length === 0) {
        toast({
          title: 'No transactions found',
          description: 'Could not parse any valid transactions from this CSV file.',
          variant: 'destructive',
        });
      } else {
        const skippedMsg = result.skippedRows > 0
          ? ` (${result.skippedRows} row${result.skippedRows !== 1 ? 's' : ''} skipped)`
          : '';
        toast({
          title: 'CSV parsed successfully',
          description: `Found ${result.transactions.length} transaction${result.transactions.length !== 1 ? 's' : ''}${skippedMsg}`,
        });
      }
    } catch {
      setParseResult(null);
      toast({
        title: 'Failed to read file',
        description: 'Could not read the CSV file. Please check the file and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [priceData, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, csvUnit);
  };

  const handleUnitChange = async (newUnit: 'usd' | 'sats') => {
    setCsvUnit(newUnit);
    if (selectedFile) {
      await processFile(selectedFile, newUnit);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file.',
        variant: 'destructive',
      });
      return;
    }
    await processFile(file, csvUnit);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) return;

    setIsProcessing(true);
    try {
      const existingTx = existingTransactions;
      const newTransactions: Omit<Transaction, 'id'>[] = [];
      let duplicates = 0;

      for (const tx of parseResult.transactions) {
        // Check for duplicates
        const isDuplicate = existingTx.some(
          (t) =>
            t.date.split('T')[0] === tx.date.split('T')[0] &&
            t.amount === tx.amount &&
            t.description === tx.description
        );

        if (isDuplicate) {
          duplicates++;
          continue;
        }

        const categoryHint = categorizeMerchant(tx.description);
        const usdAmount = currency === 'usd' && priceData
          ? satsToUsd(tx.amount, priceData.usdPerBtc)
          : undefined;

        newTransactions.push({
          amount: tx.amount,
          amountUsd: usdAmount,
          btcPriceAtEntry: priceData?.usdPerBtc,
          description: tx.description,
          date: tx.date,
          lineItemId: null,
          bucketId: null,
          isIncome: tx.isIncome,
          source: 'manual',
          merchantName: tx.description,
          categoryHint,
        });
      }

      if (newTransactions.length === 0) {
        toast({
          title: 'No new transactions to import',
          description: `All ${duplicates} transaction${duplicates !== 1 ? 's' : ''} were already in your budget.`,
        });
        return;
      }

      onImport(newTransactions);
      setImportedCount(newTransactions.length);

      toast({
        title: 'Import successful!',
        description: `Imported ${newTransactions.length} transaction${newTransactions.length !== 1 ? 's' : ''}${
          duplicates > 0 ? ` (${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped)` : ''
        }`,
      });

      // Close after a brief delay so the user sees the success state
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Import failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatAmount = (sats: number): string => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  const formatDate = (isoStr: string): string => {
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ─── Content ───
  const content = (
    <div className="space-y-5">
      {/* Privacy banner */}
      <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
        <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-green-900 dark:text-green-100">Your data stays private</p>
          <p className="text-green-700 dark:text-green-300 text-xs mt-1">
            All transactions are stored locally in your browser. No one else can see your financial data — not even us.
          </p>
        </div>
      </div>

      {/* Success message */}
      {importedCount > 0 && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Successfully imported {importedCount} transaction{importedCount !== 1 ? 's' : ''}! You can now organize them into budget categories.
          </AlertDescription>
        </Alert>
      )}

      {/* Unit selector */}
      {parseResult === null && (
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
      )}

      {/* File upload area */}
      {importedCount === 0 && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
          />

          {/* Drag & drop zone */}
          <button
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            disabled={isProcessing}
            className={cn(
              'w-full border-2 border-dashed rounded-xl p-8 text-center transition-all',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30',
              isProcessing && 'opacity-50 cursor-not-allowed',
              !isProcessing && 'cursor-pointer'
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                'h-14 w-14 rounded-lg flex items-center justify-center transition-colors',
                isDragging ? 'bg-primary/15' : 'bg-muted'
              )}>
                {isProcessing ? (
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                ) : selectedFile ? (
                  <FileText className="h-6 w-6 text-primary" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isProcessing ? 'Processing...' : 'Click to choose a different file'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">
                    {isDragging ? 'Drop your CSV here' : 'Click to upload or drag & drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">CSV files only</p>
                </div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Parse results — column detection info */}
      {parseResult && parseResult.transactions.length > 0 && importedCount === 0 && (
        <>
          {/* Detected columns */}
          {parseResult.detectedColumns.date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              <span>Detected: </span>
              <Badge variant="secondary" className="text-xs">{parseResult.detectedColumns.date}</Badge>
              <span>→</span>
              <Badge variant="secondary" className="text-xs">{parseResult.detectedColumns.description}</Badge>
              <span>→</span>
              <Badge variant="secondary" className="text-xs">{parseResult.detectedColumns.amount}</Badge>
            </div>
          )}

          {/* Skipped rows warning */}
          {parseResult.skippedRows > 0 && (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                {parseResult.skippedRows} row{parseResult.skippedRows !== 1 ? 's' : ''} skipped due to parsing errors.
                {parseResult.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs cursor-pointer">View details</summary>
                    <ul className="text-xs mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                      {parseResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {parseResult.errors.length > 10 && (
                        <li>...and {parseResult.errors.length - 10} more</li>
                      )}
                    </ul>
                  </details>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Preview ({parseResult.transactions.length} transaction{parseResult.transactions.length !== 1 ? 's' : ''})
              </p>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Different file
              </Button>
            </div>
            <ScrollArea className="h-[200px] rounded-lg border">
              <div className="divide-y">
                {parseResult.transactions.slice(0, 50).map((tx, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                    <div className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
                      tx.isIncome ? 'bg-green-100 dark:bg-green-900 text-green-600' : 'bg-muted text-muted-foreground'
                    )}>
                      {tx.isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                    <span className={cn(
                      'text-sm font-mono flex-shrink-0',
                      tx.isIncome ? 'text-green-600' : ''
                    )}>
                      {tx.isIncome ? '+' : '-'}{formatAmount(tx.amount)}
                    </span>
                  </div>
                ))}
                {parseResult.transactions.length > 50 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    ...and {parseResult.transactions.length - 50} more
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Import button */}
          <Button
            onClick={handleImport}
            disabled={isProcessing || parseResult.transactions.length === 0}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import {parseResult.transactions.length} Transaction{parseResult.transactions.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </>
      )}

      {/* Format help */}
      {parseResult === null && importedCount === 0 && (
        <div className="space-y-3 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Supported CSV Format</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your CSV should have at least 3 columns: <strong>date</strong>, <strong>description</strong>, and <strong>amount</strong>.
            We automatically detect column headers and date formats.
          </p>
          <div className="font-mono text-xs bg-background p-2.5 rounded border space-y-0.5">
            <div>date,description,amount</div>
            <div className="text-muted-foreground">
              {csvUnit === 'usd' ? (
                <>
                  <div>2024-01-15,Coffee Shop,-4.50</div>
                  <div>2024-01-14,Paycheck,5000.00</div>
                </>
              ) : (
                <>
                  <div>2024-01-15,Coffee Shop,-450</div>
                  <div>2024-01-14,Paycheck,5000000</div>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {csvUnit === 'usd'
              ? 'Negative amounts = expenses, positive = income. Amounts in USD are converted to sats using live BTC price.'
              : 'Negative amounts = expenses, positive = income. Amounts should be in sats.'}
          </p>

          <Separator className="my-2" />

          <div className="space-y-2">
            <p className="text-xs font-medium">Works with exports from:</p>
            <div className="flex flex-wrap gap-1.5">
              {['Strike', 'Cash App', 'River', 'Swan', 'Fold', 'Any Bank', 'Any Wallet'].map((name) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Mobile: Drawer ───
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="text-center relative flex-shrink-0">
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
            <DrawerTitle className="flex items-center justify-center gap-2 pt-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import CSV
            </DrawerTitle>
            <DrawerDescription>
              Import transactions from a bank statement or wallet export
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // ─── Desktop: Dialog ───
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 py-3 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import CSV
          </DialogTitle>
          <DialogDescription>
            Import transactions from a bank statement or wallet export
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {content}
        </div>
        {parseResult && parseResult.transactions.length > 0 && importedCount === 0 && (
          <DialogFooter className="px-5 py-3 border-t border-border/40 shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parseResult.transactions.length} Transaction${parseResult.transactions.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
