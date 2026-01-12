import { Badge } from '@/components/ui/badge';
import { Wallet, Zap, Link2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/lib/budgetTypes';

interface TransactionSourceBadgeProps {
  transaction: Transaction;
  className?: string;
}

export function TransactionSourceBadge({ transaction, className }: TransactionSourceBadgeProps) {
  if (!transaction.source && !transaction.sourceWallet) {
    return null;
  }

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
    // Always prioritize showing the wallet name if available
    if (transaction.sourceWallet) {
      return transaction.sourceWallet;
    }
    // Fall back to source type if no wallet name
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
