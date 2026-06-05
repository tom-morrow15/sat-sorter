import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface ContextBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
}

export function ContextBottomSheet({
  open,
  onOpenChange,
  context,
}: ContextBottomSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[50vh]">
        <SheetHeader>
          <SheetTitle>Budget Buddy Context</SheetTitle>
          <p className="text-xs text-muted-foreground">
            This is the background context Maple uses when answering your
            questions. You can edit it in Settings.
          </p>
        </SheetHeader>
        <div className="mt-4 p-4 rounded-xl bg-muted border border-border/60 text-sm leading-relaxed">
          {context || (
            <span className="text-muted-foreground italic">
              No evergreen context set. Go to Settings &gt; Maple AI to add
              instructions.
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
