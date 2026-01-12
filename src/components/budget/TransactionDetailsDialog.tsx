import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, ArrowDownLeft, ArrowUpRight, Wallet, Zap, Link2, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Transaction } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  bucketName?: string;
  lineItemName?: string;
}

export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transaction,
  bucketName,
  lineItemName,
}: TransactionDetailsDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!transaction) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceIcon = () => {
    switch (transaction.source) {
      case 'nwc':
        return <Wallet className="h-5 w-5" />;
      case 'zap':
        return <Zap className="h-5 w-5" />;
      case 'strike':
        return <Link2 className="h-5 w-5" />;
      case 'manual':
        return <Plus className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getSourceLabel = () => {
    if (transaction.sourceWallet) {
      return `${transaction.sourceWallet}`;
    }
    switch (transaction.source) {
      case 'nwc':
        return 'Lightning Wallet';
      case 'zap':
        return 'Zap Payment';
      case 'strike':
        return 'Strike API';
      case 'manual':
        return 'Manual Entry';
      default:
        return 'Unknown Source';
    }
  };

  const getSourceColor = () => {
    switch (transaction.source) {
      case 'nwc':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'zap':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'strike':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'manual':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', transaction.isIncome ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
              {transaction.isIncome ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </div>
            {transaction.description}
          </DialogTitle>
          <DialogDescription>
            Transaction details and payment information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Transaction Info */}
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Amount</p>
                <p className="text-2xl font-bold">
                  {transaction.isIncome ? '+' : '-'}
                  {Math.round(transaction.amount).toLocaleString()} sats
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Date</p>
                <p className="text-sm font-medium">{formatDate(transaction.date)}</p>
              </div>
            </div>
          </Card>

          {/* Source Information */}
          <Card className={cn('p-4 border', getSourceColor())}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getSourceIcon()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide font-medium opacity-70">Source</p>
                <p className="font-medium">{getSourceLabel()}</p>
                {transaction.sourceWallet && (
                  <p className="text-sm opacity-75">{transaction.source === 'nwc' ? 'Lightning Wallet' : transaction.source}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Payment Details (for NWC transactions) */}
          {transaction.source === 'nwc' && (
            <Card className="p-4 bg-muted/30">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Payment Hash</p>
                  <div className="flex items-center gap-2 bg-background rounded p-2 font-mono text-xs break-all">
                    <span className="flex-1">{transaction.paymentHash?.slice(0, 16)}...{transaction.paymentHash?.slice(-8)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(transaction.paymentHash || '', 'paymentHash')}
                    >
                      {copiedField === 'paymentHash' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {transaction.preimage && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Preimage</p>
                    <div className="flex items-center gap-2 bg-background rounded p-2 font-mono text-xs break-all">
                      <span className="flex-1">{transaction.preimage.slice(0, 16)}...{transaction.preimage.slice(-8)}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(transaction.preimage || '', 'preimage')}
                      >
                        {copiedField === 'preimage' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Category Assignment */}
          {(bucketName || lineItemName) && (
            <Card className="p-4 bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Assigned To</p>
                <div className="flex items-center gap-2">
                  {bucketName && <Badge variant="secondary">{bucketName}</Badge>}
                  {lineItemName && <Badge variant="secondary" className="font-normal">{lineItemName}</Badge>}
                </div>
              </div>
            </Card>
          )}

          {/* Transaction Status */}
          <div className="pt-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">
                {transaction.isIncome ? 'Incoming payment' : 'Outgoing payment'} • Settled
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
