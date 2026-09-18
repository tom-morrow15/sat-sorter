import { useEffect, useState } from 'react';
import { Bitcoin } from 'lucide-react';

/**
 * BitcoinIsmTicker — a passive, rotating footer of "bitcoin-isms": short,
 * memorable facts that teach new bitcoiners why Bitcoin is superior money.
 *
 * Replaces the old dismissible BtcTipCard banner (which interrupted the
 * budget on every app open) with something users can absorb at their own
 * pace at the bottom of the page.
 */

const ROTATE_MS = 8000;

const ISMS: string[] = [
  'Since 1913, the US dollar has lost over 96% of its purchasing power. Bitcoin fixes this.',
  'Only 21 million Bitcoin will ever exist. No one can print more.',
  'Governments can print trillions. Nobody can print a single extra sat.',
  'Bitcoin has no CEO, no bank, and no office hours.',
  '1 Bitcoin = 100 million sats — the smallest unit of money that can’t be inflated.',
  'You can send Bitcoin to anyone, anywhere, in minutes. No permission needed.',
  'Bitcoin runs on thousands of computers worldwide — no single point of failure.',
  'No one can freeze your Bitcoin wallet. Your money answers only to you.',
  'The Lightning Network makes Bitcoin payments instant and nearly free.',
  'Fiat loses value by design. Bitcoin is designed to hold it.',
  'In 2010, 10,000 BTC bought two pizzas. Bitcoin went on to become the best-performing asset in history.',
  'When you budget in sats, every sat you save is a sat that can’t be debased.',
];

export function BitcoinIsmTicker() {
  const [index, setIndex] = useState(() =>
    // Deterministic-per-day start, like the old daily tip — different each day,
    // same for the whole day, then it rotates live every ROTATE_MS.
    Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % ISMS.length
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ISMS.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="flex items-start justify-center gap-2 px-20 sm:px-6"
      aria-live="off"
    >
      <Bitcoin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
      {/* px-14 on mobile keeps text clear of the Budget Buddy button that
          floats in the bottom-right corner over the footer */}
      <p
        key={index}
        className="text-xs text-muted-foreground/70 italic leading-relaxed"
        style={{ animation: 'fadeIn 0.6s ease-in-out', animationFillMode: 'both' }}
      >
        {ISMS[index]}
      </p>
    </div>
  );
}
