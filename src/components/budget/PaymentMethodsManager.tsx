import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBudget } from '@/hooks/useBudget';

export function PaymentMethodsManager() {
  const {
    paymentMethods,
    addPaymentMethod,
    removePaymentMethod,
    updatePaymentMethod,
    getTransactionsUsingMethod,
  } = useBudget();

  const [newMethod, setNewMethod] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newMethod.trim()) return;
    addPaymentMethod(newMethod);
    setNewMethod('');
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(paymentMethods[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const oldMethod = paymentMethods[editingIndex];
    updatePaymentMethod(oldMethod, editingValue);
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    removePaymentMethod(deleteTarget);
    setDeleteTarget(null);
  };

  const deleteTxCount = deleteTarget ? getTransactionsUsingMethod(deleteTarget) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Add New Payment Method</Label>
        <div className="flex gap-2 mt-2">
          <Input
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
            placeholder="e.g., Citi Credit Card, Bitcoin, ACH"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Button onClick={handleAdd} disabled={!newMethod.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">
          Your Payment Methods ({paymentMethods.length})
        </Label>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl">
            No payment methods yet. Add one above.
          </div>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((method, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-xl"
              >
                {editingIndex === index ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium">{method}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(index)}
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(method)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        These payment methods will appear as a dropdown when you add or edit any transaction.
      </p>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment method will be removed from your list of options.
              {deleteTxCount > 0 && (
                <>{" "}{deleteTxCount} transaction{deleteTxCount !== 1 && 's'} use this method. Those transactions will keep the label but it will no longer appear in dropdowns.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
