import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PieChart, Receipt, Wallet, MessageSquare, MapPin, Plus,
  Bitcoin, Zap, Cloud, CloudOff, RefreshCw,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetAutoSave } from '@/hooks/useBudgetAutoSave';
import { useAppContext } from '@/hooks/useAppContext';
import { useAddTransaction } from '@/components/budget/AddTransactionProvider';
import { cn } from '@/lib/utils';

/**
 * Persistent left sidebar for desktop widths (>= 1200px).
 * Ink-black rail with the full nav list. Mirrors bottom-nav destinations.
 */
export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { currentBudget } = useBudget();
  const { config, updateConfig } = useAppContext();
  const { openAddTransaction } = useAddTransaction() ?? {};
  const { status: autoSaveStatus, canAutoSave } = useBudgetAutoSave(undefined);

  const isActive = (path: string) => location.pathname === path;
  const hasBuckets = currentBudget.buckets.length > 0;
  const logoStyle = config.logoStyle || 'sats';

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/breakdown', icon: PieChart, label: 'Breakdown' },
    { path: '/transactions', icon: Receipt, label: 'Transactions' },
    { path: '/wealth', icon: Wallet, label: 'Wealth Tracker' },
    { path: '/buddy', icon: MessageSquare, label: 'Budget Buddy' },
    { path: '/local-spend', icon: MapPin, label: 'Local Spend' },
  ];

  const syncConfig = {
    idle: { icon: Cloud, color: 'text-white/40', label: 'Synced' },
    saving: { icon: RefreshCw, color: 'text-primary animate-spin', label: 'Saving' },
    saved: { icon: Cloud, color: 'text-[hsl(var(--success))]', label: 'Saved' },
    error: { icon: CloudOff, color: 'text-destructive', label: 'Error' },
    offline: { icon: CloudOff, color: 'text-white/40', label: 'Offline' },
  }[autoSaveStatus];
  const SyncIcon = syncConfig.icon;

  return (
    <aside className="hidden xl:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bh-brand border-r border-[hsl(var(--brand-border))]">
      {/* Logo */}
      <button
        onClick={() => navigate('/home')}
        className="flex items-center gap-2.5 h-16 px-5 border-b border-[hsl(var(--brand-border))] shrink-0"
      >
        <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
          {logoStyle === 'bitcoin' ? (
            <Bitcoin className="h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
          ) : (
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.2} />
          )}
        </div>
        <span className="font-serif text-xl text-white leading-none">Sat Sorter</span>
      </button>

      {/* Add Transaction — primary action */}
      <div className="px-3 pt-4">
        <button
          onClick={() => openAddTransaction?.()}
          disabled={!hasBuckets}
          className={cn(
            'w-full flex items-center gap-2.5 h-11 px-3 rounded-md text-sm font-medium transition-colors',
            hasBuckets
              ? 'bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          )}
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
          Add Transaction
        </button>
      </div>

      {/* Nav list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium transition-colors relative',
                active ? 'bg-white/8 text-white' : 'text-white/55 hover:text-white hover:bg-white/5'
              )}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-sm bg-primary" />}
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.3 : 2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sync footer */}
      <div className="px-5 py-4 border-t border-[hsl(var(--brand-border))] shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <SyncIcon className={cn('h-4 w-4', !user || !canAutoSave ? 'text-white/25' : syncConfig.color)} />
          <span className={cn(!user || !canAutoSave ? 'text-white/25' : syncConfig.color)}>
            {!user ? 'Offline' : !canAutoSave ? 'Offline' : syncConfig.label}
          </span>
        </div>
      </div>
    </aside>
  );
}
