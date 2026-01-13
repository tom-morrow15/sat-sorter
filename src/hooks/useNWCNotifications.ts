/**
 * Hook for managing real-time NWC notifications
 * 
 * Automatically subscribes to notifications from all connected wallets
 * and adds transactions to the budget store as they arrive.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNWC } from '@/hooks/useNWCContext';
import { useBudgetStoreContext } from '@/contexts/BudgetStoreContext';
import { useToast } from '@/hooks/useToast';
import { NWCNotificationManager, type NWCNotification } from '@/lib/nwcNotifications';

interface UseNWCNotificationsOptions {
  /** Whether notifications are enabled (default: true) */
  enabled?: boolean;
  /** Show toast notifications for new transactions (default: true) */
  showToasts?: boolean;
}

export function useNWCNotifications(options: UseNWCNotificationsOptions = {}) {
  const { enabled = true, showToasts = true } = options;
  
  const { connections } = useNWC();
  const budgetStore = useBudgetStoreContext();
  const { toast } = useToast();
  
  const managerRef = useRef<NWCNotificationManager | null>(null);
  const processedHashesRef = useRef<Set<string>>(new Set());

  // Handler for incoming notifications
  const handleNotification = useCallback((
    notification: NWCNotification,
    walletAlias: string,
    connectionString: string
  ) => {
    // Skip if we've already processed this payment hash (deduplication)
    if (processedHashesRef.current.has(notification.payment_hash)) {
      console.log('[NWC Notifications] Skipping duplicate:', notification.payment_hash.slice(0, 16) + '...');
      return;
    }

    // Check if transaction already exists in budget
    const fullState = budgetStore.getFullBudgetState();
    const existsInBudget = fullState.budgets.some(budget =>
      budget.transactions.some(tx => tx.paymentHash === notification.payment_hash)
    );

    if (existsInBudget) {
      console.log('[NWC Notifications] Transaction already in budget:', notification.payment_hash.slice(0, 16) + '...');
      processedHashesRef.current.add(notification.payment_hash);
      return;
    }

    // Convert millisats to sats
    const amountSats = Math.round(notification.amount / 1000);
    
    // Skip zero-amount transactions
    if (amountSats === 0) {
      console.log('[NWC Notifications] Skipping zero-amount transaction');
      return;
    }

    // Build description
    let description = 'Lightning payment';
    if (notification.description && notification.description.trim()) {
      description = notification.description.trim();
    } else if (notification.metadata?.comment && typeof notification.metadata.comment === 'string') {
      description = notification.metadata.comment;
    }

    // Determine if income or expense
    const isIncome = notification.type === 'incoming';

    // Create the transaction
    const transaction = {
      amount: amountSats,
      description,
      date: new Date((notification.settled_at || notification.created_at) * 1000).toISOString(),
      lineItemId: null,
      bucketId: null,
      isIncome,
      source: 'nwc' as const,
      sourceWallet: walletAlias,
      sourceWalletId: connectionString,
      paymentHash: notification.payment_hash,
      preimage: notification.preimage,
    };

    console.log('[NWC Notifications] Adding real-time transaction:', {
      amount: amountSats,
      isIncome,
      description,
      wallet: walletAlias,
    });

    // Add to budget store
    budgetStore.addTransaction(transaction);
    processedHashesRef.current.add(notification.payment_hash);

    // Keep the processed hashes set from growing too large
    if (processedHashesRef.current.size > 500) {
      const entries = Array.from(processedHashesRef.current);
      processedHashesRef.current = new Set(entries.slice(-250));
    }

    // Show toast notification
    if (showToasts) {
      const formattedAmount = amountSats.toLocaleString();
      toast({
        title: isIncome ? '⚡ Payment received!' : '⚡ Payment sent',
        description: `${formattedAmount} sats ${isIncome ? 'from' : 'via'} ${walletAlias}`,
      });
    }
  }, [budgetStore, toast, showToasts]);

  // Initialize and manage the notification manager
  useEffect(() => {
    if (!enabled || connections.length === 0) {
      // Clean up if disabled or no connections
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      return;
    }

    // Create manager if it doesn't exist
    if (!managerRef.current) {
      console.log('[NWC Notifications] Creating notification manager');
      managerRef.current = new NWCNotificationManager(handleNotification);
    }

    const manager = managerRef.current;

    // Subscribe to all connections
    const currentConnectionStrings = new Set(connections.map(c => c.connectionString));
    
    // Add new subscriptions
    for (const conn of connections) {
      if (!manager.isSubscribed(conn.connectionString)) {
        console.log('[NWC Notifications] Subscribing to:', conn.alias);
        manager.subscribe(conn.connectionString, conn.alias || 'NWC Wallet');
      }
    }

    // Remove old subscriptions
    for (const connString of manager.getActiveSubscriptions()) {
      if (!currentConnectionStrings.has(connString)) {
        console.log('[NWC Notifications] Unsubscribing from removed wallet');
        manager.unsubscribe(connString);
      }
    }

    // Cleanup on unmount
    return () => {
      // Don't destroy on every re-render, only on unmount
    };
  }, [enabled, connections, handleNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        console.log('[NWC Notifications] Destroying notification manager');
        managerRef.current.destroy();
        managerRef.current = null;
      }
    };
  }, []);

  return {
    /** Number of active notification subscriptions */
    activeSubscriptions: managerRef.current?.getActiveSubscriptions().length ?? 0,
  };
}
