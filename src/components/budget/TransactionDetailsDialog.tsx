import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Zap,
  Link2,
  Plus,
  Pencil,
  X,
} from 'lucide-react';
import type { Transaction, Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  buckets?: Bucket[];
  bucketName?: string;
  lineItemName?: string;
  onUpdateCategory?: (transactionId: string, bucketId: string, lineItemId: string) => void;
}

export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transaction,
  buckets = [],
  bucketName,
  lineItemName,
  onUpdateCategory,
}: TransactionDetailsDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('');

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

  // Get buckets based on transaction type (income or expense)
  const relevantBuckets = buckets.filter(b => b.isIncome === transaction.isIncome);
  const selectedBucket = relevantBuckets.find(b => b.id === selectedBucketId);

  const handleStartEdit = () => {
    // Pre-select current category if exists
    setSelectedBucketId(transaction.bucketId || '');
    setSelectedLineItemId(transaction.lineItemId || '');
    setIsEditingCategory(true);
  };

  const handleCancelEdit = () => {
    setIsEditingCategory(false);
    setSelectedBucketId('');
    setSelectedLineItemId('');
  };

  const handleSaveCategory = () => {
    if (selectedBucketId && selectedLineItemId && onUpdateCategory) {
      onUpdateCategory(transaction.id, selectedBucketId, selectedLineItemId);
      setIsEditingCategory(false);
      // Update the dialog display - close it to show the updated list
      onOpenChange(false);
    }
  };

  const canEdit = !!onUpdateCategory && relevantBuckets.length > 0;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        // Reset edit state when closing
        setIsEditingCategory(false);
        setSelectedBucketId('');
        setSelectedLineItemId('');
      }
      onOpenChange(newOpen);
    }}>
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
          {transaction.source && (
            <Card className={cn('p-4 border', getSourceColor())}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getSourceIcon()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wide font-medium opacity-70">Wallet Source</p>
                  <p className="text-lg font-bold">{getSourceLabel()}</p>
                  {transaction.source === 'nwc' && (
                    <p className="text-xs opacity-75 mt-0.5">Lightning Wallet Connection</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Payment Details (for NWC transactions) */}
          {transaction.source === 'nwc' && transaction.paymentHash && (
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

          {/* Category Assignment - Editable */}
          <Card className="p-4 bg-muted/30">
            {isEditingCategory ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Change Category</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Category selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Category</Label>
                    <span className="text-xs text-muted-foreground">
                      {transaction.isIncome ? 'Income' : 'Expense'}
                    </span>
                  </div>
                  <Select
                    value={selectedBucketId}
                    onValueChange={(value) => {
                      setSelectedBucketId(value);
                      setSelectedLineItemId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {relevantBuckets.map((bucket) => (
                        <SelectItem key={bucket.id} value={bucket.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: bucket.color }}
                            />
                            {bucket.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Line item selection */}
                {selectedBucket && selectedBucket.lineItems.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Item</Label>
                    <Select
                      value={selectedLineItemId}
                      onValueChange={setSelectedLineItemId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedBucket.lineItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={handleSaveCategory}
                  disabled={!selectedBucketId || !selectedLineItemId}
                  className="w-full"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Category
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Assigned To</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Change
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {bucketName ? (
                    <>
                      <Badge variant="secondary">{bucketName}</Badge>
                      {lineItemName && (
                        <Badge variant="secondary" className="font-normal">{lineItemName}</Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not categorized</span>
                  )}
                </div>
              </div>
            )}
          </Card>

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
