import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Bucket } from '@/lib/budgetTypes';

export interface OverspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: Bucket;
  amount: number;
  onAskMaple: () => void;
  onCancel: () => void;
}

export function OverspendDialog({
  open,
  onOpenChange,
  bucket,
  amount,
  onAskMaple,
  onCancel,
}: OverspendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Budget Warning
          </DialogTitle>
          <DialogDescription>
            This purchase would exceed your {bucket.name} budget.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            This puts you
          </p>
          <p className="text-2xl font-bold text-destructive my-1">
            ${amount.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            over your <span className="font-semibold">{bucket.name}</span> budget.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onAskMaple} className="flex-1">
            Ask Maple Anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
