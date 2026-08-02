import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PieChart, MapPin, Receipt, Wallet, MessageSquare, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBudget } from '@/hooks/useBudget';
import { useMapleSettings } from '@/hooks/useMapleSettings';
import { useBudgetAutoSave } from '@/hooks/useBudgetAutoSave';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { fullState } = useBudget();
  const { isMapleEnabled } = useMapleSettings();

  // Auto-save: budget syncs to Nostr automatically 8s after changes.
  // No manual save button needed — just a status indicator.
  const { status: autoSaveStatus, canAutoSave } = useBudgetAutoSave(fullState);

  const isActive = (path: string) => location.pathname === path;

  // Save indicator: shows cloud sync status
  const SaveIndicator = () => {
    if (!user) return null;
    if (!canAutoSave) return null;

    const config = {
      idle: { icon: Cloud, color: 'text-muted-foreground/50', label: 'Auto-save' },
      saving: { icon: RefreshCw, color: 'text-primary animate-spin', label: 'Saving' },
      saved: { icon: Cloud, color: 'text-green-500', label: 'Saved' },
      error: { icon: CloudOff, color: 'text-red-500', label: 'Sync error' },
      offline: { icon: CloudOff, color: 'text-muted-foreground/50', label: 'Offline' },
    }[autoSaveStatus];

    const Icon = config.icon;

    return (
      <div className="flex flex-col items-center justify-center gap-0.5 px-2">
        <Icon className={cn('h-4 w-4', config.color)} />
        <span className={cn('text-[9px]', config.color)}>{config.label}</span>
      </div>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16">
        <button
          onClick={() => navigate('/home')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/home') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => navigate('/breakdown')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/breakdown') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <PieChart className="h-5 w-5" />
          <span className="text-[10px]">Breakdown</span>
        </button>

        <button
          onClick={() => navigate('/local-spend')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/local-spend') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <MapPin className="h-5 w-5" />
          <span className="text-[10px]">Local</span>
        </button>

        <button
          onClick={() => navigate('/transactions')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/transactions') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[10px]">Transactions</span>
        </button>

        <button
          onClick={() => navigate('/wealth')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
            isActive('/wealth') ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          <Wallet className="h-5 w-5" />
          <span className="text-[10px]">Wealth</span>
        </button>

        {isMapleEnabled && (
          <button
            onClick={() => navigate('/buddy')}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-0.5',
              isActive('/buddy') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px]">Buddy</span>
          </button>
        )}

        <SaveIndicator />
      </div>
    </nav>
  );
}
