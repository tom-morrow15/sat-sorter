import { useState } from 'react';
import { Copy, Download, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import type { BudgetSnapshot } from '@/lib/budgetVersioning';
import { formatSyncTime } from '@/lib/budgetVersioning';

interface SyncHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localVersion: BudgetSnapshot | null;
  cloudVersion: BudgetSnapshot | null;
  onRestore?: (snapshot: BudgetSnapshot) => void;
  isRestoring?: boolean;
}

export function SyncHistoryDialog({
  open,
  onOpenChange,
  localVersion,
  cloudVersion,
  onRestore,
  isRestoring = false,
}: SyncHistoryDialogProps) {
  const { toast } = useToast();
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const versions: Array<{ snapshot: BudgetSnapshot; source: 'local' | 'cloud' }> = [];

  if (localVersion) {
    versions.push({ snapshot: localVersion, source: 'local' });
  }
  if (cloudVersion && cloudVersion.checksum !== localVersion?.checksum) {
    versions.push({ snapshot: cloudVersion, source: 'cloud' });
  }

  // Sort by version number descending
  versions.sort((a, b) => b.snapshot.version - a.snapshot.version);

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    toast({
      title: 'Checksum copied',
      description: 'Checksum copied to clipboard',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Sync History</DialogTitle>
          <DialogDescription>
            View and manage your budget versions. Current versions are shown below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] w-full rounded-lg border p-4">
          <div className="space-y-3">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No sync history yet.</p>
                <p className="text-sm">Click "Save" to create your first backup.</p>
              </div>
            ) : (
              versions.map((item) => (
                <div
                  key={`${item.source}-${item.snapshot.version}`}
                  className="border rounded-lg p-3 space-y-2"
                >
                  {/* Header */}
                  <button
                    onClick={() =>
                      setExpandedVersion(
                        expandedVersion === item.snapshot.version
                          ? null
                          : item.snapshot.version
                      )
                    }
                    className="w-full flex items-center justify-between hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            Version {item.snapshot.version}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {item.source === 'local' ? 'This Device' : 'Cloud'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatSyncTime(item.snapshot.createdAt)}
                        </p>
                      </div>
                    </div>
                    {expandedVersion === item.snapshot.version ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {/* Expanded Details */}
                  {expandedVersion === item.snapshot.version && (
                    <div className="border-t pt-3 space-y-3 text-sm">
                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="font-medium text-muted-foreground">Budgets</p>
                          <p className="text-sm">
                            {item.snapshot.budgets.length} month
                            {item.snapshot.budgets.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Transactions</p>
                          <p className="text-sm">
                            {item.snapshot.budgets.reduce(
                              (sum, b) => sum + (b.transactions?.length || 0),
                              0
                            )}{' '}
                            total
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Deletions</p>
                          <p className="text-sm">
                            {item.snapshot.deletions.length} item
                            {item.snapshot.deletions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">Size</p>
                          <p className="text-sm">
                            {(JSON.stringify(item.snapshot).length / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      {/* Checksum */}
                      <div className="space-y-1">
                        <p className="font-medium text-xs text-muted-foreground">
                          Integrity Checksum
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                            {item.snapshot.checksum.substring(0, 32)}...
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleCopyChecksum(item.snapshot.checksum)}
                            title="Copy full checksum"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Restore button */}
                      {onRestore && item.source === 'cloud' && (
                        <Button
                          onClick={() => {
                            onRestore(item.snapshot);
                            onOpenChange(false);
                          }}
                          disabled={isRestoring}
                          className="w-full"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Restore This Version
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-lg">
          <p>
            <strong>What is a checksum?</strong> It's a unique fingerprint of your budget data.
            Use it to verify integrity or detect corruption.
          </p>
          <p>
            <strong>Version History:</strong> Currently showing your local and most recent cloud
            versions. You can restore either one.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
