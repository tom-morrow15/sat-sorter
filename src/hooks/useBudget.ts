import { useCallback, useMemo } from 'react';
import { useBudgetContext } from '@/contexts/BudgetContext';
import {
  BudgetState,
  MonthlyBudget,
  Bucket,
  LineItem,
  Transaction,
  BudgetPartner,
  BudgetPartnerInvite,
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
  const duplicateFromMonth = useCallback((sourceMonth: string): { success: boolean; message?: string } => {
    // Check if a budget already exists for the current month
    const existingBudget = state.budgets.find(b => b.month === state.currentMonth);
    if (existingBudget && existingBudget.buckets.length > 0) {
      // Budget already exists - ask user to confirm overwrite or return early
      console.warn(`[useBudget] Budget already exists for ${state.currentMonth}. Aborting duplicate.`);
      return { 
        success: false, 
        message: `You already have a budget set up for ${formatMonth(state.currentMonth)}. Delete it first if you want to replace it.` 
      };
    }

     let sourceBudget = state.budgets.find(b => b.month === sourceMonth);
     
     // If no previous month budget exists, use a default template
     if (!sourceBudget) {
       // Create a default budget with just an income bucket
       sourceBudget = {
         id: generateId(),
         month: sourceMonth,
         buckets: createDefaultBuckets(),
         transactions: [],
       };
     }

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
    console.log(`[useBudget] Successfully duplicated budget from ${sourceMonth} to ${state.currentMonth}`);
    return { success: true, message: 'Budget copied successfully!' };
  }, [state.budgets, state.currentMonth, saveBudget]);

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

  // Accept a budget partner invite
  const acceptPartnerInvite = useCallback((inviteId: string) => {
    setState(prev => {
      const invites = prev.receivedInvites || [];
      const invite = invites.find(i => i.id === inviteId);
      
      if (!invite) return prev;

      // Update invite status to accepted
      const updatedInvites = invites.map(i =>
        i.id === inviteId
          ? { ...i, status: 'accepted' as const, acceptedAt: Math.floor(Date.now() / 1000) }
          : i
      );

      return { ...prev, receivedInvites: updatedInvites };
    });
  }, [setState]);

  // Decline a budget partner invite
  const declinePartnerInvite = useCallback((inviteId: string) => {
    setState(prev => {
      const invites = prev.receivedInvites || [];
      const updatedInvites = invites.map(i =>
        i.id === inviteId
          ? { ...i, status: 'declined' as const }
          : i
      );
      return { ...prev, receivedInvites: updatedInvites };
    });
  }, [setState]);

  // Send a budget partner invite (when owner adds a partner, this creates an invite on their side)
  const sendPartnerInvite = useCallback((toPubkey: string, budgetMonth: string, permission: 'view' | 'edit') => {
    setState(prev => {
      // This function is called by the budget owner
      // It marks the partner as "pending" in the owner's view
      const partners = prev.partners || [];
      return {
        ...prev,
        partners: partners.map(p =>
          p.pubkey === toPubkey && p.status !== 'accepted'
            ? { ...p, status: 'pending' as const }
            : p
        ),
      };
    });
  }, [setState]);

  // Simulate receiving an invite (in real app, this comes from Nostr DM)
  const receivePartnerInvite = useCallback((fromPubkey: string, budgetMonth: string, permission: 'view' | 'edit') => {
    setState(prev => {
      const invites = prev.receivedInvites || [];
      // Check if invite already exists
      if (invites.some(i => i.fromPubkey === fromPubkey && i.budgetMonth === budgetMonth)) {
        return prev;
      }

      const newInvite: BudgetPartnerInvite = {
        id: generateId(),
        fromPubkey,
        budgetMonth,
        permission,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'pending',
      };

      return { ...prev, receivedInvites: [...invites, newInvite] };
    });
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
    receivedInvites: state.receivedInvites || [],

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

    // Partner actions
    addPartner,
    removePartner,
    changePartnerPermission,
    setUserRole,
    acceptPartnerInvite,
    declinePartnerInvite,
    sendPartnerInvite,
    receivePartnerInvite,

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
   };
 }
