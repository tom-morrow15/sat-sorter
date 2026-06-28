import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManagePartnersDialog } from './ManagePartnersDialog';

const MIGRATION_KEY = 'sat-sorter-partner-migration-shown';

/**
 * MigrationBanner — Shown when old partner data is detected without a
 * shared budget keypair. The user must re-invite partners to continue
 * using the shared budget feature with the new architecture.
 */
export function MigrationBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPartners, setShowPartners] = useState(false);

  useEffect(() => {
    try {
      const flag = localStorage.getItem(MIGRATION_KEY);
      setIsVisible(flag === '1');
    } catch {
      // localStorage may not be available
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.removeItem(MIGRATION_KEY);
    } catch {
      // ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              <span className="font-semibold">
                Budget partners has been upgraded
              </span>{' '}
              for better sync reliability. You need to re-invite your partners
              to continue sharing budgets.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white hover:bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800 dark:border-amber-700"
              onClick={() => setShowPartners(true)}
            >
              Re-invite Partners
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-800/50"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
      <ManagePartnersDialog
        open={showPartners}
        onOpenChange={setShowPartners}
      />
    </>
  );
}
