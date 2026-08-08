import { useSeoMeta } from '@unhead/react';
import { MapPin, Settings2 } from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { MerchantGrid } from '@/components/budget/MerchantGrid';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { Button } from '@/components/ui/button';
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
        showStatStrip={false}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-6">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="bh-caption text-muted-foreground mb-1">Discover</p>
              <h1 className="font-serif text-3xl leading-none">Local Spend</h1>
              <p className="text-muted-foreground text-sm mt-2">
                Find Bitcoin-accepting merchants and businesses near you
              </p>
            </div>
            {hasLocation && (
              <Button
                variant="outline"
                onClick={() => setShowLocationSetup(true)}
                className="whitespace-nowrap touch-target-sm"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Change Location
              </Button>
            )}
          </div>

          {/* Location Info */}
          {hasLocation && (
            <div className="bh-panel flex items-center gap-2 py-3 px-4 border-l-4 border-l-primary">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm">
                Showing merchants within <span className="font-mono">{settings.radiusMiles} mi</span> of <span className="font-medium">{settings.locationName}</span>
              </span>
            </div>
          )}

          {/* No location prompt */}
          {!hasLocation && (
            <div className="bh-panel py-4 px-4 border-l-4 border-l-primary">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Set your location</p>
                    <p className="text-xs text-muted-foreground">
                      Tell us where you are to find nearby Bitcoin merchants
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowLocationSetup(true)} className="whitespace-nowrap touch-target-sm">
                  Set Location
                </Button>
              </div>
            </div>
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
