import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, Wallet, MessageSquare, Cloud, CloudOff, RefreshCw, MoreHorizontal, MapPin, Receipt, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudget } from '@/hooks/useBudget';
import { useMapleSettings } from '@/hooks/useMapleSettings';
import { useBudgetAutoSave } from '@/hooks/useBudgetAutoSave';
import { useAddTransaction } from '@/components/budget/AddTransactionProvider';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { fullState, currentBudget } = useBudget();
  const { isMapleEnabled } = useMapleSettings();
  const { openAddTransaction } = useAddTransaction() ?? {};

  const { status: autoSaveStatus, canAutoSave } = useBudgetAutoSave(fullState);

  const isActive = (path: string) => location.pathname === path;
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  const handleAddTransaction = () => {
    // No pre-selected bucket — user picks in the dialog
    openAddTransaction?.();
  };

  const hasBuckets = currentBudget.buckets.length > 0;

  const SaveIndicator = () => {
    if (!user || !canAutoSave) return null;

    const config = {
      idle: { icon: Cloud, color: 'text-muted-foreground/50', label: 'Sync' },
      saving: { icon: RefreshCw, color: 'text-primary animate-spin', label: 'Saving' },
      saved: { icon: Cloud, color: 'text-green-500', label: 'Saved' },
      error: { icon: CloudOff, color: 'text-red-500', label: 'Error' },
      offline: { icon: CloudOff, color: 'text-muted-foreground/50', label: 'Offline' },
    }[autoSaveStatus];

    const Icon = config.icon;

    return (
      <button
        className="flex flex-col items-center justify-center gap-0.5 px-2"
        title={`Cloud sync: ${config.label}`}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
        <span className={cn('text-[9px]', config.color)}>{config.label}</span>
      </button>
    );
  };

  const NavButton = ({ path, icon: Icon, label }: { path: string; icon: typeof Home; label: string }) => (
    <button
      onClick={() => navigate(path)}
      className={cn(
        'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors',
        isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px]">{label}</span>
    </button>
  );

  return (
    <>
      {/* Bottom nav bar with central FAB notch */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="relative flex items-center h-16">
          {/* Left side of nav */}
          <div className="flex items-center flex-1 h-full">
            <NavButton path="/home" icon={Home} label="Home" />
            <NavButton path="/breakdown" icon={PieChart} label="Breakdown" />
          </div>

          {/* Center FAB — orange circle that sits above the nav bar */}
          <div className="relative flex items-center justify-center w-16">
            {/* Notch cutout — creates the dip effect in the nav bar */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-background/95 backdrop-blur"
              style={{ maskImage: 'radial-gradient(circle 28px at center, transparent 98%, black 100%)' }}
            />
            <button
              onClick={handleAddTransaction}
              disabled={!hasBuckets}
              className={cn(
                'relative -mt-6 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all press-feedback',
                hasBuckets
                  ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              title="Add Transaction"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {/* Right side of nav */}
          <div className="flex items-center flex-1 h-full">
            <NavButton path="/wealth" icon={Wallet} label="Wealth" />
            {isMapleEnabled && <NavButton path="/buddy" icon={MessageSquare} label="Buddy" />}

            {/* More menu */}
            <div ref={moreRef} className="relative h-full">
              <button
                onClick={() => setShowMore(!showMore)}
                className={cn(
                  'flex flex-col items-center justify-center h-full gap-0.5 px-3 transition-colors',
                  isActive('/transactions') || isActive('/local-spend') || showMore
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px]">More</span>
              </button>

              {showMore && (
                <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border bg-popover shadow-lg overflow-hidden">
                  <button
                    onClick={() => navigate('/transactions')}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span>Transactions</span>
                  </button>
                  <button
                    onClick={() => navigate('/local-spend')}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Local Spend</span>
                  </button>
                </div>
              )}
            </div>

            <SaveIndicator />
          </div>
        </div>
      </nav>
    </>
  );
}
