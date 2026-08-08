import { useState, useMemo, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Zap,
  Link2,
  Scissors,
} from 'lucide-react';
import { TransactionSearchFilter } from './TransactionSearchFilter';
import { DataSourcesDialog } from './DataSourcesDialog';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import { SplitEditor } from './SplitEditor';
import { PartnerAttribution } from './PartnerAttribution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useBitcoinPrice, formatSats, satsToUsd, usdToSats, formatUsd } from '@/hooks/useBitcoinPrice';
import { getUnassignedTransactions, getTransactionUsdAmount, getTransactionSatAmount } from '@/lib/budgetTypes';
import type { Transaction, Bucket, TransactionSplit } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';
import { hasSplits, getSplitCount } from '@/lib/splitUtils';

interface TransactionsPanelProps {
  transactions: Transaction[];
  buckets: Bucket[];
  currency: 'sats' | 'usd';
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onAddTransactions?: (transactions: Omit<Transaction, 'id'>[]) => void;
  onAssignTransaction: (transactionId: string, bucketId: string, lineItemId: string) => void;
  onDeleteTransaction: (transactionId: string) => void;
  lineItemIdFilter?: string;
  paymentMethods?: string[];
  onAddPaymentMethod?: (method: string) => void;
}

export function TransactionsPanel({
  transactions,
  buckets,
  currency,
  onAddTransaction,
  onAddTransactions,
  onAssignTransaction,
  onDeleteTransaction,
  lineItemIdFilter,
  paymentMethods: passedPaymentMethods,
  onAddPaymentMethod,
}: TransactionsPanelProps) {
  const { data: priceData } = useBitcoinPrice();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSplitEditor, setShowSplitEditor] = useState(false);
  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Add transaction form state
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsIncome, setNewIsIncome] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [showAddNewMethod, setShowAddNewMethod] = useState(false);

  // Use paymentMethods from props (now single source of truth from useBudget)
  const paymentMethods = passedPaymentMethods || [];

  // Assign form state
  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedLineItemId, setSelectedLineItemId] = useState<string>('');

  // Clear search/filter results whenever the lineItemIdFilter changes (e.g., when user clicks Clear button)
  useEffect(() => {
    setFilteredTransactions([]);
  }, [lineItemIdFilter]);

  // Filter by lineItemId if provided — includes both legacy single-assignment
  // and split transactions that have a split targeting this line item.
  const transactionsByLineItem = useMemo(() => {
    if (!lineItemIdFilter) return transactions;
    return transactions.filter(t =>
      t.lineItemId === lineItemIdFilter ||
      (t.splits && t.splits.some(s => s.lineItemId === lineItemIdFilter))
    );
  }, [transactions, lineItemIdFilter]);

  const unassigned = getUnassignedTransactions(transactionsByLineItem);
  // Sort assigned transactions by date (newest first) — includes split transactions
  const assigned = transactionsByLineItem
    .filter(t => t.lineItemId !== null || (t.splits && t.splits.length > 0))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Use filtered transactions if filter is active, otherwise show all
  const displayedTransactions = useMemo(() => {
    return filteredTransactions.length > 0 ? filteredTransactions : [...unassigned, ...assigned];
  }, [filteredTransactions, unassigned, assigned]);

  const formatAmount = (sats: number, transaction?: Transaction) => {
    if (currency === 'usd') {
      if (transaction && priceData) {
        // Use source-of-truth USD amount
        const usdAmount = getTransactionUsdAmount(transaction, priceData.usdPerBtc);
        return formatUsd(usdAmount);
      }
      if (priceData) {
        return formatUsd(satsToUsd(sats, priceData.usdPerBtc));
      }
    }
    return `${formatSats(sats)} sats`;
  };

  const parseAmountToSats = (value: string): number => {
    const num = parseFloat(value) || 0;
    if (currency === 'usd' && priceData) {
      return usdToSats(num, priceData.usdPerBtc);
    }
    return Math.round(num);
  };

  const handleAddTransaction = () => {
    const amount = parseAmountToSats(newAmount);
    if (amount > 0 && newDescription.trim()) {
      const transaction: any = {
        amount,
        description: newDescription.trim(),
        date: new Date().toISOString(),
        lineItemId: null,
        bucketId: null,
        isIncome: newIsIncome,
        paymentMethod: newPaymentMethod && newPaymentMethod !== 'none' ? newPaymentMethod : undefined,
      };

      // When in USD mode, store the USD amount as source of truth
      if (currency === 'usd' && priceData) {
        const usdAmount = parseFloat(newAmount) || 0;
        transaction.amountUsd = usdAmount;
        transaction.btcPriceAtEntry = priceData.usdPerBtc;
      }

      onAddTransaction(transaction);
      setNewAmount('');
      setNewDescription('');
      setNewIsIncome(false);
      setNewPaymentMethod('');
      setShowAddDialog(false);
    }
  };

  // Open the split editor for a brand-new transaction being added
  const handleAddWithSplit = () => {
    const amount = parseAmountToSats(newAmount);
    if (amount <= 0 || !newDescription.trim()) return;

    const usdAmount = currency === 'usd' ? parseFloat(newAmount) || 0 : undefined;

    // Build a temporary transaction object to feed the split editor
    const tempTx: Transaction = {
      id: `temp-${Date.now()}`,
      amount,
      amountUsd: usdAmount,
      btcPriceAtEntry: currency === 'usd' && priceData ? priceData.usdPerBtc : undefined,
      description: newDescription.trim(),
      date: new Date().toISOString(),
      lineItemId: null,
      bucketId: null,
      isIncome: newIsIncome,
    };

    setSelectedTransaction(tempTx);
    setIsAddingSplit(true);
    setShowAddDialog(false);
    setShowSplitEditor(true);
  };

  // Save splits for a brand-new transaction (EveryDollar-style: delete original, create new ones)
  // Use the batch adder when available so all splits are written in a single local state update.
  // This prevents race conditions where only the last split survives.
  const handleSaveNewSplit = (splits: TransactionSplit[]) => {
    if (!selectedTransaction || !splits.length) return;

    const base = selectedTransaction;
    const pm = newPaymentMethod && newPaymentMethod !== 'none' ? newPaymentMethod : undefined;
    const newTxs: Omit<Transaction, 'id'>[] = splits.map(split => ({
      amount: split.amount,
      amountUsd: split.amountUsd,
      btcPriceAtEntry: base.btcPriceAtEntry,
      description: base.description,
      date: base.date,
      lineItemId: split.lineItemId,
      bucketId: split.bucketId,
      isIncome: base.isIncome,
      paymentMethod: pm,
    }));

    if (onAddTransactions) {
      onAddTransactions(newTxs);
    } else {
      // Fallback for older callers
      newTxs.forEach(t => onAddTransaction(t));
    }

    // Reset form & state
    setNewAmount('');
    setNewDescription('');
    setNewIsIncome(false);
    setShowSplitEditor(false);
    setSelectedTransaction(null);
    setIsAddingSplit(false);
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

  const handleOpenSplit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowSplitEditor(true);
  };

  const handleSaveSplit = (splits: TransactionSplit[]) => {
    if (selectedTransaction) {
      // EveryDollar-style split: Delete original, create new ones
      onDeleteTransaction(selectedTransaction.id);
      
      const pm = selectedTransaction.paymentMethod;
      splits.forEach(split => {
        const newTx: Omit<Transaction, 'id'> = {
          amount: split.amount,
          amountUsd: split.amountUsd,
          btcPriceAtEntry: selectedTransaction.btcPriceAtEntry,
          description: selectedTransaction.description,
          date: selectedTransaction.date,
          lineItemId: split.lineItemId,
          bucketId: split.bucketId,
          isIncome: selectedTransaction.isIncome,
          paymentMethod: pm,
        };
        onAddTransaction(newTx);
      });
      
      setShowSplitEditor(false);
      setSelectedTransaction(null);
    }
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmed = () => {
    if (transactionToDelete) {
      onDeleteTransaction(transactionToDelete.id);
      setShowDeleteConfirm(false);
      setTransactionToDelete(null);
    }
  };

  const selectedBucket = buckets.find(b => b.id === selectedBucketId);
  const expenseBuckets = buckets.filter(b => !b.isIncome);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <Card className="card-base border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Transactions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unassigned.length} unassigned
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setShowDataSources(true)} className="touch-target-sm">
                <Link2 className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)} className="touch-target-sm">
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Search and Filter */}
          <div className="mb-4 pb-3 border-b border-border/30">
            <TransactionSearchFilter
              transactions={transactionsByLineItem}
              buckets={buckets}
              onFilter={setFilteredTransactions}
              paymentMethods={paymentMethods}
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors text-left group touch-target-sm animate-list-item"
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
                         <p className="text-xs text-muted-foreground">
                           {formatDate(transaction.date)}
                           {transaction.paymentMethod && <span className="ml-1.5 text-muted-foreground/70">· {transaction.paymentMethod}</span>}
                         </p>
                       </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {transaction.partnerPubkey && <PartnerAttribution pubkey={transaction.partnerPubkey} />}
                            <span
                             className={cn(
                               'text-sm font-mono',
                               transaction.isIncome ? 'text-success' : ''
                             )}
                           >
                             {transaction.isIncome ? '+' : '-'}
                             {formatAmount(transaction.amount, transaction)}
                           </span>
                       <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                     </div>
                   </button>
                 ))}
               </div>
             </div>
           )}

           {/* Assigned transactions */}
           {assigned.length > 0 && !filteredTransactions.length && (
             <div>
               <div className="flex items-center gap-2 mb-2">
                 <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">Categorized ({assigned.length})</span>
              </div>
               <div className="w-full">
                 <div className="space-y-0.5">
                   {assigned.map((transaction) => {
                     const bucket = buckets.find(b => b.id === transaction.bucketId);
                     const lineItem = bucket?.lineItems.find(l => l.id === transaction.lineItemId);
                     return (
                       <div
                         key={transaction.id}
                         className="flex items-center gap-3 p-2.5 -mx-1 rounded-xl hover:bg-muted/30 group animate-list-item"
                       >
                        <div
                          className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center',
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
                              <span className="text-xs text-muted-foreground">
                                {formatDate(transaction.date)}
                              </span>
                              {transaction.paymentMethod && (
                                <span className="text-xs text-muted-foreground/70 hidden sm:inline">· {transaction.paymentMethod}</span>
                              )}
                              {transaction.partnerPubkey && <PartnerAttribution pubkey={transaction.partnerPubkey} />}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                'text-sm font-mono',
                                transaction.isIncome ? 'text-success' : ''
                              )}
                            >
                             {transaction.isIncome ? '+' : '-'}
                             {formatAmount(transaction.amount, transaction)}
                           </span>
                           <Button
                             size="icon"
                             variant="ghost"
                             className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                             onClick={() => handleDeleteClick(transaction)}
                           >
                             <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                           </Button>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Filtered transactions results */}
          {filteredTransactions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  Search Results ({filteredTransactions.length})
                </span>
              </div>
              <div className="w-full">
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                 {hasSplits(transaction) ? (
                                   <Badge
                                     variant="secondary"
                                     className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                                   >
                                     Split ({getSplitCount(transaction)})
                                   </Badge>
                                 ) : bucket ? (
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
                                 ) : null}
                                 <span className="text-xs text-muted-foreground">
                                   {formatDate(transaction.date)}
                                 </span>
                                 {transaction.paymentMethod && (
                                   <span className="text-xs text-muted-foreground/70 hidden sm:inline">· {transaction.paymentMethod}</span>
                                 )}
                                 {transaction.partnerPubkey && <PartnerAttribution pubkey={transaction.partnerPubkey} />}
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
                            {formatAmount(transaction.amount, transaction)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(transaction);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {transactions.length === 0 && !filteredTransactions.length && (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">No transactions yet</p>
              <p className="text-xs text-muted-foreground mb-4">Import from your wallet or add manually</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button size="sm" onClick={() => setShowDataSources(true)} className="touch-target-sm">
                  <Link2 className="h-4 w-4 mr-1" /> Connect Data Source
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="touch-target-sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Manually
                </Button>
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
               <Textarea
                 value={newDescription}
                 onChange={(e) => setNewDescription(e.target.value)}
                 placeholder="e.g., Coffee shop on Main St, Weekly groceries..."
                 rows={3}
                 className="resize-none"
                 autoFocus
               />
               <p className="text-xs text-muted-foreground">
                 Add details to help you remember this transaction.
               </p>
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

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label>Payment Method (optional)</Label>
              <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No payment method</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="ghost"
              onClick={handleAddWithSplit}
              disabled={!newAmount || !newDescription.trim()}
              className="gap-2"
            >
              <Scissors className="h-4 w-4" />
              Split
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
                   {formatAmount(selectedTransaction.amount, selectedTransaction)} •{' '}
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

           <DialogFooter>
             <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
               Cancel
             </Button>
             <Button
               variant="ghost"
               onClick={() => {
                 if (selectedTransaction) {
                   setShowAssignDialog(false);
                   handleOpenSplit(selectedTransaction);
                 }
               }}
               className="gap-2"
             >
               <Scissors className="h-4 w-4" />
               Split
             </Button>
             <Button
               onClick={handleAssign}
               disabled={!selectedBucketId || !selectedLineItemId}
             >
               Assign
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Data Sources Dialog */}
       <DataSourcesDialog
         open={showDataSources}
         onOpenChange={setShowDataSources}
       />

        {/* Deletion confirmation dialog */}
        <DeletionConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          itemType="transaction"
          itemName={transactionToDelete?.description || ''}
          onConfirm={handleDeleteConfirmed}
        />

        {/* Split Editor Dialog */}
        {selectedTransaction && (
          <SplitEditor
            open={showSplitEditor}
            onOpenChange={(open) => {
              setShowSplitEditor(open);
              if (!open) {
                setIsAddingSplit(false);
                setSelectedTransaction(null);
              }
            }}
            transaction={selectedTransaction}
            buckets={buckets.filter(b => b.isIncome === selectedTransaction.isIncome)}
            onSave={isAddingSplit ? handleSaveNewSplit : handleSaveSplit}
          />
        )}
      </>
    );
  }
