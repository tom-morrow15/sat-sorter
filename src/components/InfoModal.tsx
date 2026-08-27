import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional action for the primary footer button (e.g. proceed to create account). If omitted, just closes. */
  onConfirm?: () => void;
}

export function InfoModal({ isOpen, onClose, title, children, onConfirm }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-[hsl(var(--brand)/0.7)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col bg-card rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-xl font-serif tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed space-y-4 text-foreground/90">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0">
          <Button onClick={onConfirm ?? onClose} className="w-full">
            I understand — let's go
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Specific Modal Content Components
   ================================================================ */

export function NostrInfoContent() {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-base font-semibold mb-2">Most apps work like this:</h3>
        <p className="text-muted-foreground">
          You create an account with your email. The company stores everything — your budget, your habits, your identity — on their servers. If they shut down, raise prices, or sell your data, you're stuck.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-2">Nostr works differently:</h3>
        <p className="text-muted-foreground">
          Instead of an email and password, you hold a cryptographic key — like a digital signature that proves you're you. Your budget data is encrypted and stored on public relays. No company sits between you and your money.
        </p>
        <p className="text-muted-foreground mt-2">
          The relays can't read your data. Sat Sorter can't read your data. Only you, with your private key, can unlock it.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-2">In practice, this means:</h3>
        <ul className="space-y-1.5 ml-1">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>No email. No phone number. No personal info.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Your data is encrypted before it ever leaves your device.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>You can leave Sat Sorter anytime and take your data with you — it's yours.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Use your Nostr account across other apps too. It's not locked to us.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Nobody can sell, mine, or lose your data.</span>
          </li>
        </ul>
      </section>

      <p className="text-muted-foreground">
        Nostr isn't a company. It's an open protocol — like email or the web itself. No one owns it, and no one can take it away.
      </p>

      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <p className="text-sm font-medium text-destructive">
          Your 12-word backup is the only key. Lose it = lose access. We can't reset it, because we don't have it. That's the point.
        </p>
      </div>
    </div>
  );
}

export function DifferenceInfoContent() {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-3 font-semibold text-destructive/80">Traditional Budgeting Apps</th>
              <th className="text-left py-2 pl-3 font-semibold text-primary">Sat Sorter + Nostr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Email sign-up required</td>
              <td className="py-2.5 pl-3">No email, no phone, no PII</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Your data lives on their server</td>
              <td className="py-2.5 pl-3">Your data lives encrypted on public relays</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">They can read your budget</td>
              <td className="py-2.5 pl-3">Nobody but you can decrypt it</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Data sold or mined for ads</td>
              <td className="py-2.5 pl-3">Data is unreadable to anyone else</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">If they shut down, you lose everything</td>
              <td className="py-2.5 pl-3">Your data is portable. Take it anywhere.</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Account locked to one app</td>
              <td className="py-2.5 pl-3">You hold the keys. Use them in other apps.</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">They can ban or deplatform you</td>
              <td className="py-2.5 pl-3">Nobody can revoke your account</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">If it's free, you're the product</td>
              <td className="py-2.5 pl-3">Built on open source and open standards</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Forces one currency view</td>
              <td className="py-2.5 pl-3">USD and Bitcoin side by side — learn a Bitcoin standard at your own pace</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-3 text-muted-foreground">Helps you spend — that's it</td>
              <td className="py-2.5 pl-3">Helps you spend — and understand sound money</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground">
        Your budget is deeply personal. Where you spend your money reveals what you value, where you live, what you earn, who you support. That data shouldn't sit on someone else's server where it can be sold, leaked, or mined. With Sat Sorter, your budget is yours. Full stop.
      </p>
    </div>
  );
}

export function PrivacyPromiseContent() {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-base font-semibold mb-2">Sat Sorter cannot:</h3>
        <ul className="space-y-1.5 ml-1">
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>Read your budget</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>See your transactions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>Access your Nostr keys</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>Reset or recover your account</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>Sell, share, or mine your data</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-0.5 shrink-0">•</span>
            <span>Lock you in — your data is portable</span>
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-semibold mb-2">Sat Sorter can:</h3>
        <ul className="space-y-1.5 ml-1">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Help you track your spending in USD and sats</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Show you what it looks like to live on a Bitcoin standard — and why that matters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Help you find and support local businesses that accept Bitcoin</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Publish your encrypted data to relays so you can sync across devices</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Give you total freedom to budget your way — categories, currency views, no rules forced on you</span>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border bg-muted/30 p-4">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <span className="text-primary">🔐</span> Don't trust — verify
        </h3>
        <p className="text-muted-foreground mb-2">
          All encryption happens on your device. Your unencrypted data never leaves your browser. You don't have to trust our word — you can verify it yourself.
        </p>
        <ul className="space-y-1.5 ml-1">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Our code is open source. You can inspect every line.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>Encryption is performed by your browser, not our servers.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>We literally cannot read your data even if we wanted to.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>This is a promise — but also a provable fact.</span>
          </li>
        </ul>
      </section>

      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <p className="text-sm font-medium text-destructive">
          One thing we can't do: If you lose your private key, we cannot recover your account or your data. We don't have your keys. That's by design. This is not a bug — it's the feature that keeps your data truly private.
        </p>
      </div>
    </div>
  );
}
