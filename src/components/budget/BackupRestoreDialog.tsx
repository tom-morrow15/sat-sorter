import { useState, useRef, useMemo } from 'react';
import {
  Download,
  Upload,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  Smartphone,
  Laptop,
  Key,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createEncryptedSerializer } from '@/lib/secureStorage';
import { SAFE_DEFAULT_BUDGET_STATE } from '@/lib/budgetTypes';
import type { BudgetState } from '@/lib/budgetTypes';

interface BackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BackupRestoreDialog({ open, onOpenChange }: BackupRestoreDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const {
    remoteBudget,
    remoteTimestamp,
    isLoadingRemote,
    uploadBudget,
    downloadBudget,
    syncStatus,
    canSync,
  } = useBudgetSync();

  // Use the SAME encrypted serializer as BudgetContext so that
  // import/export goes through the encryption layer (not plaintext)
  const budgetSerializer = useMemo(() => createEncryptedSerializer<BudgetState>(), []);
  const [localBudget, setLocalBudget] = useLocalStorage<BudgetState>('sat-sorter-budget', SAFE_DEFAULT_BUDGET_STATE, budgetSerializer);

  // Export to JSON file
  const handleExport = () => {
    // SECURITY: Warn the user if the export contains a budget nsec
    const hasBudgetKey = !!(localBudget as any)?.budgetKeypair?.budgetNsec;

    const dataStr = JSON.stringify(localBudget, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `sat-sorter-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Backup exported',
      description: hasBudgetKey
        ? '⚠️ This file contains your budget private key. Store it securely — anyone with this file can see your shared budget data.'
        : 'Your budget data has been downloaded as a JSON file.',
    });
  };

  // Import from JSON file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BudgetState;

      // Basic validation
      if (!data.budgets || !Array.isArray(data.budgets)) {
        throw new Error('Invalid backup file format');
      }

      setLocalBudget(data);

      toast({
        title: 'Backup restored',
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

  // Sync to Nostr
  const handleUploadToNostr = async () => {
    const success = await uploadBudget(localBudget);
    if (success) {
      toast({
        title: 'Synced to Nostr',
        description: 'Your budget is now available on any device.',
      });
    } else {
      toast({
        title: 'Sync failed',
        description: syncStatus.error || 'Could not upload budget data.',
        variant: 'destructive',
      });
    }
  };

  // Download from Nostr
  const handleDownloadFromNostr = async () => {
    const data = await downloadBudget();
    if (data) {
      setLocalBudget(data);
      toast({
        title: 'Downloaded from Nostr',
        description: 'Your budget has been restored from the cloud.',
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Download failed',
        description: 'No backup found or could not decrypt data.',
        variant: 'destructive',
      });
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Backup & Sync
          </DialogTitle>
          <DialogDescription>
            Keep your budget data safe across devices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Privacy notice */}
          <Alert className="border-green-500/30 bg-green-50 dark:bg-green-950/30">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              All cloud data is encrypted with your Nostr keys. Only you can read it.
            </AlertDescription>
          </Alert>

          {/* Nostr Cloud Sync */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Nostr Cloud Sync
            </h3>
            
            {!user ? (
              <div className="p-4 border rounded-lg text-center">
                <CloudOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Log in with Nostr to sync your budget across devices
                </p>
              </div>
            ) : !canSync ? (
              <div className="p-4 border rounded-lg text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  Your signer doesn't support encryption. Try a different login method.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
           {/* Status */}
                 <div className="flex items-center justify-between p-3 border rounded-lg">
                   <div className="flex items-center gap-3">
                     <div className="flex gap-1">
                       <Laptop className="h-4 w-4 text-muted-foreground" />
                       <Smartphone className="h-4 w-4 text-muted-foreground" />
                     </div>
                     <div>
                       <p className="text-sm font-medium">Cloud Status</p>
                       <p className="text-xs text-muted-foreground">
                         {isLoadingRemote ? (
                           'Checking...'
                         ) : remoteBudget ? (
                           `Last synced: ${formatTimestamp(remoteTimestamp!)}`
                         ) : (
                           'No backup found'
                         )}
                       </p>
                     </div>
                   </div>
                   {remoteBudget && (
                     <Badge variant="secondary" className="text-green-600">
                       <CheckCircle className="h-3 w-3 mr-1" />
                       Available
                     </Badge>
                   )}
                 </div>

                {/* Sync buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleUploadToNostr}
                    disabled={syncStatus.isSyncing}
                  >
                    {syncStatus.isSyncing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload to Cloud
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadFromNostr}
                    disabled={syncStatus.isSyncing || !remoteBudget}
                  >
                    {syncStatus.isSyncing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </Button>
                </div>

                {syncStatus.error && (
                  <p className="text-xs text-destructive">{syncStatus.error}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Manual Backup */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" />
              Manual Backup
            </h3>
            <p className="text-sm text-muted-foreground">
              Export your data as a JSON file for safekeeping.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleExport}>
                {localBudget && (localBudget as any)?.budgetKeypair ? (
                  <Key className="h-4 w-4 mr-2 text-amber-500" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export File
              </Button>
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
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import File
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Tip: Export a backup before making major changes to your budget.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
