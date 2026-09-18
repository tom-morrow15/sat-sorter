import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBudget } from '@/hooks/useBudget';

const TIP_STORAGE_KEY = 'sat-sorter-btc-tip';
const DISMISSED_KEY = 'sat-sorter-btc-tips-dismissed';

interface BtcTip {
  title: string;
  body: string;
}

// Rotating Bitcoin education facts. Only shown to users in USD mode
// (sats users are already on a Bitcoin standard).
const TIPS: BtcTip[] = [
  {
    title: '1 Bitcoin = 100 million sats',
    body: 'Just like 1 dollar = 100 cents. When you budget in sats, you\'re working with the smallest unit of Bitcoin.',
  },
  {
    title: 'Bitcoin has no CEO',
    body: 'No company, government, or person controls Bitcoin. It\'s a network maintained by thousands of computers worldwide.',
  },
  {
    title: 'Only 21 million Bitcoin will ever exist',
    body: 'Unlike dollars, which can be printed endlessly, Bitcoin has a fixed supply. This is why many people see it as a savings technology.',
  },
  {
    title: 'Your budget is stored on decentralized relays',
    body: 'Sat Sorter uses Nostr — a decentralized protocol. Your data isn\'t on a company server. It\'s on public relays that only you can read.',
  },
  {
    title: 'The dollar has lost 96% of its value since 1913',
    body: 'A dollar today buys what 4 cents bought in 1913. Bitcoin, by contrast, has been the best-performing asset of the last decade.',
  },
  {
    title: 'Lightning Network = instant, cheap Bitcoin payments',
    body: 'When you connect a Lightning wallet to Sat Sorter, transactions are recorded automatically. No banks, no fees, no waiting.',
  },
  {
    title: 'You can send Bitcoin to anyone, anywhere',
    body: 'No bank account needed. No borders. No permission required. That\'s financial freedom.',
  },
  {
    title: 'Sat Sorter encrypts everything on your device',
    body: 'Your budget data is encrypted before it ever leaves your browser. Even the relay operators can\'t read it.',
  },
];

export function BtcTipCard() {
  const { currency } = useBudget();
  const [dismissed, setDismissed] = useLocalStorage<boolean>(DISMISSED_KEY, false);
  const [tipIndex, setTipIndex] = useLocalStorage<number>(TIP_STORAGE_KEY, 0);

  // Pick a different tip each day (deterministic, not random on every render)
  const todayTip = useMemo(() => {
    const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return TIPS[dayOfYear % TIPS.length];
  }, []);

  // Advance the tip index once per day so returning users see something new
  useEffect(() => {
    const today = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const lastDay = Math.floor((tipIndex * 0) / 1); // placeholder - we use dayOfYear instead
    if (today !== lastDay) {
      setTipIndex((today) % TIPS.length);
    }
  }, [tipIndex, setTipIndex]);

  if (dismissed) return null;
  // Only show in USD mode — sats users are already Bitcoin-native
  if (currency !== 'usd') return null;

  return (
    <div className="relative animate-slide-in-up" style={{ animationDelay: '0.05s', animationFillMode: 'both' }}>
      <div className="flex items-start gap-3 p-4 pr-14 bh-card border-l-4 border-l-mustard">
        <div className="h-8 w-8 rounded-md bg-mustard/15 flex items-center justify-center shrink-0">
          <Lightbulb className="h-4 w-4 text-mustard" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {todayTip.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {todayTip.body}
          </p>
        </div>
      </div>
      {/* Dismiss button flush at the corner — hit area and glyph line up
          exactly where users instinctively tap */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-1 right-1 z-10 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
