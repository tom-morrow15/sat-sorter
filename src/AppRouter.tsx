import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { MainLayout } from "./components/layout/MainLayout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CreateAccountFlow } from "./components/CreateAccountFlow";
import { SignInScreen } from "./components/SignInScreen";
import { useOnboarding } from "./contexts/OnboardingContext";

import HomePage from "./pages/HomePage";
import SpendingBreakdownPage from "./pages/SpendingBreakdownPage";
import LocalSpendPage from "./pages/LocalSpendPage";
import TransactionsPage from "./pages/TransactionsPage";
import WealthTrackerPage from "./pages/WealthTrackerPage";
import BuddyPage from "./pages/BuddyPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

function AppContent() {
  const { state, setGuestMode } = useOnboarding();

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'welcome') {
    return <WelcomeScreen onGuestMode={setGuestMode} />;
  }

  return (
    <Routes>
      {/* Onboarding routes - no MainLayout (no bottom nav during setup) */}
      <Route path="/create-account" element={<CreateAccountFlow />} />
      <Route path="/sign-in" element={<SignInScreen />} />

      {/* Root redirect to home */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* App pages - with bottom navigation */}
      <Route
        path="/home"
        element={
          <MainLayout>
            <HomePage />
          </MainLayout>
        }
      />
      <Route
        path="/breakdown"
        element={
          <MainLayout>
            <SpendingBreakdownPage />
          </MainLayout>
        }
      />
      <Route
        path="/local-spend"
        element={
          <MainLayout>
            <LocalSpendPage />
          </MainLayout>
        }
      />
      <Route
        path="/transactions"
        element={
          <MainLayout>
            <TransactionsPage />
          </MainLayout>
        }
      />
      <Route
        path="/wealth"
        element={
          <MainLayout>
            <WealthTrackerPage />
          </MainLayout>
        }
      />
      <Route
        path="/buddy"
        element={
          <MainLayout>
            <BuddyPage />
          </MainLayout>
        }
      />

      {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
      <Route path="/:nip19" element={<NIP19Page />} />

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppContent />
    </BrowserRouter>
  );
}
export default AppRouter;
