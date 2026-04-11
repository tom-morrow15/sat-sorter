import { Trash2, Edit2, Check, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WatchedAddress } from '@/lib/wealthTypes';
import { useState } from 'react';

interface AddressListItemProps {
  address: WatchedAddress;
  isEditing: boolean;
  editingLabel: string;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onRemove: (addressId: string) => void;
}

export function AddressListItem({
  address,
  isEditing,
  editingLabel,
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
      <div className="p-3 rounded-lg bg-muted/50 space-y-3">
        <Input
          value={editingLabel}
          onChange={(e) => onEditChange(e.target.value)}
          placeholder="Label"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={onEditSave} className="flex-1">
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditCancel} className="flex-1">
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{address.label}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {address.address}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Added {new Date(address.createdAt * 1000).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-1 ml-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopyAddress}
          title={copiedAddress ? 'Copied!' : 'Copy address'}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onEditStart}
          title="Edit label"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onRemove(address.id)}
          title="Remove address"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
