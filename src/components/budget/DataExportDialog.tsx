import { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { BudgetState, MonthlyBudget, Transaction } from '@/lib/budgetTypes';
import { formatMonth } from '@/lib/budgetTypes';

interface DataExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataExportDialog({ open, onOpenChange }: DataExportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // Access local budget state
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', {
    currentMonth: '',
    budgets: [],
    currency: 'sats',
  });

  // Calculate stats for display
  const totalMonths = localBudget.budgets.length;
  const totalTransactions = localBudget.budgets.reduce(
    (sum, b) => sum + b.transactions.length,
    0
  );
  const totalCategories = localBudget.budgets.reduce(
    (sum, b) => sum + b.buckets.filter(bucket => !bucket.isIncome).length,
    0
  );

  // Export to JSON file
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(localBudget, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    downloadFile(dataBlob, `sat-sorter-backup-${getDateString()}.json`);

    toast({
      title: 'Backup exported',
      description: 'Your budget data has been downloaded as a JSON file.',
    });
  };

  // Export to CSV file
  const handleExportCSV = () => {
    const csvContent = convertToCSV(localBudget);
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    downloadFile(dataBlob, `sat-sorter-transactions-${getDateString()}.csv`);

    toast({
      title: 'Transactions exported',
      description: 'Your transactions have been downloaded as a CSV file.',
    });
  };

  // Helper to trigger download
  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import from JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BudgetState;

      // Validate the data structure
      if (!data.budgets || !Array.isArray(data.budgets)) {
        throw new Error('Invalid backup file format: missing budgets array');
      }

      // Validate each budget
      for (const budget of data.budgets) {
        if (!budget.month || !budget.buckets || !budget.transactions) {
          throw new Error('Invalid budget structure in backup file');
        }
      }

      setLocalBudget(data);

      toast({
        title: 'Backup restored successfully!',
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

  // Copy JSON to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(localBudget, null, 2));
      toast({
        title: 'Copied to clipboard',
        description: 'Budget data has been copied to your clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard. Try the download option instead.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export & Backup Data
          </DialogTitle>
          <DialogDescription>
            Download your budget data for safekeeping or import a backup
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-6 py-4 pr-2">
            {/* Data summary */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="Months" value={totalMonths} icon={FileText} />
              <SummaryCard label="Transactions" value={totalTransactions} icon={FileSpreadsheet} />
              <SummaryCard label="Categories" value={totalCategories} icon={FileJson} />
            </div>

            <Separator />

            {/* Export options */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Export Your Data</h3>

              <Tabs defaultValue="json" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="json">JSON (Full Backup)</TabsTrigger>
                  <TabsTrigger value="csv">CSV (Transactions)</TabsTrigger>
                </TabsList>

                <TabsContent value="json" className="space-y-4 pt-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <FileJson className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Full Backup (JSON)</p>
                        <p className="text-xs text-muted-foreground">
                          Includes all budgets, categories, line items, and transactions.
                          Best for complete backup and restore.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleExportJSON} className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download JSON
                      </Button>
                      <Button variant="outline" onClick={handleCopyToClipboard}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="csv" className="space-y-4 pt-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Transactions (CSV)</p>
                        <p className="text-xs text-muted-foreground">
                          Export all transactions to a spreadsheet-compatible format.
                          Opens in Excel, Google Sheets, etc.
                        </p>
                      </div>
                    </div>

                    <Button onClick={handleExportCSV} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <Separator />

            {/* Import section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Restore from Backup</h3>

              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                  Importing a backup will <strong>replace</strong> all your current data.
                  Make sure to export first if you want to keep your current budget.
                </AlertDescription>
              </Alert>

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
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import JSON Backup
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Tips */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="text-sm font-medium">💡 Backup Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Export regularly to keep your data safe</li>
                <li>• Store backups in a secure location (cloud drive, USB)</li>
                <li>• For automatic sync across devices, use Nostr Relay Sync</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Helper components
function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="p-3 border rounded-lg text-center">
      <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Helper functions
function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function convertToCSV(budgetState: BudgetState): string {
  const headers = [
    'Date',
    'Description',
    'Amount (Sats)',
    'Type',
    'Category',
    'Line Item',
    'Month',
    'Source',
    'Merchant',
  ];

  const rows: string[][] = [];

  for (const budget of budgetState.budgets) {
    for (const transaction of budget.transactions) {
      // Find category and line item names
      let categoryName = '';
      let lineItemName = '';

      if (transaction.bucketId) {
        const bucket = budget.buckets.find(b => b.id === transaction.bucketId);
        if (bucket) {
          categoryName = bucket.name;
          if (transaction.lineItemId) {
            const lineItem = bucket.lineItems.find(l => l.id === transaction.lineItemId);
            lineItemName = lineItem?.name || '';
          }
        }
      }

      rows.push([
        transaction.date,
        escapeCSV(transaction.description),
        transaction.amount.toString(),
        transaction.isIncome ? 'Income' : 'Expense',
        escapeCSV(categoryName),
        escapeCSV(lineItemName),
        formatMonth(budget.month),
        transaction.source || 'manual',
        escapeCSV(transaction.merchantName || ''),
      ]);
    }
  }

  // Sort by date descending
  rows.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
