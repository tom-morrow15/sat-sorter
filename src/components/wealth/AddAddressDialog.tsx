import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { isValidBitcoinAddress } from '@/lib/wealthTypes';

interface AddAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (address: string, label: string) => void;
}

export function AddAddressDialog({ open, onOpenChange, onAdd }: AddAddressDialogProps) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');

    // Validate address
    if (!address.trim()) {
      setError('Please enter a Bitcoin address');
      return;
    }

    if (!isValidBitcoinAddress(address.trim())) {
      setError(
        'Invalid Bitcoin address. Please enter a valid Legacy (1...), SegWit (3...), or Bech32 (bc1...) address.'
      );
      return;
    }

    // Validate label
    if (!label.trim()) {
      setError('Please enter a label for this address');
      return;
    }

    // Add the address
    onAdd(address.trim(), label.trim());

    // Reset form
    setAddress('');
    setLabel('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setAddress('');
    setLabel('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Bitcoin Address</DialogTitle>
          <DialogDescription>
            Add a Bitcoin address to start monitoring its balance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Bitcoin Address</Label>
            <Input
              id="address"
              placeholder="1ABC... or 3ABC... or bc1..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono text-xs"
              spellCheck="false"
            />
            <p className="text-xs text-muted-foreground">
              Supports Legacy (1...), SegWit (3...), or Bech32 (bc1...) addresses
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="e.g., Cold Storage, Main Wallet"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this address
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Your data is stored locally in your browser. Addresses are public; only view-only access is needed.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!address.trim() || !label.trim()}>
            Add Address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
