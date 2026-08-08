import { AlertCircle, Lightbulb } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeletionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'transaction' | 'lineItem' | 'bucket';
  itemName: string;
  onConfirm: () => void;
}

export function DeletionConfirmDialog({
  open,
  onOpenChange,
  itemType,
  itemName,
  onConfirm,
}: DeletionConfirmDialogProps) {
  const getDescription = () => {
    switch (itemType) {
      case 'transaction':
        return `Delete this transaction "${itemName}"? This action will be synced to your cloud backup. This change cannot be easily undone without restoring an older version.`;
      case 'lineItem':
        return `Delete the line item "${itemName}"? This will remove the category and any unassigned transactions will be lost. This action will be synced to your cloud backup.`;
      case 'bucket':
        return `Delete the entire "${itemName}" bucket? This will remove all line items and transactions in this category. This action will be synced to your cloud backup.`;
    }
  };

  const getLabel = () => {
    switch (itemType) {
      case 'transaction':
        return 'Delete Transaction';
      case 'lineItem':
        return 'Delete Line Item';
      case 'bucket':
        return 'Delete Category';
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-serif text-xl">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {getLabel()}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {getDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-mustard/10 border-l-4 border-l-mustard rounded-sm p-3 text-sm flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-mustard shrink-0 mt-0.5" />
          <p className="text-foreground/80">
            <strong className="font-medium">Tip:</strong> This will be tracked in your sync history. You can restore a previous version from the History button if needed.
          </p>
        </div>

        <div className="flex gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
