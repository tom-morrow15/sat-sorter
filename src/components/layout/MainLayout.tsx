import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { PartnerSyncWrapper } from '@/components/budget/PartnerSyncWrapper';
import { AddTransactionProvider } from '@/components/budget/AddTransactionProvider';
import { BudgetBuddyFAB } from '@/components/maple/BudgetBuddyFAB';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed opaque top bar to protect Dynamic Island / notch — matches header */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] bg-black"
        style={{ height: 'env(safe-area-inset-top)' }}
      />

      <PartnerSyncWrapper>
        <AddTransactionProvider>
          {/* Main content - with padding for fixed bottom nav (+ iOS safe area) */}
          <div style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
            {children}
          </div>

          {/* Floating Budget Buddy button */}
          <BudgetBuddyFAB />

          {/* Bottom Navigation with central FAB */}
          <BottomNavigation />
        </AddTransactionProvider>
      </PartnerSyncWrapper>
    </div>
  );
}
