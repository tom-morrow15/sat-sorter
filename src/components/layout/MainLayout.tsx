import { ReactNode } from 'react';
import { BottomNavigation } from './BottomNavigation';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Main content - with padding for fixed bottom nav */}
      <div className="pb-24">
        {children}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
