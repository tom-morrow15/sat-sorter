import { useState } from 'react';
import {
  Bitcoin,
  Zap,
  Target,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Shield,
  PiggyBank,
  ListChecks,
  Cloud,
  DollarSign,
  TrendingDown,
  Menu,
  Key,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface OnboardingWelcomeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Sat Sorter',
    subtitle: 'Zero-based budgeting on a Bitcoin standard',
  },
  {
    id: 'what-is-zbb',
    title: 'What is Zero-Based Budgeting?',
    subtitle: 'A proven method for financial freedom',
  },
  {
    id: 'bitcoin-intro',
    title: 'Why Bitcoin?',
    subtitle: 'Sound money for sound budgeting',
  },
  {
    id: 'how-it-works',
    title: 'How It Works',
    subtitle: 'Give every sat a job',
  },
  {
    id: 'nostr-intro',
    title: 'Sync with Nostr',
    subtitle: 'Your data, your keys, your control',
  },
];

export function OnboardingWelcome({ open, onOpenChange, onComplete }: OnboardingWelcomeProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
      onOpenChange(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2 flex-shrink-0">
          <Progress value={progress} className="h-1" />
        </div>

        {/* Step content - scrollable */}
        <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
              {currentStep === 0 && <Zap className="h-6 w-6 text-primary" />}
              {currentStep === 1 && <Target className="h-6 w-6 text-primary" />}
              {currentStep === 2 && <Bitcoin className="h-6 w-6 text-primary" />}
              {currentStep === 3 && <ListChecks className="h-6 w-6 text-primary" />}
              {currentStep === 4 && <Key className="h-6 w-6 text-primary" />}
              {STEPS[currentStep].title}
            </DialogTitle>
            <DialogDescription className="text-base">
              {STEPS[currentStep].subtitle}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-xl bitcoin-glow">
                    <Zap className="h-12 w-12 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                    <Bitcoin className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-muted-foreground">
                  <strong>Sat Sorter</strong> helps you take control of your finances by
                  giving <em>every satoshi</em> a specific purpose before you spend it.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <FeatureBadge icon={Shield} text="100% Private" />
                  <FeatureBadge icon={Bitcoin} text="Bitcoin Native" />
                  <FeatureBadge icon={Zap} text="Lightning Ready" />
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                <p className="text-sm text-center">
                  💡 <strong>No account needed.</strong> Your data stays on your device.
                  Optionally sync with Nostr for backup across devices.
                </p>
                <p className="text-sm text-center">
                  🔄 <strong>Toggle between sats and USD</strong> anytime using the <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">₿<span className="text-muted-foreground/50">/</span>$</span> button in the header.
                  New to Bitcoin? Start with dollars while you get comfortable with sats!
                </p>
              </div>
            </div>
          )}

          {/* Step 2: What is ZBB */}
          {currentStep === 1 && (
            <div className="space-y-6 py-4">
              <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      The Core Principle
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <strong>Income − Expenses = 0</strong>
                      <br />
                      Every satoshi you earn gets assigned to a category until there's
                      nothing left to allocate. No more mystery money that vanishes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComparisonCard
                  type="bad"
                  title="Traditional Budgeting"
                  items={[
                    'Track spending after it happens',
                    'Hope you have money left',
                    'Wondering where it all went',
                  ]}
                />
                <ComparisonCard
                  type="good"
                  title="Zero-Based Budgeting"
                  items={[
                    'Plan every sat before spending',
                    'Know exactly what you have',
                    'Full control of your finances',
                  ]}
                />
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Used by cypherpunks, nostriches, and normies alike.
              </p>
            </div>
          )}

          {/* Step 3: Bitcoin Introduction */}
          {currentStep === 2 && (
            <div className="space-y-5 py-4">
              {/* Bitcoin vs Dollar comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                      <Bitcoin className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-orange-800 dark:text-orange-200">Bitcoin</span>
                  </div>
                  <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Fixed supply: 21 million</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Decentralized & borderless</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>You own your money</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Scarce = value preserved</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30 border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">US Dollar</span>
                  </div>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>Unlimited printing</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>Lost 96%+ value since 1913</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>Banks control access</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-500" />
                      <span>Inflation erodes savings</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* What are Sats */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">What's a "Sat"?</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      A <strong>satoshi</strong> (or "sat") is the smallest unit of Bitcoin.
                      Just like a dollar has 100 cents, 1 Bitcoin has 100,000,000 sats!
                    </p>
                    <div className="bg-muted p-2 rounded text-xs font-mono text-center">
                      1 BTC = 100,000,000 sats
                    </div>
                  </div>
                </div>
              </div>

              {/* Learn More callout */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground text-center">
                  💡 Want to learn more about Bitcoin? Tap the <Menu className="h-3 w-3 inline mx-0.5" /> menu
                  and select <strong>"Learn About Bitcoin"</strong> anytime!
                </p>
              </div>
            </div>
          )}

          {/* Step 4: How it works */}
          {currentStep === 3 && (
            <div className="space-y-5 py-4">
              <div className="space-y-4">
                <StepCard
                  number={1}
                  icon={Wallet}
                  title="Add Your Income"
                  description="Enter how many sats you expect to receive this month"
                  color="green"
                />
                <StepCard
                  number={2}
                  icon={PiggyBank}
                  title="Create Categories"
                  description="Set up buckets for Housing, Food, Savings, etc."
                  color="blue"
                />
                <StepCard
                  number={3}
                  icon={Target}
                  title="Assign Every Sat"
                  description="Distribute your income until 'Left to Budget' shows ₿0"
                  color="orange"
                />
                <StepCard
                  number={4}
                  icon={CheckCircle2}
                  title="Track & Adjust"
                  description="Record transactions and stay on track"
                  color="purple"
                />
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-300 text-center">
                  ✓ When your budget is <strong>"zeroed out"</strong>, every sat has a job!
                </p>
              </div>

              {/* Sync tip */}
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Save Your Changes</h4>
                    <p className="text-xs text-muted-foreground">
                      See the <strong>cloud button</strong> in the bottom-right corner? Tap it to sync
                      your budget to Nostr relays. Your changes auto-save after a few seconds, but you
                      can tap it anytime to save immediately. Log in with Nostr to sync across all your devices!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Nostr Introduction */}
          {currentStep === 4 && (
            <div className="space-y-5 py-4">
              {/* What is Nostr */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <Key className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">
                      What is Nostr?
                    </h4>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      Nostr is a simple, open protocol that enables truly censorship-resistant
                      and decentralized social networking and data storage. Think of it as
                      a universal login that <strong>you</strong> control.
                    </p>
                  </div>
                </div>
              </div>

              {/* Storage Options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Local Storage</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Without Nostr: Your budget is saved only in this browser.
                    Works offline, but data stays on this device.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Nostr Backup</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    With Nostr: Your encrypted data syncs across all your devices
                    via decentralized relays. Only you can decrypt it.
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Why use Nostr with Sat Sorter?</h4>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span><strong>Sync across devices</strong> — Phone, tablet, desktop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span><strong>End-to-end encrypted</strong> — Only your keys can read your data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span><strong>No central server</strong> — Your data, your relays, your choice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                    <span><strong>Never lose your budget</strong> — Recoverable with your Nostr key</span>
                  </li>
                </ul>
              </div>

              {/* Learn More callout */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground text-center">
                  💡 Learn more about Nostr in the <Menu className="h-3 w-3 inline mx-0.5" /> menu under
                  <strong> "Nostr Relay Sync"</strong> or check out <strong>"FAQ & Help"</strong>!
                </p>
              </div>

              {/* Sign Up CTA */}
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-orange-500/10 border border-primary/30">
                <h4 className="font-semibold text-sm mb-2 text-center">Ready to get started?</h4>
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Create a Nostr account with Primal (free, 30 seconds) or continue without an account.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => window.open('https://primal.net/downloads', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Get Primal (Recommended)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onComplete();
                      onOpenChange(false);
                    }}
                  >
                    Continue Without Account
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Navigation buttons - sticky at bottom */}
        <div className="flex items-center justify-between p-4 border-t bg-background flex-shrink-0 safe-bottom">
          <div>
            {currentStep === 0 ? (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip Tour
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handlePrevious}>
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Step indicators */}
            <div className="flex gap-1.5 mr-4">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    idx === currentStep
                      ? 'bg-primary'
                      : idx < currentStep
                        ? 'bg-primary/50'
                        : 'bg-muted-foreground/20'
                  )}
                />
              ))}
            </div>

            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Budgeting
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper components

function FeatureBadge({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
      <Icon className="h-4 w-4 text-primary" />
      <span>{text}</span>
    </div>
  );
}

function ComparisonCard({
  type,
  title,
  items,
}: {
  type: 'good' | 'bad';
  title: string;
  items: string[];
}) {
  const isGood = type === 'good';
  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        isGood
          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
      )}
    >
      <h4
        className={cn(
          'font-semibold text-sm mb-2',
          isGood ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
        )}
      >
        {isGood ? '✓' : '✗'} {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={cn(
              'text-xs flex items-start gap-1.5',
              isGood ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            )}
          >
            <span className="mt-0.5">{isGood ? '•' : '•'}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  description,
  color,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <div
        className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
          colorClasses[color]
        )}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Step {number}</span>
        </div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function QuickStartItem({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg">
      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
