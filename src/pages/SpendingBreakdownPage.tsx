import { useMemo, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import {
  Home, Car, Utensils, Heart, PiggyBank, Wallet, ShoppingBag, Briefcase,
  GraduationCap, Plane, Gift, Music, Dumbbell, Baby, Dog, Stethoscope,
  TrendingUp, TrendingDown, Minus, type LucideIcon,
} from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { SpendingGauge } from '@/components/budget/SpendingGauge';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { useBudget } from '@/hooks/useBudget';
import { deriveBudgetTotals, percentUsed } from '@/lib/budgetSelectors';
import { formatSats, usdToSats } from '@/hooks/useBitcoinPrice';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { formatMonth } from '@/lib/budgetTypes';

const iconMap: Record<string, LucideIcon> = {
  home: Home, car: Car, utensils: Utensils, heart: Heart, 'piggy-bank': PiggyBank,
  wallet: Wallet, 'shopping-bag': ShoppingBag, briefcase: Briefcase,
  'graduation-cap': GraduationCap, plane: Plane, gift: Gift, music: Music,
  dumbbell: Dumbbell, baby: Baby, dog: Dog, stethoscope: Stethoscope,
};

export default function SpendingBreakdownPage() {
  const { currentBudget, currency, currentMonth, toggleCurrency, setCurrentMonth, fullState } = useBudget();
  const { data: priceData } = useBitcoinPrice();
  const [showWalletModal, setShowWalletModal] = useState(false);

  useSeoMeta({ title: 'Spending Breakdown - Sat Sorter', description: 'See your spending breakdown by category.' });

  const handlePreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const btcPrice = priceData?.usdPerBtc ?? 0;

  const breakdownData = useMemo(() => {
    const totals = deriveBudgetTotals(currentBudget, btcPrice);
    return totals.expenseBuckets
      .map((bucket) => ({
        id: bucket.id, name: bucket.name, color: bucket.color, icon: bucket.icon,
        spentUsd: bucket.spentUsd, plannedUsd: bucket.budgetedUsd,
      }))
      .filter((item) => item.spentUsd > 0 || item.plannedUsd > 0)
      .sort((a, b) => b.spentUsd - a.spentUsd);
  }, [currentBudget, btcPrice]);

  const totalSpentUsd = useMemo(() => breakdownData.reduce((sum, item) => sum + item.spentUsd, 0), [breakdownData]);
  const totalBudgetUsd = useMemo(() => breakdownData.reduce((sum, item) => sum + item.plannedUsd, 0), [breakdownData]);

  const toDisplay = (usd: number): { value: number; label: string } => {
    if (currency === 'usd') {
      return {
        value: usd,
        label: usd.toLocaleString('en-US', {
          style: 'currency', currency: 'USD',
          minimumFractionDigits: usd >= 1000 ? 0 : 2,
          maximumFractionDigits: usd >= 1000 ? 0 : 2,
        }),
      };
    }
    const sats = btcPrice ? usdToSats(usd, btcPrice) : 0;
    return { value: sats, label: `${formatSats(sats)} sats` };
  };

  const totalSpentDisplay = toDisplay(totalSpentUsd);
  const totalBudgetDisplay = toDisplay(totalBudgetUsd);
  const gaugeSegments = breakdownData.map((b) => ({ id: b.id, color: b.color, value: toDisplay(b.spentUsd).value }));

  const monthLabel = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const trendData = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevBudget = fullState.budgets.find((b) => b.month === prevMonth);
    if (!prevBudget) return null;
    const prevTotals = deriveBudgetTotals(prevBudget, btcPrice);
    const prevSpent = prevTotals.spentUsd;
    const currentSpent = totalSpentUsd;
    if (prevSpent === 0) return null;
    const diff = currentSpent - prevSpent;
    const pctChange = Math.round((diff / prevSpent) * 100);
    return {
      prevMonth, prevMonthLabel: formatMonth(prevMonth),
      prevSpent, currentSpent, diff, pctChange,
      isUp: diff > 0, isFlat: Math.abs(pctChange) < 2,
    };
  }, [fullState.budgets, currentMonth, btcPrice, totalSpentUsd]);

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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-6">
        <div className="mb-4">
          <p className="bh-caption text-muted-foreground mb-1">Analysis</p>
          <h1 className="font-serif text-3xl leading-none">Breakdown</h1>
        </div>

        {breakdownData.length === 0 ? (
          <div className="surface-card text-center py-16 px-6 animate-slide-in-up" style={{ animationFillMode: 'both' }}>
            <p className="text-muted-foreground text-sm">No spending data yet for {monthLabel}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gauge card */}
            <section className="bh-card px-5 pt-6 pb-5 text-center animate-slide-in-up" style={{ animationFillMode: 'both' }}>
              <p className="bh-caption text-muted-foreground">
                {monthLabel}
              </p>
              <div className="mt-4">
                <SpendingGauge segments={gaugeSegments} size={320} thickness={24} gap={3}>
                  <p className="bh-caption text-muted-foreground">Spent</p>
                  <p className="text-3xl sm:text-4xl font-mono mt-1 leading-none">
                    {totalSpentDisplay.label}
                  </p>
                  {totalBudgetUsd > 0 && (
                    <p className="font-mono text-xs text-muted-foreground mt-2">
                      of {totalBudgetDisplay.label} budget
                    </p>
                  )}
                </SpendingGauge>
              </div>
            </section>

            {/* Trend card */}
            {trendData && (
              <section className="bh-card p-4 animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="bh-caption text-muted-foreground">vs Last Month</p>
                    <p className="text-xs text-muted-foreground mt-1">{trendData.prevMonthLabel}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {trendData.isFlat ? (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      ) : trendData.isUp ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-[hsl(var(--success))]" />
                      )}
                      <span className={`font-mono text-base ${
                        trendData.isFlat ? 'text-muted-foreground' : trendData.isUp ? 'text-destructive' : 'text-[hsl(var(--success))]'
                      }`}>
                        {trendData.isUp ? '+' : ''}{trendData.pctChange}%
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {toDisplay(trendData.diff).label} {trendData.isUp ? 'more' : 'less'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Category list */}
            <section className="animate-slide-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="bh-caption text-muted-foreground">
                  Spending Categories
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {breakdownData.length}
                </span>
              </div>
              <ul className="bh-card divide-y divide-border overflow-hidden">
                {breakdownData.map((item) => {
                  const Icon = iconMap[item.icon] || Wallet;
                  const spentDisplay = toDisplay(item.spentUsd);
                  const plannedDisplay = item.plannedUsd > 0 ? toDisplay(item.plannedUsd) : null;
                  const overBudget = item.plannedUsd > 0 && item.spentUsd > item.plannedUsd;
                  return (
                    <li key={item.id} className="relative flex items-center gap-3 py-3.5 pl-5 pr-4">
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                        style={{ backgroundColor: item.color }}
                      />
                      <div
                        className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 border"
                        style={{ backgroundColor: `${item.color}1f`, borderColor: `${item.color}55` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: item.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {plannedDisplay && (
                          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            of {plannedDisplay.label} budgeted
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono text-sm ${overBudget ? 'text-destructive' : ''}`}>
                          {spentDisplay.label}
                        </p>
                        {plannedDisplay && (
                          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            {percentUsed(item.spentUsd, item.plannedUsd)}%
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </main>

      {showWalletModal && (
        <WalletModalControlled open={showWalletModal} onOpenChange={setShowWalletModal} />
      )}
    </div>
  );
}
