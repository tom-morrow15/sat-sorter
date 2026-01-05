import { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StrikeAPIDebugger } from '@/components/budget/StrikeAPIDebugger';
import { useToast } from '@/hooks/useToast';
import { useBudget } from '@/hooks/useBudget';
import { categorizeMerchant } from '@/lib/strikeUtils';

interface ImportTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  isIncome: boolean;
}

export function ImportTransactionsDialog({
  open,
  onOpenChange,
}: ImportTransactionsDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addTransaction, currentBudget } = useBudget();

  const parseCSV = (text: string): ParsedTransaction[] => {
    const lines = text.trim().split('\n');
    const transactions: ParsedTransaction[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
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
        const amount = Math.abs(parseInt(amountStr));
        const isIncome = !amountStr.includes('-');

        // Validate date is ISO format
        if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
          console.warn(`Skipping invalid date: ${date}`);
          continue;
        }

        transactions.push({
          date,
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        toast({
          title: 'No transactions found',
          description: 'Could not parse any valid transactions from the CSV file.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Check for duplicates
      const existingTransactions = currentBudget.transactions;
      let imported = 0;
      let skipped = 0;

      for (const transaction of parsed) {
        // Check for duplicate
        const isDuplicate = existingTransactions.some(
          (t) =>
            t.date === transaction.date &&
            t.amount === transaction.amount &&
            t.description === transaction.description
        );

        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Categorize
        const categoryHint = categorizeMerchant(transaction.description);

        // Add transaction
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

      // Close dialog after successful import
      setTimeout(() => {
        onOpenChange(false);
        setImportedCount(0);
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Import failed',
        description: `Error reading file: ${errorMsg}`,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Transactions
          </DialogTitle>
          <DialogDescription>
            Import from CSV file or connect Strike API directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="csv" className="py-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv">CSV Import</TabsTrigger>
            <TabsTrigger value="strike">Strike API</TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-4">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format Required:</strong> date, description, amount
              <br />
              Example: 2024-01-15,Starbucks,-5.99
            </AlertDescription>
          </Alert>

          {/* Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">How to export from Strike:</h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Open your Strike account</li>
              <li>Go to Transactions or History</li>
              <li>Look for "Export" or "Download" button</li>
              <li>Choose CSV format</li>
              <li>Import the file here</li>
            </ol>
          </div>

          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select CSV File
                </>
              )}
            </Button>
          </div>

          {/* Success Message */}
          {importedCount > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Successfully imported {importedCount} transaction{importedCount !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your transactions are ready to be assigned to budget categories.
                </p>
              </div>
            </div>
          )}

            {/* Help Text */}
            <div className="text-xs text-muted-foreground space-y-2 bg-muted p-3 rounded-lg">
              <p>
                <strong>Features:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Auto-detects merchants (Starbucks, Uber, Amazon, etc.)</li>
                <li>Auto-categorizes into your budget categories</li>
                <li>Prevents duplicate imports</li>
                <li>Works with any CSV export (Strike, PayPal, banks, etc.)</li>
                <li>You can manually adjust categories after import</li>
              </ul>

              <p className="pt-2 border-t">
                <strong>CSV Format:</strong> Each line should have: date (YYYY-MM-DD), description,
                amount
              </p>
            </div>
          </TabsContent>

          <TabsContent value="strike" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Help us find the correct Strike API! If you have a Strike API key, the debugger
                below will test which endpoints work. Share your results so we can fix the integration
                for everyone.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Strike API Debugger</h3>
              <p className="text-sm text-muted-foreground">
                This tool tests 39 different endpoint combinations to find what works with your API key.
                It takes about 5-10 seconds and helps us improve Strike integration.
              </p>

              <StrikeAPIDebugger />

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Found working endpoints?</strong> Please share them! Go to the Debug API
                  button, run tests, and copy the results. Share in a message and we can fix the
                  integration for everyone.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
