import { Badge } from '@/components/ui/badge';
import { Wallet, Zap, Link2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/budgetTypes';
import type { NWCConnection } from '@/hooks/useNWC';

interface TransactionSourceBadgeProps {
  transaction: Transaction;
  className?: string;
  walletConnections?: NWCConnection[];
}

export function TransactionSourceBadge({ transaction, className, walletConnections = [] }: TransactionSourceBadgeProps) {
  if (!transaction.source && !transaction.sourceWallet) {
    return null;
  }

  // Try to look up wallet name from connections by connection string ID
  const lookupWalletName = (): string | null => {
    if (transaction.sourceWalletId && walletConnections.length > 0) {
      const wallet = walletConnections.find(w => w.connectionString === transaction.sourceWalletId);
      if (wallet && wallet.alias) {
        return wallet.alias;
      }
    }
    // Fall back to stored wallet name if lookup fails
    if (transaction.sourceWallet) {
      return transaction.sourceWallet;
    }
    return null;
  };

  const getSourceIcon = () => {
    switch (transaction.source) {
      case 'nwc':
        return <Wallet className="h-3 w-3" />;
      case 'zap':
        return <Zap className="h-3 w-3" />;
      case 'strike':
        return <Link2 className="h-3 w-3" />;
      case 'manual':
        return <Plus className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getSourceLabel = () => {
    // First try to look up the wallet name from connected wallets
    const walletName = lookupWalletName();
    if (walletName) {
      return walletName;
    }
    // Fall back to source type if no wallet name found
    switch (transaction.source) {
      case 'nwc':
        return 'Lightning';
      case 'zap':
        return 'Zap';
      case 'strike':
        return 'Strike';
      case 'manual':
        return 'Manual';
      default:
        return 'Unknown';
    }
  };

  const getSourceColor = () => {
    switch (transaction.source) {
      case 'nwc':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'zap':
        return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'strike':
        return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'manual':
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs px-2 py-0.5 gap-1 flex items-center',
        getSourceColor(),
        className
      )}
    >
      {getSourceIcon()}
      <span>{getSourceLabel()}</span>
    </Badge>
  );
}
