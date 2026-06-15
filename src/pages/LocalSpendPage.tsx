import { useSeoMeta } from '@unhead/react';
import { MapPin, Settings2 } from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { MerchantGrid } from '@/components/budget/MerchantGrid';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBudget } from '@/hooks/useBudget';
import { useBTCMap, useLocationSettings } from '@/hooks/useBTCMap';
import { LocationSetup } from '@/components/budget/LocationSetup';
import { useState } from 'react';

export default function LocalSpendPage() {
  const { currentBudget, currency, currentMonth, toggleCurrency, setCurrentMonth } = useBudget();
  const { hasLocation } = useBTCMap();
  const { settings } = useLocationSettings();
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useSeoMeta({
    title: 'Spend Bitcoin Locally - Sat Sorter',
    description: 'Find places to spend Bitcoin in your area.',
  });

  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(
      `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <BudgetHeader
        buckets={currentBudget.buckets}
        currentMonth={currentMonth}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onOpenWallet={() => setShowWalletModal(true)}
        onSelectMonth={setCurrentMonth}
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 lg:py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Spend Bitcoin Locally</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Find Bitcoin-accepting merchants and businesses near you
              </p>
            </div>
            {hasLocation && (
              <Button
                variant="outline"
                onClick={() => setShowLocationSetup(true)}
                className="whitespace-nowrap"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Change Location
              </Button>
            )}
          </div>

          {/* Location Info Card */}
          {hasLocation && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-orange-500/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm">
                    Showing merchants within <span className="font-semibold">{settings.radiusMiles} miles</span> of <span className="font-semibold">{settings.locationName}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No location prompt */}
          {!hasLocation && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-orange-500/5 to-amber-500/5">
              <CardContent className="py-4 px-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Set your location</p>
                      <p className="text-xs text-muted-foreground">
                        Tell us where you are to find nearby Bitcoin merchants
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setShowLocationSetup(true)} className="whitespace-nowrap">
                    Set Location
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Merchant Grid - only show when location is set */}
          {hasLocation && <MerchantGrid />}
        </div>
      </main>

      {/* Location Setup Dialog */}
      <LocationSetup open={showLocationSetup} onOpenChange={setShowLocationSetup} />

      {/* Wallet / Data Sources modal */}
      {showWalletModal && (
        <WalletModalControlled
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
        />
      )}
    </div>
  );
}
