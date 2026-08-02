import { useMemo, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import {
  Home,
  Car,
  Utensils,
  Heart,
  PiggyBank,
  Wallet,
  ShoppingBag,
  Briefcase,
  GraduationCap,
  Plane,
  Gift,
  Music,
  Dumbbell,
  Baby,
  Dog,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { SpendingGauge } from '@/components/budget/SpendingGauge';
import { WalletModalControlled } from '@/components/budget/WalletModalControlled';
import { MapleInsightsCard } from '@/components/maple/MapleInsightsCard';
import { useBudget } from '@/hooks/useBudget';
import { deriveBudgetTotals, percentUsed } from '@/lib/budgetSelectors';
import { formatSats, usdToSats } from '@/hooks/useBitcoinPrice';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { formatMonth } from '@/lib/budgetTypes';

// Same icon map as BucketCard so the visuals stay consistent across the app.
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  car: Car,
  utensils: Utensils,
  heart: Heart,
  'piggy-bank': PiggyBank,
  wallet: Wallet,
  'shopping-bag': ShoppingBag,
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  plane: Plane,
  gift: Gift,
  music: Music,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  stethoscope: Stethoscope,
};

export default function SpendingBreakdownPage() {
  const { currentBudget, currency, currentMonth, toggleCurrency, setCurrentMonth, fullState } = useBudget();
  const { data: priceData } = useBitcoinPrice();
  const [showWalletModal, setShowWalletModal] = useState(false);

  useSeoMeta({
    title: 'Spending Breakdown - Sat Sorter',
    description: 'See your spending breakdown by category.',
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

  const btcPrice = priceData?.usdPerBtc ?? 0;

  // Build per-category data from the SHARED selector so these numbers match the
  // Home dashboard and Maple exactly. All amounts are USD-anchored (the stored
  // source of truth); sats are derived from USD only for the sats-view label.
  const breakdownData = useMemo(() => {
    const totals = deriveBudgetTotals(currentBudget, btcPrice);
    return totals.expenseBuckets
      .map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        color: bucket.color,
        icon: bucket.icon,
        spentUsd: bucket.spentUsd,
        plannedUsd: bucket.budgetedUsd,
      }))
      .filter((item) => item.spentUsd > 0 || item.plannedUsd > 0)
      .sort((a, b) => b.spentUsd - a.spentUsd);
  }, [currentBudget, btcPrice]);

  const totalSpentUsd = useMemo(
    () => breakdownData.reduce((sum, item) => sum + item.spentUsd, 0),
    [breakdownData]
  );

  const totalBudgetUsd = useMemo(
    () => breakdownData.reduce((sum, item) => sum + item.plannedUsd, 0),
    [breakdownData]
  );

  // Format a USD value for display in the active currency. In USD mode the
  // exact stored dollars are shown; in sats mode the USD is converted to sats.
  const toDisplay = (usd: number): { value: number; label: string } => {
    if (currency === 'usd') {
      return {
        value: usd,
        label: usd.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
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

  // Gauge segments — use display values so the arc matches what the user sees.
  const gaugeSegments = breakdownData.map((b) => ({
    id: b.id,
    color: b.color,
    value: toDisplay(b.spentUsd).value,
  }));

  const monthLabel = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  // Month-over-month trend: compare current month's spending vs previous month
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
      prevMonth: prevMonth,
      prevMonthLabel: formatMonth(prevMonth),
      prevSpent,
      currentSpent,
      diff,
      pctChange,
      isUp: diff > 0,
      isFlat: Math.abs(pctChange) < 2,
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

      <main className="container mx-auto max-w-2xl px-4 py-6 lg:py-10">
        {breakdownData.length === 0 ? (
          <div className="text-center py-24">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Spending Breakdown</h1>
            <p className="text-muted-foreground">No spending data yet for {monthLabel}.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Gauge card */}
            <section className="rounded-2xl bg-card border border-border/60 px-6 pt-8 pb-6 shadow-sm">
              <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {monthLabel}
              </p>

              <div className="mt-6">
                <SpendingGauge
                  segments={gaugeSegments}
                  size={360}
                  thickness={26}
                  gap={3}
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Spent
                  </p>
                  <p className="text-4xl sm:text-5xl font-bold tabular-nums mt-1 leading-none">
                    {totalSpentDisplay.label}
                  </p>
                  {totalBudgetUsd > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                      of {totalBudgetDisplay.label} budget
                    </p>
                  )}
                </SpendingGauge>
              </div>
            </section>

            {/* Month-over-month trend */}
            {trendData && (
              <section className="rounded-2xl bg-card border border-border/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      vs Last Month
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {trendData.prevMonthLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {trendData.isFlat ? (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      ) : trendData.isUp ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          trendData.isFlat
                            ? 'text-muted-foreground'
                            : trendData.isUp
                            ? 'text-destructive'
                            : 'text-green-500'
                        }`}
                      >
                        {trendData.isUp ? '+' : ''}
                        {trendData.pctChange}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {toDisplay(trendData.diff).label}{' '}
                      {trendData.isUp ? 'more' : 'less'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Maple Insights — temporarily hidden */}
            {false && <MapleInsightsCard />}

            {/* Categories list */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Spending Categories
                </h2>
                <span className="text-xs text-muted-foreground">
                  {breakdownData.length} {breakdownData.length === 1 ? 'category' : 'categories'}
                </span>
              </div>

              <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden shadow-sm">
                {breakdownData.map((item) => {
                  const Icon = iconMap[item.icon] || Wallet;
                  const spentDisplay = toDisplay(item.spentUsd);
                  const plannedDisplay = item.plannedUsd > 0 ? toDisplay(item.plannedUsd) : null;
                  const overBudget = item.plannedUsd > 0 && item.spentUsd > item.plannedUsd;

                  return (
                    <li
                      key={item.id}
                      className="relative flex items-center gap-3 py-4 pl-5 pr-4"
                    >
                      {/* Colored left accent bar */}
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                        style={{ backgroundColor: item.color }}
                      />

                      {/* Icon chip */}
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}1f` }} // ~12% alpha
                      >
                        <Icon className="h-5 w-5" style={{ color: item.color }} />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {plannedDisplay && (
                          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                            of {plannedDisplay.label} budgeted
                          </p>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            overBudget ? 'text-destructive' : ''
                          }`}
                        >
                          {spentDisplay.label}
                        </p>
                        {plannedDisplay && (
                          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
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
        <WalletModalControlled
          open={showWalletModal}
          onOpenChange={setShowWalletModal}
        />
      )}
    </div>
  );
}
