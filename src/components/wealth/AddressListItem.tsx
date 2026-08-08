import { Trash2, Edit2, Check, X, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WatchedAddress } from '@/lib/wealthTypes';
import { formatSats } from '@/hooks/useBitcoinPrice';
import { useState } from 'react';

interface AddressListItemProps {
  address: WatchedAddress;
  isEditing: boolean;
  editingLabel: string;
  /** Live balance in sats for this address. `undefined` while loading, `null` if fetch failed. */
  balanceSats?: number | null;
  balanceUsd?: number | null;
  isLoading?: boolean;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemove: (addressId: string) => void;
}

function formatBtc(sats: number) {
  return (sats / 100_000_000).toFixed(8);
}

function formatUsd(usd: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd);
}

export function AddressListItem({
  address,
  isEditing,
  editingLabel,
  balanceSats,
  balanceUsd,
  isLoading,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onRemove,
}: AddressListItemProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address.address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  if (isEditing) {
    return (
      <div className="p-3 rounded-xl bg-muted/40 space-y-3">
        <Input
          value={editingLabel}
          onChange={(e) => onEditChange(e.target.value)}
          placeholder="Label"
          className="h-10"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={onEditSave} className="flex-1 touch-target-sm">
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditCancel} className="flex-1 touch-target-sm">
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const hasBalance = typeof balanceSats === 'number';
  const fetchFailed = balanceSats === null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 -mx-1 rounded-xl hover:bg-muted/30 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{address.label}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {address.address}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Added {new Date(address.createdAt * 1000).toLocaleDateString()}
        </p>
      </div>

      {/* Balance */}
      <div className="flex flex-col items-end shrink-0 min-w-[110px]">
        {isLoading && !hasBalance ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : fetchFailed ? (
          <span className="text-xs text-destructive">Unavailable</span>
        ) : hasBalance ? (
          <>
            <p className="font-num text-base tabular-nums">
              {formatSats(balanceSats)} sats
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatBtc(balanceSats)} BTC
            </p>
            {typeof balanceUsd === 'number' && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatUsd(balanceUsd)}
              </p>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex items-center gap-1 ml-2 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={handleCopyAddress}
          title={copiedAddress ? 'Copied!' : 'Copy address'}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={onEditStart}
          title="Edit label"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onRemove(address.id)}
          title="Remove address"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
