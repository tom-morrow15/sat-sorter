import { useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  BudgetState,
  MonthlyBudget,
  Bucket,
  LineItem,
  Transaction,
  SyncedNWCConnection,
  createDefaultBuckets,
  getCurrentMonth,
  generateId,
} from '@/lib/budgetTypes';

const DEFAULT_STATE: BudgetState = {
  currentMonth: getCurrentMonth(),
  budgets: [],
  currency: 'sats',
};

export function useBudget() {
  const [state, setState] = useLocalStorage<BudgetState>('sat-sorter-budget', DEFAULT_STATE);

  // Get or create budget for current month
  const currentBudget = useMemo((): MonthlyBudget => {
    const existing = state.budgets.find(b => b.month === state.currentMonth);
    if (existing) return existing;

    // Create new budget for the month
    return {
      id: generateId(),
      month: state.currentMonth,
      buckets: createDefaultBuckets(),
      transactions: [],
    };
  }, [state.budgets, state.currentMonth]);

  // Save current budget
  const saveBudget = useCallback((budget: MonthlyBudget) => {
    setState(prev => {
      const existingIndex = prev.budgets.findIndex(b => b.month === budget.month);
      const newBudgets = [...prev.budgets];

      if (existingIndex >= 0) {
        newBudgets[existingIndex] = budget;
      } else {
        newBudgets.push(budget);
      }

      return { ...prev, budgets: newBudgets };
    });
  }, [setState]);

  // Set current month
  const setCurrentMonth = useCallback((month: string) => {
    setState(prev => ({ ...prev, currentMonth: month }));
  }, [setState]);

  // Toggle currency
  const toggleCurrency = useCallback(() => {
    setState(prev => ({
      ...prev,
      currency: prev.currency === 'sats' ? 'usd' : 'sats',
    }));
  }, [setState]);

  // Add a new bucket
  const addBucket = useCallback((name: string, color: string, icon: string) => {
    const newBucket: Bucket = {
      id: generateId(),
      name,
      color,
      icon,
      isIncome: false,
      order: currentBudget.buckets.filter(b => !b.isIncome).length,
      lineItems: [],
    };

    const updatedBudget = {
      ...currentBudget,
      buckets: [...currentBudget.buckets, newBucket],
    };

    saveBudget(updatedBudget);
    return newBucket;
  }, [currentBudget, saveBudget]);

  // Update a bucket
  const updateBucket = useCallback((bucketId: string, updates: Partial<Bucket>) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId ? { ...b, ...updates } : b
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a bucket (except income)
  const deleteBucket = useCallback((bucketId: string) => {
    const bucket = currentBudget.buckets.find(b => b.id === bucketId);
    if (bucket?.isIncome) return; // Can't delete income bucket

    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.filter(b => b.id !== bucketId),
      // Unassign any transactions from this bucket
      transactions: currentBudget.transactions.map(t =>
        t.bucketId === bucketId ? { ...t, bucketId: null, lineItemId: null } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Add a line item to a bucket
  const addLineItem = useCallback((bucketId: string, name: string) => {
    const bucket = currentBudget.buckets.find(b => b.id === bucketId);
    if (!bucket) return;

    const newLineItem: LineItem = {
      id: generateId(),
      name,
      plannedAmount: 0,
      order: bucket.lineItems.length,
    };

    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? { ...b, lineItems: [...b.lineItems, newLineItem] }
          : b
      ),
    };

    saveBudget(updatedBudget);
    return newLineItem;
  }, [currentBudget, saveBudget]);

  // Update a line item
  const updateLineItem = useCallback((
    bucketId: string,
    lineItemId: string,
    updates: Partial<LineItem>
  ) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? {
              ...b,
              lineItems: b.lineItems.map(item =>
                item.id === lineItemId ? { ...item, ...updates } : item
              ),
            }
          : b
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a line item
  const deleteLineItem = useCallback((bucketId: string, lineItemId: string) => {
    const updatedBudget = {
      ...currentBudget,
      buckets: currentBudget.buckets.map(b =>
        b.id === bucketId
          ? { ...b, lineItems: b.lineItems.filter(item => item.id !== lineItemId) }
          : b
      ),
      // Unassign any transactions from this line item
      transactions: currentBudget.transactions.map(t =>
        t.lineItemId === lineItemId ? { ...t, lineItemId: null, bucketId: null } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Add a transaction
  const addTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId(),
    };

    const updatedBudget = {
      ...currentBudget,
      transactions: [...currentBudget.transactions, newTransaction],
    };

    saveBudget(updatedBudget);
    return newTransaction;
  }, [currentBudget, saveBudget]);

  // Update a transaction (assign to line item)
  const updateTransaction = useCallback((
    transactionId: string,
    updates: Partial<Transaction>
  ) => {
    const updatedBudget = {
      ...currentBudget,
      transactions: currentBudget.transactions.map(t =>
        t.id === transactionId ? { ...t, ...updates } : t
      ),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Delete a transaction
  const deleteTransaction = useCallback((transactionId: string) => {
    const updatedBudget = {
      ...currentBudget,
      transactions: currentBudget.transactions.filter(t => t.id !== transactionId),
    };
    saveBudget(updatedBudget);
  }, [currentBudget, saveBudget]);

  // Assign transaction to a line item
  const assignTransaction = useCallback((
    transactionId: string,
    bucketId: string,
    lineItemId: string
  ) => {
    updateTransaction(transactionId, { bucketId, lineItemId });
  }, [updateTransaction]);

  // Get available months
  const availableMonths = useMemo(() => {
    const months = new Set(state.budgets.map(b => b.month));
    months.add(state.currentMonth);
    return Array.from(months).sort().reverse();
  }, [state.budgets, state.currentMonth]);

  // Duplicate budget from a previous month (copies buckets and line items with amounts, not transactions)
  const duplicateFromMonth = useCallback((sourceMonth: string) => {
    const sourceBudget = state.budgets.find(b => b.month === sourceMonth);
    if (!sourceBudget) return false;

    // Create new buckets with new IDs but same structure and amounts
    const newBuckets = sourceBudget.buckets.map(bucket => ({
      ...bucket,
      id: generateId(),
      lineItems: bucket.lineItems.map(item => ({
        ...item,
        id: generateId(),
      })),
    }));

    const newBudget: MonthlyBudget = {
      id: generateId(),
      month: state.currentMonth,
      buckets: newBuckets,
      transactions: [], // Start fresh with transactions
    };

    saveBudget(newBudget);
    return true;
  }, [state.budgets, state.currentMonth, saveBudget]);

  // Get the previous month string
  const getPreviousMonth = useCallback(() => {
    const [year, month] = state.currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [state.currentMonth]);

  // Check if previous month has a budget
  const hasPreviousMonthBudget = useMemo(() => {
    const prevMonth = getPreviousMonth();
    return state.budgets.some(b => b.month === prevMonth);
  }, [state.budgets, getPreviousMonth]);

  // Import/replace entire budget state from cloud
  const importBudgetState = useCallback((newState: BudgetState) => {
    setState(newState);
  }, [setState]);

  // Get NWC connections from localStorage to include in sync
  const getNWCConnections = useCallback((): SyncedNWCConnection[] => {
    try {
      const stored = localStorage.getItem('nwc-connections');
      if (!stored) return [];
      const connections = JSON.parse(stored);
      // Only sync the essential data (not isConnected which is runtime state)
      return connections.map((c: { connectionString: string; alias: string }) => ({
        connectionString: c.connectionString,
        alias: c.alias,
      }));
    } catch {
      return [];
    }
  }, []);

  // Restore NWC connections from synced state
  const restoreNWCConnections = useCallback((connections: SyncedNWCConnection[]) => {
    if (!connections || connections.length === 0) return;

    try {
      // Get existing connections
      const existingStr = localStorage.getItem('nwc-connections');
      const existing = existingStr ? JSON.parse(existingStr) : [];

      // Merge - add any connections from cloud that don't exist locally
      const existingStrings = new Set(existing.map((c: { connectionString: string }) => c.connectionString));
      const toAdd = connections.filter(c => !existingStrings.has(c.connectionString));

      if (toAdd.length > 0) {
        const merged = [
          ...existing,
          ...toAdd.map(c => ({
            connectionString: c.connectionString,
            alias: c.alias,
            isConnected: false, // Will be connected on next use
          })),
        ];
        localStorage.setItem('nwc-connections', JSON.stringify(merged));
        console.log('[Budget] Restored', toAdd.length, 'NWC connections from cloud');
      }
    } catch (e) {
      console.error('[Budget] Failed to restore NWC connections:', e);
    }
  }, []);

  // Merge cloud budget - prefer cloud if it has more recent data
  const mergeBudgetFromCloud = useCallback((cloudState: BudgetState, cloudTimestamp: number): boolean => {
    // Get the stored sync timestamp
    const localTimestampStr = localStorage.getItem('sat-sorter-last-sync');
    const localTimestamp = localTimestampStr ? parseInt(localTimestampStr, 10) : 0;

    // Always restore NWC connections if they exist in cloud (merge, not replace)
    if (cloudState.nwcConnections && cloudState.nwcConnections.length > 0) {
      restoreNWCConnections(cloudState.nwcConnections);
    }

    // If cloud data is newer, use it
    if (cloudTimestamp > localTimestamp) {
      console.log('[Budget] Cloud data is newer, importing cloud budget');
      // Remove nwcConnections from state (they're stored separately in localStorage)
      const { nwcConnections: _, ...budgetData } = cloudState;
      setState(budgetData as BudgetState);
      localStorage.setItem('sat-sorter-last-sync', cloudTimestamp.toString());
      return true;
    }

    console.log('[Budget] Local data is up-to-date, keeping local budget');
    return false;
  }, [setState, restoreNWCConnections]);

  // Get the full budget state for cloud sync
  // This includes all budgets across all months AND NWC connections
  const getFullBudgetState = useCallback((): BudgetState => {
    // Make sure the current budget is included in the state
    const existingIndex = state.budgets.findIndex(b => b.month === state.currentMonth);
    let budgets: MonthlyBudget[];

    if (existingIndex < 0) {
      // Current budget doesn't exist in state yet, add it
      budgets = [...state.budgets, currentBudget];
    } else {
      // Update the current budget in state (in case it was modified)
      budgets = [...state.budgets];
      budgets[existingIndex] = currentBudget;
    }

    return {
      ...state,
      budgets,
      nwcConnections: getNWCConnections(),
    };
  }, [state, currentBudget, getNWCConnections]);

  return {
    // State
    currentBudget,
    currentMonth: state.currentMonth,
    currency: state.currency,
    availableMonths,
    getFullBudgetState,

    // Month actions
    setCurrentMonth,
    toggleCurrency,

    // Bucket actions
    addBucket,
    updateBucket,
    deleteBucket,

    // Line item actions
    addLineItem,
    updateLineItem,
    deleteLineItem,

    // Transaction actions
    addTransaction,
    updateTransaction,
    deleteTransaction,
    assignTransaction,

    // Budget duplication
    duplicateFromMonth,
    getPreviousMonth,
    hasPreviousMonthBudget,

    // Cloud sync helpers
    importBudgetState,
    mergeBudgetFromCloud,
  };
}
