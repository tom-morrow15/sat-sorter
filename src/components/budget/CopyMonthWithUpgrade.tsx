import { useState } from 'react';
import { CopyMonthPrompt, type AvailableMonth } from './CopyMonthPrompt';
import { UpgradeDialog } from './UpgradeDialog';
import type { MonthlyBudget } from '@/lib/budgetTypes';

interface CopyMonthWithUpgradeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMonth: string;
  availableMonths: AvailableMonth[];
  previousBudget: MonthlyBudget | null;
  currentBudgets: MonthlyBudget[];
  onStartFresh: () => void;
  onCopyPrevious: (selectedMonth: string) => void;
  maxBucketsAllowed: number;
}

export function CopyMonthWithUpgrade({
  open,
  onOpenChange,
  currentMonth,
  availableMonths,
  previousBudget,
  currentBudgets,
  onStartFresh,
  onCopyPrevious,
  maxBucketsAllowed,
}: CopyMonthWithUpgradeProps) {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [pendingSourceMonth, setPendingSourceMonth] = useState<string | null>(null);

  // Check if the previous budget has more buckets than the free tier allows
  const previousBucketCount = previousBudget?.buckets.length ?? 0;
  const needsUpgrade = previousBucketCount > maxBucketsAllowed;

  const handleCopyPreviousClick = (selectedMonth: string) => {
    const budgetToCopy = availableMonths.find(m => m.month === selectedMonth)?.budget;

    if (budgetToCopy && budgetToCopy.buckets.length > maxBucketsAllowed) {
      // Budget has more buckets than allowed — show upgrade dialog
      setPendingSourceMonth(selectedMonth);
      setShowUpgradeDialog(true);
    } else {
      // Within limits — copy normally
      onCopyPrevious(selectedMonth);
      onOpenChange(false);
    }
  };

  return (
    <>
      <CopyMonthPrompt
        open={open && !showUpgradeDialog}
        onOpenChange={onOpenChange}
        currentMonth={currentMonth}
        availableMonths={availableMonths}
        onStartFresh={onStartFresh}
        onCopyPrevious={handleCopyPreviousClick}
      />

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowUpgradeDialog(false);
            setPendingSourceMonth(null);
          }
        }}
        bucketCount={previousBucketCount}
        maxBucketsForFreeTier={maxBucketsAllowed}
        onUpgradeComplete={() => {
          // After successful upgrade, proceed with the copy
          if (pendingSourceMonth) {
            onCopyPrevious(pendingSourceMonth);
            onOpenChange(false);
            setPendingSourceMonth(null);
          }
        }}
      />
    </>
  );
}
