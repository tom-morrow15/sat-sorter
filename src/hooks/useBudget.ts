import { useCallback, useMemo } from 'react';
import { useBudgetContext } from '@/contexts/BudgetContext';
import {
  BudgetState,
  MonthlyBudget,
  Bucket,
  LineItem,
  Transaction,
  BudgetPartner,
  BudgetTemplate,
  createDefaultBuckets,
  getCurrentMonth,
  generateId,
  formatMonth,
} from '@/lib/budgetTypes';

export function useBudget() {
  // Use shared context so all components share the same state instance
  const { state, setState } = useBudgetContext();

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

      // Ensure transactions array exists
      const safeBudget = {
        ...budget,
        transactions: budget.transactions || [],
        buckets: budget.buckets || [],
      };

      if (existingIndex >= 0) {
        newBudgets[existingIndex] = safeBudget;
      } else {
        newBudgets.push(safeBudget);
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
      date: transaction.date || new Date().toISOString(),
    };

    const updatedBudget = {
      ...currentBudget,
      transactions: [...currentBudget.transactions, newTransaction],
    };

    saveBudget(updatedBudget);
    return newTransaction;
  }, [currentBudget, saveBudget]);

  // Add multiple transactions in a single atomic update (used for splits to avoid stale-closure overwrites)
  const addTransactions = useCallback((transactions: Omit<Transaction, 'id'>[]) => {
    if (!transactions.length) return [];

    const newOnes: Transaction[] = transactions.map(t => ({
      ...t,
      id: generateId(),
      date: t.date || new Date().toISOString(),
    }));

    const updatedBudget = {
      ...currentBudget,
      transactions: [...currentBudget.transactions, ...newOnes],
    };

    saveBudget(updatedBudget);
    return newOnes;
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

  // Delete a transaction — also records a tombstone in deletedTxIds so the
  // deletion propagates to the partner's device (without it, the partner's
  // snapshot would re-add the transaction on next sync).
  const deleteTransaction = useCallback((transactionId: string) => {
    const updatedBudget = {
      ...currentBudget,
      transactions: currentBudget.transactions.filter(t => t.id !== transactionId),
      deletedTxIds: [...(currentBudget.deletedTxIds || []), transactionId],
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

  // Duplicate budget from a source month to a target month.
  // Copies buckets and line items with amounts, but NOT transactions.
  // If a budget already exists for targetMonth, it is replaced.
  const duplicateFromMonth = useCallback((
    sourceMonth: string,
    targetMonth: string,
    currentBtcPrice?: number,
  ): { success: boolean; message?: string } => {
    try {
      // Guard: cannot copy a month into itself
      if (sourceMonth === targetMonth) {
        return { success: false, message: 'Cannot copy a month into itself' };
      }

      // Find the source budget
      const sourceBudget = state.budgets.find(b => b.month === sourceMonth);

      // Guard: source month must have budget data
      if (!sourceBudget) {
        return { success: false, message: `No budget found for ${formatMonth(sourceMonth)}` };
      }

      // Guard: source budget must have at least one bucket to copy
      if (sourceBudget.buckets.length === 0) {
        return { success: false, message: 'Previous month has no budget categories to copy' };
      }

      // Deep-clone buckets with new IDs. Reset btcPriceAtBudget to the current
      // price so the copied line items are priced at the copy time, not the
      // source month's potentially stale price.
      const priceAtCopy = currentBtcPrice ?? sourceBudget.buckets[0]?.lineItems[0]?.btcPriceAtBudget;
      const newBuckets = sourceBudget.buckets.map(bucket => ({
        ...bucket,
        id: generateId(),
        lineItems: bucket.lineItems.map(item => ({
          ...item,
          id: generateId(),
          btcPriceAtBudget: priceAtCopy,
        })),
      }));

      const newBudget: MonthlyBudget = {
        id: generateId(),
        month: targetMonth,
        buckets: newBuckets,
        transactions: [], // Start fresh — no transactions are copied
      };

      saveBudget(newBudget);
      console.log(`[useBudget] Successfully duplicated budget from ${sourceMonth} to ${targetMonth}`);
      return { success: true, message: `Budget copied from ${formatMonth(sourceMonth)}` };
    } catch (error) {
      console.error('[useBudget] Failed to duplicate budget:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred while copying the budget',
      };
    }
  }, [state.budgets, saveBudget]);

   // Get the previous month string
   const getPreviousMonth = useCallback(() => {
     const [year, month] = state.currentMonth.split('-').map(Number);
     // month is 1-indexed (1-12), but Date constructor expects 0-indexed (0-11)
     // So subtract 1 to convert to 0-indexed, then subtract 1 more to go back one month
     const prevDate = new Date(year, month - 1 - 1);
     return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
   }, [state.currentMonth]);

   // Check if previous month has a budget
   const hasPreviousMonthBudget = useMemo(() => {
     const prevMonth = getPreviousMonth();
     return state.budgets.some(b => b.month === prevMonth);
   }, [state.budgets, getPreviousMonth]);

   // Add a partner to the budget
   const addPartner = useCallback((pubkey: string, permission: 'view' | 'edit') => {
     setState(prev => {
       const partners = prev.partners || [];
       // Avoid duplicates
       if (partners.some(p => p.pubkey === pubkey)) {
         console.log('[useBudget] Partner already exists:', pubkey);
         return prev;
       }
       const newPartner: BudgetPartner = {
         pubkey,
         permission,
         addedAt: Math.floor(Date.now() / 1000),
         status: 'pending', // Start as pending until they accept
       };
       console.log('[useBudget] Adding new partner:', pubkey, 'with permission:', permission);
       return { ...prev, partners: [...partners, newPartner] };
     });
   }, [setState]);

   // Remove a partner from the budget
  const removePartner = useCallback((pubkey: string) => {
    setState(prev => ({
      ...prev,
      partners: (prev.partners || []).filter(p => p.pubkey !== pubkey),
    }));
  }, [setState]);

  // Change a partner's permission level
  const changePartnerPermission = useCallback((pubkey: string, permission: 'view' | 'edit') => {
    setState(prev => ({
      ...prev,
      partners: (prev.partners || []).map(p =>
        p.pubkey === pubkey ? { ...p, permission } : p
      ),
    }));
  }, [setState]);

   // Set user role
  const setUserRole = useCallback((role: 'owner' | 'editor' | 'viewer') => {
    setState(prev => ({ ...prev, userRole: role }));
  }, [setState]);

  // Save current budget as a template
  const saveAsTemplate = useCallback((name: string, description?: string) => {
    const now = Math.floor(Date.now() / 1000);
    const template: BudgetTemplate = {
      id: generateId(),
      name,
      description,
      buckets: currentBudget.buckets.map(b => ({
        ...b,
        id: generateId(), // New IDs for template
        lineItems: b.lineItems.map(li => ({
          ...li,
          id: generateId(), // New IDs for template
        })),
      })),
      createdAt: now,
      updatedAt: now,
    };

    setState(prev => {
      const templates = prev.templates || [];
      return { ...prev, templates: [...templates, template] };
    });

    return template;
  }, [currentBudget, setState]);

  // Update existing template
  const updateTemplate = useCallback((templateId: string, name: string, description?: string) => {
    setState(prev => ({
      ...prev,
      templates: (prev.templates || []).map(t =>
        t.id === templateId
          ? { ...t, name, description, updatedAt: Math.floor(Date.now() / 1000) }
          : t
      ),
    }));
  }, [setState]);

  // Delete a template
  const deleteTemplate = useCallback((templateId: string) => {
    setState(prev => ({
      ...prev,
      templates: (prev.templates || []).filter(t => t.id !== templateId),
      // Clear default if deleted template was default
      defaultTemplateId: prev.defaultTemplateId === templateId ? undefined : prev.defaultTemplateId,
    }));
  }, [setState]);

  // Set a template as default
  const setDefaultTemplate = useCallback((templateId: string) => {
    setState(prev => ({ ...prev, defaultTemplateId: templateId }));
  }, [setState]);

   // Apply template to current month
   const applyTemplate = useCallback((templateId: string) => {
     const template = (state.templates || []).find(t => t.id === templateId);
     if (!template) return;

     const newBuckets = template.buckets.map(b => ({
       ...b,
       id: generateId(),
       lineItems: b.lineItems.map(li => ({
         ...li,
         id: generateId(),
       })),
     }));

     const updatedBudget = {
       ...currentBudget,
       buckets: newBuckets,
     };

     saveBudget(updatedBudget);
   }, [state.templates, currentBudget, saveBudget]);

   // Reset current month's budget to empty state
   const resetCurrentMonth = useCallback(() => {
     setState(prev => {
       const newBudgets = prev.budgets.filter(b => b.month !== state.currentMonth);
       return { ...prev, budgets: newBudgets };
     });
   }, [state.currentMonth, setState]);

   /**
    * Import a budget state (e.g. from an accepted partner invite).
    * This merges the imported budgets with any existing ones.
    * - Budgets that exist in both: imported version takes precedence
    * - Budgets only in imported: added
    * - Budgets only local: preserved
    * - Partner/role info from imported: set user as partner/editor/viewer
    */
   const importBudgetState = useCallback((
     importedState: BudgetState,
     options: { asRole?: 'editor' | 'viewer'; ownerPubkey?: string } = {}
   ) => {
     setState(prev => {
       // Merge budgets: imported budgets replace existing ones by month
       const importedMonths = new Set(importedState.budgets.map(b => b.month));
       const existingBudgets = (prev.budgets || []).filter(b => !importedMonths.has(b.month));
       const mergedBudgets = [...existingBudgets, ...importedState.budgets];

       // Always use the REAL current month (today's actual month), not the invite's
       // month or the previous state. The invite may have been sent months ago, and
       // users expect the app to open to the current month.
       const realCurrentMonth = getCurrentMonth();

       // Preserve the role if provided (partner role)
       const newUserRole = options.asRole || prev.userRole || 'owner';

       // If an owner pubkey is provided, add them as a partner on the invitee's side
       // so the invitee's device subscribes to the owner's sync events.
       let newPartners = prev.partners || [];
       if (options.ownerPubkey && !newPartners.some(p => p.pubkey === options.ownerPubkey)) {
         newPartners = [
           ...newPartners,
           {
             pubkey: options.ownerPubkey,
             permission: 'edit',
             addedAt: Math.floor(Date.now() / 1000),
             status: 'accepted', // Owner is implicitly accepted
             acceptedAt: Math.floor(Date.now() / 1000),
           },
         ];
         console.log('[useBudget] Added owner as partner on invitee side:', options.ownerPubkey);
       }

       console.log('[useBudget] Imported budget state:', {
         importedBudgets: importedState.budgets.length,
         mergedBudgets: mergedBudgets.length,
         currentMonth: realCurrentMonth,
         asRole: newUserRole,
       });

       return {
         ...prev,
         budgets: mergedBudgets,
         currentMonth: realCurrentMonth,
         userRole: newUserRole,
         partners: newPartners,
       };
     });
   }, [setState]);

  return {
    // State
    currentBudget,
    currentMonth: state.currentMonth,
    currency: state.currency,
    availableMonths,
    fullState: state, // Expose full state for sync operations
    partners: state.partners || [],
    userRole: state.userRole || 'owner',
    templates: state.templates || [],
    defaultTemplateId: state.defaultTemplateId,

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
    addTransactions,
    updateTransaction,
    deleteTransaction,
    assignTransaction,

    // Partner actions
    addPartner,
    removePartner,
    changePartnerPermission,
    setUserRole,

    // Import/export actions
    importBudgetState,

    // Template actions
    saveAsTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    applyTemplate,

     // Budget duplication
     duplicateFromMonth,
     getPreviousMonth,
     hasPreviousMonthBudget,

    // Reset current month
      resetCurrentMonth,

    // Payment methods (synced with budget state for cross-device persistence)
    paymentMethods: state.paymentMethods || [],
    /** Count transactions across ALL months that reference a given payment method. */
    getTransactionsUsingMethod: (method: string): number => {
      let count = 0;
      for (const budget of state.budgets) {
        for (const tx of budget.transactions) {
          if (tx.paymentMethod === method) count++;
        }
      }
      return count;
    },
    addPaymentMethod: (method: string) => {
      const trimmed = method.trim();
      if (!trimmed) return;
      setState(prev => {
        const current = prev.paymentMethods || [];
        if (current.includes(trimmed)) return prev;
        return { ...prev, paymentMethods: [...current, trimmed] };
      });
    },
    removePaymentMethod: (method: string) => {
      setState(prev => ({
        ...prev,
        paymentMethods: (prev.paymentMethods || []).filter(m => m !== method),
      }));
    },
    updatePaymentMethod: (oldMethod: string, newMethod: string) => {
      const trimmed = newMethod.trim();
      if (!trimmed || trimmed === oldMethod) return;
      setState(prev => {
        const updatedMethods = (prev.paymentMethods || []).map(m => m === oldMethod ? trimmed : m);
        // Cascade rename to all transactions across all months
        const updatedBudgets = prev.budgets.map(budget => {
          let changed = false;
          const updatedTxs = budget.transactions.map(tx => {
            if (tx.paymentMethod === oldMethod) {
              changed = true;
              return { ...tx, paymentMethod: trimmed };
            }
            return tx;
          });
          return changed ? { ...budget, transactions: updatedTxs } : budget;
        });
        return { ...prev, paymentMethods: updatedMethods, budgets: updatedBudgets };
      });
    },
  };
}

