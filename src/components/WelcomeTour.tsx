import { useState } from 'react';
import {
  Zap, DollarSign, Bitcoin, Shield, Plus, Copy, Calendar, Receipt,
  Scissors, Filter, CreditCard, Wallet, TrendingUp, MapPin, Users,
  MessageSquare, RotateCw, ChevronLeft, ChevronRight, Check, X, Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface WelcomeTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TourStep {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  howTo: string;
  /** If true, shows a "Nostr account required" badge on this step */
  needsNostr?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: Zap,
    iconColor: 'text-primary',
    title: 'Zero-Based Budgeting',
    description: 'Every satoshi gets a job before you spend it. Assign all your income to categories until your remaining balance hits zero. This ensures no money is unaccounted for.',
    howTo: 'Add income to the Income category, then assign amounts to expense categories until "Left" shows zero.',
  },
  {
    icon: DollarSign,
    iconColor: 'text-[hsl(var(--success))]',
    title: 'USD / Bitcoin Toggle',
    description: 'Switch between viewing your budget in dollars or sats anytime. Both values are always shown — you just pick which one feels natural to think in.',
    howTo: 'Tap the USD/BTC toggle in the top bar. Your choice persists across all screens.',
  },
  {
    icon: Shield,
    iconColor: 'text-petrol',
    title: 'Why Nostr?',
    description: 'Your budget is encrypted and stored on decentralized Nostr relays — not on a company server. Only you can read your data with your private key. No email, no tracking, no lock-in.',
    howTo: 'Your Nostr login (nsec) is your key. Keep it safe — it controls access to your budget and identity.',
    needsNostr: true,
  },
  {
    icon: Heart,
    iconColor: 'text-amber-500',
    title: 'Value for Value',
    description: 'Sat Sorter is free forever — 5 buckets with 4 line items each, no strings attached.\n\nNeed more? Unlock extra buckets with sats: $1 gets you +1 bucket, $5 gets you unlimited for the month. No auto-pay, no recurring charges — you only pay when you need more, only for the month you need it.\n\nYour first month is a free trial with unlimited everything. We call this "value for value" — we provide the tool, and if you find it valuable, sending sats keeps us building.',
    howTo: 'When you hit the 5-bucket limit, tap "Add Category" and choose a Power-Up. Manage your access in the hamburger menu → Power-Ups & Access.',
  },
  {
    icon: Plus,
    iconColor: 'text-primary',
    title: 'Setting Up Your Budget',
    description: 'Start by adding income, then create expense categories like Groceries, Rent, and Savings. Each category can have multiple line items for granular tracking.\n\nNote: The free tier includes 5 categories with 4 line items each. If you need more, you can unlock additional categories with a Power-Up.',
    howTo: 'Tap "Add Category" on the Home screen, pick an icon and color, then add line items within each category.',
  },
  {
    icon: Copy,
    iconColor: 'text-primary',
    title: 'Copy Previous Month',
    description: 'Don\'t rebuild your budget from scratch every month. Copy last month\'s categories and amounts to the current month with one tap, then adjust as needed.',
    howTo: 'Open the hamburger menu → Budget Tools → Copy Previous Month. Great for recurring expenses like rent and subscriptions.',
  },
  {
    icon: Calendar,
    iconColor: 'text-primary',
    title: 'Plan Next Month',
    description: 'Get ahead by copying your current budget to next month before the month starts. You\'ll start each month ready, with all your categories pre-filled.',
    howTo: 'Open the hamburger menu → Budget Tools → Plan Next Month. Your categories and amounts carry over automatically.',
  },
  {
    icon: Receipt,
    iconColor: 'text-primary',
    title: 'Adding Transactions',
    description: 'Log every purchase by entering the amount, description, and assigning it to a budget category. The amount is deducted from that category\'s available balance.',
    howTo: 'Tap the + button in the bottom navigation bar. Enter the amount, add a description, and pick a category.',
  },
  {
    icon: Scissors,
    iconColor: 'text-petrol',
    title: 'Transaction Splits',
    description: 'Went to Costco and bought groceries, household items, and electronics? Split one transaction across multiple categories so each gets its proper share.',
    howTo: 'When adding a transaction, tap "Split across categories" to divide the total among multiple line items.',
  },
  {
    icon: Filter,
    iconColor: 'text-primary',
    title: 'Transactions Tab',
    description: 'View all transactions for the month, search and filter by category, and see which transactions still need to be categorized.',
    howTo: 'Tap "More" in the bottom nav → Transactions. Use the search bar to find specific transactions or filter by category.',
  },
  {
    icon: CreditCard,
    iconColor: 'text-primary',
    title: 'Payment Methods',
    description: 'Track how you paid — credit card, cash, Lightning, etc. This helps you understand your spending patterns across different payment types.',
    howTo: 'Open the hamburger menu → Budget Tools → Payment Methods. Add your common payment methods for quick selection when logging transactions.',
  },
  {
    icon: Wallet,
    iconColor: 'text-primary',
    title: 'Lightning Wallet',
    description: 'Connect a Lightning wallet (via Nostr Wallet Connect) to automatically track Bitcoin payments. Transactions are imported and categorized automatically.',
    howTo: 'Open the hamburger menu → Budget Tools → Lightning Wallet. Scan your NWC connection QR code from your wallet app.',
    needsNostr: true,
  },
  {
    icon: TrendingUp,
    iconColor: 'text-primary',
    title: 'Wealth Tracker',
    description: 'Monitor your Bitcoin holdings across multiple on-chain addresses. Balances are fetched from mempool.space and tracked over time.',
    howTo: 'Tap "More" in the bottom nav → Wealth Tracker. Add any Bitcoin address to start watching its balance.',
  },
  {
    icon: MapPin,
    iconColor: 'text-primary',
    title: 'Local Bitcoin Spending',
    description: 'Find Bitcoin-accepting merchants near you using BTC Map. Discover where you can actually spend your sats in the real world.',
    howTo: 'Tap "More" in the bottom nav → Local Spend. Set your location to see nearby merchants organized by category.',
  },
  {
    icon: Users,
    iconColor: 'text-petrol',
    title: 'Budget Partners',
    description: 'Share your budget with a partner — like a spouse — so you both see the same categories and transactions. Changes sync automatically across devices.',
    howTo: 'Open the hamburger menu → Budget Partners → Share Budget Key (QR). Your partner scans it to join. Use Force Sync if changes aren\'t appearing.',
    needsNostr: true,
  },
  {
    icon: MessageSquare,
    iconColor: 'text-primary',
    title: 'Budget Buddy',
    description: 'Your AI-powered budget assistant. Ask it questions about your spending, get savings suggestions, and analyze your budget — all privately.',
    howTo: 'Tap "More" in the bottom nav → Budget Buddy. Add an AI API key in the settings to get started.',
    needsNostr: true,
  },
  {
    icon: RotateCw,
    iconColor: 'text-muted-foreground',
    title: 'Refreshing the App',
    description: 'When a new version is deployed, refresh to get the latest updates without losing your data. Your budget and login are preserved.',
    howTo: 'Open the hamburger menu → Settings → Refresh the app. Your data stays safe — only the app code updates.',
  },
];

export function WelcomeTour({ open, onOpenChange }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onOpenChange(false);
  };

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col p-0 overflow-hidden [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Sat Sorter Welcome Tour</DialogTitle>
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-serif text-base">Sat Sorter Tour</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className={`h-7 w-7 ${step.iconColor}`} />
              </div>
            </div>

            <h2 className="font-serif text-xl text-center tracking-tight">{step.title}</h2>

            {step.needsNostr && (
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium">
                  <Shield className="h-3 w-3" />
                  Nostr account required
                </span>
              </div>
            )}

            <p className="text-sm text-muted-foreground text-center leading-relaxed whitespace-pre-wrap">
              {step.description}
            </p>

            <div className="bg-muted/30 border border-border/40 rounded-md p-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">How to use it</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.howTo}</p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="touch-target-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleNext}
            className="touch-target-sm"
          >
            {isLast ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Done
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
