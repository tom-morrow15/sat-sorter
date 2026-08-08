import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { Sidebar } from './Sidebar';
import { PartnerSyncWrapper } from '@/components/budget/PartnerSyncWrapper';
import { AddTransactionProvider } from '@/components/budget/AddTransactionProvider';
import { BudgetBuddyFAB } from '@/components/maple/BudgetBuddyFAB';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed opaque top bar to protect Dynamic Island / notch */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] bg-black xl:hidden"
        style={{ height: 'env(safe-area-inset-top)' }}
      />

      <PartnerSyncWrapper>
        <AddTransactionProvider>
          {/* Desktop persistent sidebar (>=1200px) */}
          <Sidebar />

          {/* Content — shifted right on desktop to make room for the sidebar */}
          <div className="xl:pl-64">
            <div
              className="pb-24 xl:pb-8"
              style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
            >
              {children}
            </div>
          </div>

          {/* Floating Budget Buddy button (mobile/tablet only) */}
          <div className="xl:hidden">
            <BudgetBuddyFAB />
          </div>

          {/* Bottom Navigation — hidden on desktop */}
          <div className="xl:hidden">
            <BottomNavigation />
          </div>
        </AddTransactionProvider>
      </PartnerSyncWrapper>
    </div>
  );
}
