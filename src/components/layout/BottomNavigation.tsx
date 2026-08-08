import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, Cloud, CloudOff, RefreshCw, MoreHorizontal, MapPin, Receipt, Wallet, MessageSquare, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetAutoSave } from '@/hooks/useBudgetAutoSave';
import { useAddTransaction } from '@/components/budget/AddTransactionProvider';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { currentBudget } = useBudget();
  const { openAddTransaction } = useAddTransaction() ?? {};

  const { status: autoSaveStatus, canAutoSave } = useBudgetAutoSave(undefined);

  const isActive = (path: string) => location.pathname === path;
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setShowMore(false); }, [location.pathname]);

  const handleAddTransaction = () => openAddTransaction?.();
  const hasBuckets = currentBudget.buckets.length > 0;

  const moreItems = [
    { path: '/transactions', icon: Receipt, label: 'Transactions' },
    { path: '/wealth', icon: Wallet, label: 'Wealth' },
    { path: '/buddy', icon: MessageSquare, label: 'Budget Buddy' },
    { path: '/local-spend', icon: MapPin, label: 'Local Spend' },
  ];

  const isMoreActive = moreItems.some(item => isActive(item.path));

  const NavButton = ({ path, icon: Icon, label }: { path: string; icon: typeof Home; label: string }) => {
    const active = isActive(path);
    return (
      <button
        onClick={() => navigate(path)}
        className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-target relative"
      >
        <div className={cn(
          'flex items-center justify-center h-8 w-12 rounded-full transition-all',
          active ? 'bg-primary/12 text-primary' : 'text-muted-foreground'
        )}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
        </div>
        <span className={cn('text-[10px] font-medium leading-none', active ? 'text-primary' : 'text-muted-foreground')}>
          {label}
        </span>
      </button>
    );
  };

  const syncConfig = {
    idle: { icon: Cloud, color: 'text-muted-foreground/50', label: 'Synced' },
    saving: { icon: RefreshCw, color: 'text-primary animate-spin', label: 'Saving' },
    saved: { icon: Cloud, color: 'text-success', label: 'Saved' },
    error: { icon: CloudOff, color: 'text-destructive', label: 'Error' },
    offline: { icon: CloudOff, color: 'text-muted-foreground/50', label: 'Offline' },
  }[autoSaveStatus];

  const SyncIcon = syncConfig.icon;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-md relative flex items-center h-16">
        <NavButton path="/home" icon={Home} label="Home" />
        <NavButton path="/breakdown" icon={PieChart} label="Breakdown" />

        {/* Center FAB */}
        <div className="relative flex items-center justify-center w-16 shrink-0">
          <button
            onClick={handleAddTransaction}
            disabled={!hasBuckets}
            className={cn(
              'relative -mt-7 h-14 w-14 rounded-2xl flex items-center justify-center transition-all press-feedback touch-target',
              hasBuckets
                ? 'bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.6)] hover:scale-105 active:scale-95'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            title="Add Transaction"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>

        {/* More + Sync */}
        <div ref={moreRef} className="contents">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-target"
          >
            <div className={cn(
              'flex items-center justify-center h-8 w-12 rounded-full transition-all',
              (isMoreActive || showMore) ? 'bg-primary/12 text-primary' : 'text-muted-foreground'
            )}>
              <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={(isMoreActive || showMore) ? 2.4 : 2} />
            </div>
            <span className={cn('text-[10px] font-medium leading-none', (isMoreActive || showMore) ? 'text-primary' : 'text-muted-foreground')}>
              More
            </span>
          </button>

          {showMore && (
            <div className="absolute bottom-full right-2 mb-3 w-52 rounded-2xl border border-border/60 bg-popover shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)] overflow-hidden animate-scale-in origin-bottom-right">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3.5 text-sm transition-colors text-left touch-target-sm',
                      active ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sync indicator */}
        <button
          className="flex flex-col items-center justify-center gap-1 px-2.5 shrink-0 touch-target-sm"
          title={!user ? 'Log in with Nostr to enable cloud sync' : !canAutoSave ? 'Cloud sync unavailable' : `Cloud sync: ${syncConfig.label}`}
        >
          <SyncIcon className={cn('h-4 w-4', !user || !canAutoSave ? 'text-muted-foreground/30' : syncConfig.color)} />
          <span className={cn('text-[9px] leading-none', !user || !canAutoSave ? 'text-muted-foreground/30' : syncConfig.color)}>
            {!user ? 'Offline' : !canAutoSave ? 'Offline' : syncConfig.label}
          </span>
        </button>
      </div>
    </nav>
  );
}
