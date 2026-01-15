import { useState, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Zap,
  Link2,
  Wallet,
  Split,
} from 'lucide-react';
import { TransactionSearchFilter } from './TransactionSearchFilter';
import { DataSourcesDialog } from './DataSourcesDialog';
import { TransactionSourceBadge } from './TransactionSourceBadge';
import { TransactionDetailsDialog } from './TransactionDetailsDialog';
import { SplitTransactionDialog } from './SplitTransactionDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { getUnassignedTransactions } from '@/lib/budgetTypes';
import type { Transaction, Bucket, SplitAllocation } from '@/lib/budgetTypes';
import type { NWCConnection } from '@/hooks/useNWC';
import { cn } from '@/lib/utils';

interface TransactionsPanelProps {
  transactions: Transaction[];
  buckets: Bucket[];
  currency: 'sats' | 'usd';
  walletConnections?: NWCConnection[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onAssignTransaction: (transactionId: string, bucketId: string, lineItemId: string) => void;
  onUpdateTransaction: (transactionId: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onSplitTransaction?: (transactionId: string, splits: SplitAllocation[]) => void;
  onOpenWallet?: () => void;
}

export function TransactionsPanel({
  transactions,
  buckets,
  currency,
  walletConnections = [],
  onAddTransaction,
  onAssignTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onSplitTransaction,
  onOpenWallet,
}: TransactionsPanelProps) {
  const { data: priceData } = useBitcoinPrice();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isCategorizedOpen, setIsCategorizedOpen] = useState(false);

  // Add transaction form state
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsIncome, setNewIsIncome] = useState(false);

  // Assign form state
  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('');

  // Edit transaction form state
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBucketId, setEditBucketId] = useState<string>('');
  const [editLineItemId, setEditLineItemId] = useState<string>('');

  // Filter out split parent transactions from unassigned (they're replaced by their children)
  const unassigned = getUnassignedTransactions(transactions).filter(t => !t.isSplitParent);
  // For assigned, show child splits and non-split transactions, but not split parents
  const assigned = transactions.filter(t => t.lineItemId !== null && !t.isSplitParent);

  // Use filtered transactions if filter is active, otherwise show all
  const displayedTransactions = useMemo(() => {
    return filteredTransactions.length > 0 ? filteredTransactions : [...unassigned, ...assigned];
  }, [filteredTransactions, unassigned, assigned]);

  // Format amount - use stored USD amount if available to avoid drift
  const formatTransactionAmount = (transaction: Transaction) => {
    if (currency === 'usd') {
      // Use stored USD amount if available
      if (transaction.usdAmount !== undefined) {
        return formatUsd(transaction.usdAmount);
      }
      if (priceData) {
        return formatUsd(satsToUsd(transaction.amount, priceData.usdPerBtc));
      }
      return '$0.00';
    }
    return `${formatSats(transaction.amount)} sats`;
  };

  const formatAmount = (sats: number) => {
    if (currency === 'usd' && priceData) {
      return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
    }
    return `${formatSats(sats)} sats`;
  };

  // Parse input amount - returns both sats, USD, and exchange rate
  const parseInputAmount = (value: string): { sats: number; usdAmount?: number; usdPerBtcAtEntry?: number } => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      return {
        sats: Math.round(usdToSats(num, priceData.usdPerBtc)),
        usdAmount: num,
        usdPerBtcAtEntry: priceData.usdPerBtc, // Store exchange rate at entry time
      };
    }
    return {
      sats: Math.round(num),
      usdAmount: undefined,
      usdPerBtcAtEntry: undefined,
    };
  };

  const handleAddTransaction = () => {
    const { sats, usdAmount, usdPerBtcAtEntry } = parseInputAmount(newAmount);
    if (sats > 0 && newDescription.trim()) {
      onAddTransaction({
        amount: sats,
        usdAmount,
        usdPerBtcAtEntry,
        description: newDescription.trim(),
        date: new Date().toISOString(),
        lineItemId: null,
        bucketId: null,
        isIncome: newIsIncome,
      });
      setNewAmount('');
      setNewDescription('');
      setNewIsIncome(false);
      setShowAddDialog(false);
    }
  };

  const handleOpenAssign = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setSelectedBucketId('');
    setSelectedLineItemId('');
    setShowAssignDialog(true);
  };

  const handleAssign = () => {
    if (selectedTransaction && selectedBucketId && selectedLineItemId) {
      onAssignTransaction(selectedTransaction.id, selectedBucketId, selectedLineItemId);
      setShowAssignDialog(false);
      setSelectedTransaction(null);
    }
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditDescription(transaction.description);
    setEditAmount(
      currency === 'usd' && transaction.usdAmount !== undefined
        ? transaction.usdAmount.toFixed(2)
        : transaction.amount.toString()
    );
    setEditBucketId(transaction.bucketId || '__UNASSIGNED__');
    setEditLineItemId(transaction.lineItemId || '__NONE__');
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTransaction) return;

    const { sats, usdAmount, usdPerBtcAtEntry } = parseInputAmount(editAmount);
    if (sats > 0) {
      onUpdateTransaction(selectedTransaction.id, {
        amount: sats,
        usdAmount,
        usdPerBtcAtEntry,
        description: editDescription.trim() || selectedTransaction.description,
        bucketId: editBucketId === '__UNASSIGNED__' ? null : editBucketId || null,
        lineItemId: editLineItemId === '__NONE__' ? null : editLineItemId || null,
      });
      setShowEditDialog(false);
      setSelectedTransaction(null);
    }
  };

  const selectedBucket = buckets.find(b => b.id === selectedBucketId);
  const editBucket = buckets.find(b => b.id === editBucketId);
  const expenseBuckets = buckets.filter(b => !b.isIncome);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Transactions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unassigned.length} unassigned
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowDataSources(true)}>
                <Link2 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Search and Filter */}
          <div className="mb-4 pb-4 border-b">
            <TransactionSearchFilter
              transactions={transactions}
              buckets={buckets}
              onFilter={setFilteredTransactions}
            />
          </div>

          {/* Unassigned transactions */}
          {unassigned.length > 0 && !filteredTransactions.length && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Needs Categorizing</span>
              </div>
              <div className="space-y-2">
                {unassigned.map((transaction) => (
                  <button
                    key={transaction.id}
                    onClick={() => handleOpenAssign(transaction)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left group"
                  >
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        transaction.isIncome
                          ? 'bg-success/20 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {transaction.isIncome ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {transaction.source === 'nwc' && (
                          <TransactionSourceBadge
                            transaction={transaction}
                            walletConnections={walletConnections}
                            className="text-xs px-1.5 py-0"
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          transaction.isIncome ? 'text-success' : ''
                        )}
                      >
                        {transaction.isIncome ? '+' : '-'}
                        {formatTransactionAmount(transaction)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assigned transactions - Collapsible */}
          {assigned.length > 0 && !filteredTransactions.length && (
            <Collapsible open={isCategorizedOpen} onOpenChange={setIsCategorizedOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between gap-2 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Categorized</span>
                    <span className="text-xs text-muted-foreground">
                      ({assigned.length})
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      isCategorizedOpen && "rotate-180"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 -mx-1">
                  <ScrollArea className="h-[280px] w-full touch-auto">
                    <div className="space-y-1 px-1 pb-2">
                      {assigned.map((transaction) => {
                        const bucket = buckets.find(b => b.id === transaction.bucketId);
                        const lineItem = bucket?.lineItems.find(
                          l => l.id === transaction.lineItemId
                        );
                        return (
                          <button
                            key={transaction.id}
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setShowDetailsDialog(true);
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group transition-colors text-left"
                          >
                            <div
                              className={cn(
                                'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
                                transaction.isIncome
                                  ? 'bg-success/20 text-success'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {transaction.isIncome ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {transaction.description}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0"
                                  style={{
                                    backgroundColor: bucket
                                      ? `${bucket.color}20`
                                      : undefined,
                                    color: bucket?.color,
                                  }}
                                >
                                  {lineItem?.name || 'Unknown'}
                                </Badge>
                                {transaction.parentTransactionId && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-1.5 py-0 gap-0.5"
                                  >
                                    <Split className="h-2.5 w-2.5" />
                                    Split
                                  </Badge>
                                )}
                                {transaction.source === 'nwc' && (
                                  <TransactionSourceBadge
                                    transaction={transaction}
                                    walletConnections={walletConnections}
                                    className="text-xs px-1.5 py-0"
                                  />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(transaction.date)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium tabular-nums',
                                  transaction.isIncome ? 'text-success' : ''
                                )}
                              >
                                {transaction.isIncome ? '+' : '-'}
                                {formatTransactionAmount(transaction)}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTransaction(transaction.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Filtered transactions results */}
          {filteredTransactions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  Search Results ({filteredTransactions.length})
                </span>
              </div>
              <ScrollArea className="max-h-[300px] w-full">
                <div className="space-y-1">
                  {filteredTransactions.map((transaction) => {
                    const bucket = buckets.find(b => b.id === transaction.bucketId);
                    const lineItem = bucket?.lineItems.find(
                      l => l.id === transaction.lineItemId
                    );

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-lg group transition-colors cursor-pointer"
                        onClick={() => handleOpenAssign(transaction)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                              transaction.isIncome
                                ? 'bg-success/20 text-success'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {transaction.isIncome ? (
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {transaction.description}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {bucket && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0"
                                  style={{
                                    backgroundColor: `${bucket.color}20`,
                                    color: bucket.color,
                                  }}
                                >
                                  {lineItem?.name || 'Unknown'}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDate(transaction.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-medium tabular-nums',
                              transaction.isIncome ? 'text-success' : ''
                            )}
                          >
                            {transaction.isIncome ? '+' : '-'}
                            {formatTransactionAmount(transaction)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTransaction(transaction.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty state */}
          {transactions.length === 0 && !filteredTransactions.length && (
            <div className="text-center py-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <Plus className="h-7 w-7 text-blue-500" />
              </div>
              <h4 className="text-sm font-semibold mb-1.5">
                No Transactions Yet
              </h4>
              <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
                Add your Lightning and on-chain transactions to track spending against your budget.
              </p>
              <div className="flex flex-col gap-2 px-4">
                <Button size="sm" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowDataSources(true)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Import from CSV
                </Button>
              </div>
              <div className="mt-5 p-3 bg-muted/50 rounded-lg mx-4">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Export transactions from your wallet app and import them here via CSV for bulk entry.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Record a transaction to track your spending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              <Button
                variant={!newIsIncome ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setNewIsIncome(false)}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Expense
              </Button>
              <Button
                variant={newIsIncome ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setNewIsIncome(true)}
              >
                <ArrowDownLeft className="h-4 w-4 mr-2" />
                Income
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="e.g., Coffee shop, Grocery store..."
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
                min="0"
                step={currency === 'usd' ? '0.01' : '1'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTransaction}
              disabled={!newAmount || !newDescription.trim()}
            >
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Transaction Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Categorize Transaction</DialogTitle>
            <DialogDescription>
              Assign this transaction to a budget category.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="py-4 space-y-4">
              {/* Transaction summary */}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{selectedTransaction.description}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTransactionAmount(selectedTransaction)} •{' '}
                  {formatDate(selectedTransaction.date)}
                </p>
              </div>

              {/* Category selection */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedBucketId} onValueChange={(value) => {
                  setSelectedBucketId(value);
                  setSelectedLineItemId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseBuckets.map((bucket) => (
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
                  <Label>Item</Label>
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
            </div>
          )}

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            {/* Action buttons row */}
            <div className="flex gap-2 justify-center sm:justify-start order-2 sm:order-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (selectedTransaction) {
                    onDeleteTransaction(selectedTransaction.id);
                    setShowAssignDialog(false);
                    setSelectedTransaction(null);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              {onSplitTransaction && selectedTransaction && !selectedTransaction.isSplitParent && !selectedTransaction.parentTransactionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAssignDialog(false);
                    setShowSplitDialog(true);
                  }}
                >
                  <Split className="h-4 w-4 mr-1" />
                  Split
                </Button>
              )}
            </div>
            {/* Primary buttons row */}
            <div className="flex gap-2 justify-end order-1 sm:order-2">
              <Button variant="outline" size="sm" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={!selectedBucketId || !selectedLineItemId}
              >
                Assign
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details and categorization.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="e.g., Coffee shop, Grocery store..."
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount ({currency === 'usd' ? 'USD' : 'sats'})</Label>
                <Input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step={currency === 'usd' ? '0.01' : '1'}
                />
              </div>

              {/* Category selection */}
              <div className="space-y-2">
                <Label>Category (Optional)</Label>
                <Select value={editBucketId} onValueChange={(value) => {
                  setEditBucketId(value);
                  setEditLineItemId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNASSIGNED__">Unassigned</SelectItem>
                    {expenseBuckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Line item selection */}
              {editBucket && editBucket.lineItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Subcategory (Optional)</Label>
                  <Select value={editLineItemId} onValueChange={setEditLineItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subcategory..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__NONE__">None</SelectItem>
                      {editBucket.lineItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editAmount || parseFloat(editAmount) === 0}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Sources Dialog */}
      <DataSourcesDialog
        open={showDataSources}
        onOpenChange={setShowDataSources}
      />

      {/* Transaction Details Dialog */}
      {selectedTransaction && (
        <TransactionDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          transaction={selectedTransaction}
          buckets={buckets}
          bucketName={buckets.find(b => b.id === selectedTransaction.bucketId)?.name}
          lineItemName={buckets
            .find(b => b.id === selectedTransaction.bucketId)
            ?.lineItems.find(l => l.id === selectedTransaction.lineItemId)?.name}
          onUpdateCategory={onAssignTransaction}
        />
      )}

      {/* Split Transaction Dialog */}
      {onSplitTransaction && (
        <SplitTransactionDialog
          open={showSplitDialog}
          onOpenChange={setShowSplitDialog}
          transaction={selectedTransaction}
          buckets={buckets}
          currency={currency}
          onSplit={onSplitTransaction}
        />
      )}
    </>
  );
}
