import { LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';

interface GuestLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestLimitDialog({
  open,
  onOpenChange,
}: GuestLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-blue-600" />
            Sign In to Add More Buckets
          </DialogTitle>
          <DialogDescription>
            You've reached the 5 bucket limit for guest users. Sign in with Nostr to unlock paid upgrade tiers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bh-panel p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Benefits of signing in:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>✓ Add more budget buckets with paid plans</li>
              <li>✓ Save your budgets to Nostr (encrypted & private)</li>
              <li>✓ Share budgets securely with partners</li>
              <li>✓ Access your budgets across devices</li>
            </ul>
          </div>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-3">Sign in with Nostr:</p>
            <LoginArea className="flex w-full justify-center" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue as Guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
