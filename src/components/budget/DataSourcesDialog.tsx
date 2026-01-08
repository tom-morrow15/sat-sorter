import { useState, useRef } from 'react';
import { FileSpreadsheet, Upload, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
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

export function DataSourcesDialog({ open, onOpenChange }: DataSourcesDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addTransaction, currentBudget } = useBudget();

  const parseCSV = (text: string): ParsedTransaction[] => {
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

        // Parse amount (could be negative for expenses)
        const amount = Math.abs(parseInt(amountStr.replace(/[^0-9.-]/g, '')));
        const isIncome = !amountStr.includes('-') && parseFloat(amountStr.replace(/[^0-9.-]/g, '')) > 0;

        // Validate date
        if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
          const parsed = new Date(date);
          if (isNaN(parsed.getTime())) {
            continue;
          }
        }

        if (amount <= 0) continue;

        transactions.push({
          date: date.includes('T') ? date : `${date}T12:00:00.000Z`,
          description,
          amount,
          isIncome,
        });
      } catch {
        continue;
      }
    }

    return transactions;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setImportedCount(0);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setError('No valid transactions found in the CSV file. Please check the format.');
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
          categoryHint,
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
        setTimeout(() => onOpenChange(false), 1500);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Error reading file: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = () => {
    setError(null);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[450px] rounded-lg sm:rounded-lg p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="pb-4 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Transactions
            </DialogTitle>
            <DialogDescription>
              Import transactions from a CSV file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Privacy Banner */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-green-900 dark:text-green-100">
                  Your data stays private
                </p>
                <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                  Files are processed locally in your browser. Nothing is uploaded to any server.
                </p>
              </div>
            </div>

            {/* Success State */}
            {importedCount > 0 && (
              <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Successfully imported {importedCount} transaction{importedCount !== 1 ? 's' : ''}!
                </AlertDescription>
              </Alert>
            )}

            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* File Upload Area */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {isProcessing ? 'Processing...' : 'Click to upload CSV'}
              </p>
              <p className="text-xs text-muted-foreground">
                or drag and drop
              </p>
            </div>

            {/* Format Instructions */}
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium">Expected CSV format:</p>
              <div className="bg-muted p-2 rounded font-mono text-[10px]">
                date,description,amount<br />
                2026-01-15,Coffee Shop,-500<br />
                2026-01-14,Salary,1500000
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Date: YYYY-MM-DD format</li>
                <li>Amount: in sats (negative = expense)</li>
                <li>Header row is optional</li>
              </ul>
            </div>

            {/* Actions */}
            {(error || importedCount > 0) && (
              <Button variant="outline" onClick={handleReset} className="w-full">
                Import Another File
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
