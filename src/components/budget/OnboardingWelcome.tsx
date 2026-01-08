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
    id: 'how-it-works',
    title: 'How It Works',
    subtitle: 'Give every sat a job',
  },
  {
    id: 'get-started',
    title: "Let's Get Started",
    subtitle: 'Your first budget in 3 easy steps',
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
              {currentStep === 2 && <ListChecks className="h-6 w-6 text-primary" />}
              {currentStep === 3 && <Sparkles className="h-6 w-6 text-primary" />}
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

          {/* Step 3: How it works */}
          {currentStep === 2 && (
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
            </div>
          )}

          {/* Step 4: Get Started */}
          {currentStep === 3 && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <p className="text-muted-foreground">
                  You're ready to start budgeting! Here's your quick-start checklist:
                </p>
              </div>

              <div className="space-y-3">
                <QuickStartItem
                  step={1}
                  title="Set your income"
                  description="Click on the Income bucket and enter your monthly sats"
                />
                <QuickStartItem
                  step={2}
                  title="Plan your expenses"
                  description="Assign amounts to each category until you hit zero"
                />
                <QuickStartItem
                  step={3}
                  title="Connect your wallet (optional)"
                  description="Auto-import Lightning transactions with NWC"
                />
              </div>

              <div className="p-4 bg-muted rounded-xl space-y-2">
                <p className="text-sm font-medium">💡 Pro Tips:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Start with the essentials: housing, food, bills</li>
                  <li>• Don't forget to enhance your strategic bitcoin reserve!</li>
                  <li>• It's okay to adjust as you go — that's the point</li>
                  <li>• Stay humble and stack sats</li>
                </ul>
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

            <Button onClick={handleNext}>
              {currentStep === STEPS.length - 1 ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Budgeting
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
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
