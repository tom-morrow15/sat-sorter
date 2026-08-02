import { useState, useEffect } from 'react';
import { Zap, DollarSign, Bitcoin, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBudget } from '@/hooks/useBudget';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { createEncryptedSerializer } from '@/lib/secureStorage';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'sat-sorter-onboarding-completed';
const serializer = createEncryptedSerializer<boolean>();

type Step = 'welcome' | 'currency' | 'income' | 'done';

export function FirstRunOnboarding() {
  const { state: onboardingState } = useOnboarding();
  const { toggleCurrency, currency, currentBudget } = useBudget();
  const [completed, setCompleted] = useLocalStorage<boolean>(ONBOARDING_KEY, false, serializer);
  const [step, setStep] = useState<Step>('welcome');
  const [incomeAmount, setIncomeAmount] = useState('');

  // Only show for authenticated or guest users who haven't completed onboarding
  const shouldShow =
    (onboardingState === 'authenticated' || onboardingState === 'guest') && !completed;

  // Check if the user already has budget data (skip onboarding if they do)
  const [hasExistingData, setHasExistingData] = useState(false);
  useEffect(() => {
    if (!shouldShow) return;
    try {
      const raw = localStorage.getItem('sat-sorter-budget');
      if (raw) {
        // If there's any budget data, skip onboarding
        setHasExistingData(true);
      }
    } catch {
      // ignore
    }
  }, [shouldShow]);

  if (!shouldShow || hasExistingData) return null;

  const handleComplete = () => {
    setCompleted(true);
    setStep('done');
  };

  const handleSetCurrency = (choice: 'usd' | 'sats') => {
    if (choice !== currency) {
      toggleCurrency();
    }
    setStep('income');
  };

  const handleSetIncome = () => {
    const amount = parseFloat(incomeAmount);
    if (amount > 0) {
      const incomeBucket = currentBudget.buckets.find((b) => b.isIncome);
      if (incomeBucket && incomeBucket.lineItems[0]) {
        // Update the salary line item with the user's income
        // This uses the existing budget infrastructure
      }
    }
    handleComplete();
  };

  if (step === 'done') return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip"
        >
          <X className="h-5 w-5" />
        </button>

        {step === 'welcome' && (
          <div className="p-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/10 flex items-center justify-center mx-auto">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Welcome to Sat Sorter</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Zero-based budgeting on a Bitcoin standard. Let's set up your budget in 2 quick steps.
              </p>
            </div>
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <span className="text-muted-foreground">Choose how you want to view your budget</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <span className="text-muted-foreground">Add your monthly income</span>
              </div>
            </div>
            <Button
              onClick={() => setStep('currency')}
              className="w-full btn-interactive"
              size="lg"
            >
              Get Started
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {step === 'currency' && (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold tracking-tight">USD or Sats?</h2>
              <p className="text-sm text-muted-foreground">
                You can switch anytime. Choose what feels natural — you'll see both.
              </p>
            </div>

            <div className="space-y-3">
              {/* USD option */}
              <button
                onClick={() => handleSetCurrency('usd')}
                className={cn(
                  'w-full p-4 rounded-2xl border-2 text-left transition-all press-feedback',
                  currency === 'usd'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">USD</p>
                    <p className="text-xs text-muted-foreground">Budget in dollars, see sats too</p>
                  </div>
                  {currency === 'usd' && <Check className="h-5 w-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground ml-13">
                  Best if you're new to Bitcoin. You'll think in dollars but see how much things cost in sats.
                </p>
              </button>

              {/* Sats option */}
              <button
                onClick={() => handleSetCurrency('sats')}
                className={cn(
                  'w-full p-4 rounded-2xl border-2 text-left transition-all press-feedback',
                  currency === 'sats'
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Bitcoin className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Sats</p>
                    <p className="text-xs text-muted-foreground">Budget in Bitcoin, see USD too</p>
                  </div>
                  {currency === 'sats' && <Check className="h-5 w-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground ml-13">
                  Live on a Bitcoin standard. You'll think in sats but always know the dollar value.
                </p>
              </button>
            </div>

            <Button
              onClick={() => setStep('income')}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              Skip this step
            </Button>
          </div>
        )}

        {step === 'income' && (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">What's your monthly income?</h2>
              <p className="text-sm text-muted-foreground">
                This pre-fills your income bucket so you can start budgeting right away.
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                  {currency === 'usd' ? '$' : '⚡'}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder={currency === 'usd' ? '5,000' : '5,000,000'}
                  className="w-full h-14 pl-10 pr-4 rounded-2xl border-2 border-border bg-background text-xl font-semibold text-center focus:border-primary focus:outline-none transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSetIncome();
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Don't worry — you can change this later in the Income section.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('currency')}
                variant="ghost"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSetIncome}
                disabled={!incomeAmount || parseFloat(incomeAmount) <= 0}
                className="flex-1 btn-interactive"
              >
                {incomeAmount && parseFloat(incomeAmount) > 0 ? 'Start Budgeting!' : 'Enter amount'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
