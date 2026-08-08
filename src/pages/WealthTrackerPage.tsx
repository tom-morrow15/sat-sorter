import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { useBudget } from '@/hooks/useBudget';
import { useWealthTracker } from '@/hooks/useWealthTracker';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { AddAddressDialog } from '@/components/wealth/AddAddressDialog';
import { WealthChart } from '@/components/wealth/WealthChart';
import { WealthSummaryWidget } from '@/components/wealth/WealthSummaryWidget';
import { AddressListItem } from '@/components/wealth/AddressListItem';

export default function WealthTrackerPage() {
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const { currentBudget, currentMonth, currency, toggleCurrency, setCurrentMonth } = useBudget();
  const { data: priceData } = useBitcoinPrice();
  const {
    watchedAddresses,
    balanceHistory,
    wealthSummary,
    liveBalancesById,
    isLoadingBalances,
    isFetchingBalances,
    balanceError,
    lastSyncTime,
    addAddress,
    removeAddress,
    updateAddressLabel,
    refetchBalances,
  } = useWealthTracker();

  useSeoMeta({
    title: 'Wealth Tracker - Sat Sorter',
    description: 'Monitor your Bitcoin addresses and track your wealth over time.',
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

  const handleSaveLabel = (addressId: string) => {
    if (editingLabel.trim()) {
      updateAddressLabel(addressId, editingLabel);
      setEditingId(null);
      setEditingLabel('');
    }
  };

  const lastSyncLabel = lastSyncTime
    ? new Date(lastSyncTime * 1000).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-background">
      <BudgetHeader
        buckets={currentBudget.buckets}
        currentMonth={currentMonth}
        currency={currency}
        onToggleCurrency={toggleCurrency}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onOpenWallet={() => {}}
        onSelectMonth={setCurrentMonth}
        showStatStrip={false}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-6">
        <div className="mb-4">
          <p className="bh-caption text-muted-foreground mb-1">Holdings</p>
          <h1 className="font-serif text-3xl leading-none">Wealth Tracker</h1>
        </div>

        <div className="space-y-4">
          {(lastSyncLabel || watchedAddresses.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {lastSyncLabel ? `Last synced ${lastSyncLabel}` : 'Monitor your Bitcoin holdings'}
              </p>
              {watchedAddresses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchBalances()}
                  disabled={isFetchingBalances}
                  className="gap-2 touch-target-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingBalances ? 'animate-spin' : ''}`} />
                  {isFetchingBalances ? 'Refreshing…' : 'Refresh'}
                </Button>
              )}
            </div>
          )}

          {/* Error alert */}
          {balanceError && watchedAddresses.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Couldn&apos;t fetch balances from the blockchain. Check your connection and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Wealth Summary */}
          {wealthSummary && <WealthSummaryWidget summary={wealthSummary} priceData={priceData} />}

          {/* Wealth Chart */}
          {watchedAddresses.length > 0 && (
            <WealthChart
              watchedAddresses={watchedAddresses}
              balanceHistory={balanceHistory}
            />
          )}

          {/* Address Manager */}
          <div className="surface-card p-5">
            <div className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <h2 className="font-display text-base">Watched Addresses</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {watchedAddresses.length > 0
                    ? `Tracking ${watchedAddresses.length} address${watchedAddresses.length !== 1 ? 'es' : ''}`
                    : 'No addresses monitored yet'}
                </p>
              </div>
              <Button onClick={() => setShowAddAddress(true)} className="gap-2 touch-target-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Address</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>

            <div>
              {watchedAddresses.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium mb-1">No addresses added yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Add Bitcoin addresses to start tracking your wealth
                  </p>
                  <Button onClick={() => setShowAddAddress(true)} size="sm">
                    Add Your First Address
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchedAddresses.map((address) => {
                    const liveSats = liveBalancesById.get(address.id);
                    const hasLive = liveSats !== undefined;
                    const usd =
                      hasLive && priceData
                        ? (liveSats / 100_000_000) * priceData.usdPerBtc
                        : undefined;

                    return (
                      <AddressListItem
                        key={address.id}
                        address={address}
                        isEditing={editingId === address.id}
                        editingLabel={editingLabel}
                        balanceSats={hasLive ? liveSats : undefined}
                        balanceUsd={usd}
                        isLoading={isLoadingBalances || (isFetchingBalances && !hasLive)}
                        onEditStart={() => {
                          setEditingId(address.id);
                          setEditingLabel(address.label);
                        }}
                        onEditChange={setEditingLabel}
                        onEditSave={() => handleSaveLabel(address.id)}
                        onEditCancel={() => {
                          setEditingId(null);
                          setEditingLabel('');
                        }}
                        onRemove={removeAddress}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="surface-card p-5 bg-primary/[0.03]">
            <div className="text-sm space-y-2">
              <p className="font-display text-base">How it works</p>
              <ul className="text-xs space-y-1.5 text-muted-foreground list-disc list-inside">
                <li>Add any Bitcoin address (Legacy, SegWit, or Bech32)</li>
                <li>Balances are fetched from the blockchain via mempool.space</li>
                <li>Historical snapshots track changes over time</li>
                <li>Click Refresh to pull the latest balances on demand</li>
                <li>Your data is stored locally in your browser</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Add Address Dialog */}
      <AddAddressDialog
        open={showAddAddress}
        onOpenChange={setShowAddAddress}
        onAdd={addAddress}
      />
    </div>
  );
}
