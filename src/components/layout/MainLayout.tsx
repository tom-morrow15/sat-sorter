import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';
import { PartnerSyncWrapper } from '@/components/budget/PartnerSyncWrapper';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed opaque top bar to protect Dynamic Island / notch */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b"
        style={{ height: 'env(safe-area-inset-top)' }}
      />

      {/* PartnerSyncWrapper: real-time budget sync between partners.
          Mounted globally so sync works on every page, not just the budget page. */}
      <PartnerSyncWrapper>
        {/* Main content - with padding for fixed bottom nav (+ iOS safe area) */}
        <div style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </PartnerSyncWrapper>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
