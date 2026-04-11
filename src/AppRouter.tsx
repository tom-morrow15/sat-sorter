import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { MainLayout } from "./components/layout/MainLayout";

import HomePage from "./pages/HomePage";
import SpendingBreakdownPage from "./pages/SpendingBreakdownPage";
import LocalSpendPage from "./pages/LocalSpendPage";
import TransactionsPage from "./pages/TransactionsPage";
import WealthTrackerPage from "./pages/WealthTrackerPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
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

         {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;