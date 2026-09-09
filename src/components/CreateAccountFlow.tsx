import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  ChevronLeft,
  HelpCircle,
  Zap,
  Shield,
  Lock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateMnemonic, keysFromMnemonic, encryptSecretKey } from '@/utils/nostrAuth';
import { saveSession, generateSessionPassword } from '@/utils/sessionStore';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLoginActions } from '@/hooks/useLoginActions';
import { cn } from '@/lib/utils';

const MNEMONIC_WORDS = [4, 9, 12] as const;
const STEPS = [1, 2, 3] as const;

export function CreateAccountFlow() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboarding();
  const login = useLoginActions();

  const hasExtension = typeof window !== 'undefined' && 'nostr' in window;

  const handleExtensionLogin = async () => {
    try {
      await login.extension();
      navigate('/home', { replace: true });
    } catch {
      // User may have cancelled or extension not ready
    }
  };

  const [step, setStep] = useState(1);
  const [copiedNsec, setCopiedNsec] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [confirmWords, setConfirmWords] = useState<Record<number, string>>({
    [MNEMONIC_WORDS[0]]: '',
    [MNEMONIC_WORDS[1]]: '',
    [MNEMONIC_WORDS[2]]: '',
  });
  const [errors, setErrors] = useState<Record<number, string | null>>({
    [MNEMONIC_WORDS[0]]: null,
    [MNEMONIC_WORDS[1]]: null,
    [MNEMONIC_WORDS[2]]: null,
  });
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [showSats, setShowSats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mnemonic, keys } = useMemo(() => {
    const m = generateMnemonic();
    const k = keysFromMnemonic(m);
    return { mnemonic: m, keys: k };
  }, []);

  const mnemonicArray = mnemonic.split(' ');
  const nsec = keys.nsec;

  const handleCopyNsec = async () => {
    try {
      await navigator.clipboard.writeText(nsec);
      setCopiedNsec(true);
      setTimeout(() => setCopiedNsec(false), 2500);
    } catch {
      // Fallback: select text
    }
  };

  const handleConfirmWord = (wordNum: number, value: string) => {
    setConfirmWords((prev) => ({ ...prev, [wordNum]: value }));
    setErrors((prev) => ({ ...prev, [wordNum]: null }));
  };

  const handleVerify = () => {
    let hasError = false;
    for (const w of MNEMONIC_WORDS) {
      if (confirmWords[w].trim().toLowerCase() !== mnemonicArray[w - 1].toLowerCase()) {
        setErrors((prev) => ({ ...prev, [w]: `Word ${w} doesn't match your private key.` }));
        hasError = true;
      } else {
        setErrors((prev) => ({ ...prev, [w]: null }));
      }
    }
    if (!hasError) {
      setStep(3);
    }
  };

  const handleStartBudgeting = async () => {
    setIsSubmitting(true);
    try {
      const password = generateSessionPassword();
      const ncryptsec = encryptSecretKey(keys.secretKey, password);
      await saveSession(ncryptsec, password);

      localStorage.setItem('sat-sorter-display-name', displayName);
      localStorage.setItem('sat-sorter-currency', currency);
      localStorage.setItem('sat-sorter-show-sats', String(showSats));

      completeOnboarding({ ...keys, displayName, currency, showSats });
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Failed to save session:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const allWordsVerified = MNEMONIC_WORDS.every(
    (w) => confirmWords[w].trim().toLowerCase() === mnemonicArray[w - 1].toLowerCase()
  );

  const stepTitle = step === 1 ? 'Your private key' : step === 2 ? 'Confirm your key' : "You're all set";
  const stepSubtitle = step === 1 ? 'Step 1 of 3' : step === 2 ? 'Step 2 of 3' : 'Step 3 of 3';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header bar with brand continuity */}
      <header className="relative w-full bh-brand overflow-hidden shrink-0 border-b border-[hsl(var(--brand-border))]">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button
            onClick={() => (step === 1 ? navigate('/') : setStep(step - 1))}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors touch-target-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg tracking-tight text-white">Sat Sorter</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-background border-b pb-6 pt-8">
        <div className="flex items-center justify-center max-w-md mx-auto px-4">
          {STEPS.map((s, i) => {
            const isCompleted = step > s;
            const isActive = step === s;
            return (
              <div key={s} className="flex items-center">
                {/* Circle */}
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300',
                    isCompleted || isActive
                      ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-background border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : s}
                </div>
                {/* Connector */}
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-16 sm:w-24 h-[2px] mx-1 sm:mx-2 rounded transition-colors duration-300',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-4">
          <p className="text-xs text-muted-foreground font-medium tracking-wide">{stepSubtitle}</p>
          <h1 className="text-2xl font-serif tracking-tight mt-0.5">{stepTitle}</h1>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-xl">
        <div
          key={step}
          className={cn(
            step === 1 || step === 2 ? 'animate-slide-in-up' : 'animate-scale-in'
          )}
        >
          {/* === STEP 1: Backup phrase === */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Extension hint — shown if a NIP-07 extension is detected */}
              {hasExtension && (
                <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        We detected a browser extension
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You already have a Nostr key in your extension (like Alby). You can use your existing identity instead of creating a new one.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExtensionLogin}
                        >
                          Sign in with Extension
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mnemonic card */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Your private key</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Write these down in order. They're your only way to recover your account.
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {mnemonicArray.map((word, i) => (
                      <div
                        key={i}
                        className="relative bg-muted/40 border rounded-lg px-2 py-2.5 text-center group hover:border-primary/30 transition-colors"
                      >
                        <span className="absolute top-1 left-2 text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                          {i + 1}
                        </span>
                        <p className="text-sm font-semibold pt-3">{word}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Warning callout */}
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    There is no way to recover these if you lose them.
                  </p>
                  <p className="text-xs text-destructive/70 mt-1">
                    No password reset. No recovery email. Sat Sorter cannot restore access. Anyone who has them can access your account.
                  </p>
                </div>
              </div>

              {/* nsec section */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Also save your nsec</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                     A shorter format for copy/paste. Same account as your private key.
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted/40 border rounded-lg px-3 py-2.5 font-mono text-xs break-all">
                      {nsec}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyNsec}
                      className="shrink-0 h-auto"
                    >
                      {copiedNsec ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                    <p className="text-xs text-destructive/80 font-medium">
                      Keep both of these secret and safe. They are yours alone.
                    </p>
                    <p className="text-xs text-destructive/70">
                      There is no password reset, no recovery email, and no way for Sat Sorter to restore access if you lose them. Anyone who has them can access your account.
                    </p>
                    <p className="text-xs text-destructive/70">
                      Do not screenshot these. Do not store them in a digital photo, cloud note, or text message. Write them down on paper or save them in a dedicated password manager.
                    </p>
                  </div>
                </div>
              </div>

              {/* Backup checkbox */}
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-card/50">
                <Checkbox
                  id="backed-up"
                  checked={backedUp}
                  onCheckedChange={(v) => setBackedUp(Boolean(v))}
                  className="mt-0.5"
                />
                <Label htmlFor="backed-up" className="text-sm leading-relaxed cursor-pointer">
                  I've written down my private key and nsec, and I understand that only I am responsible for keeping them safe. Sat Sorter cannot recover them if lost.
                </Label>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!backedUp}
                className="w-full h-12 text-base font-semibold btn-interactive"
              >
                 I saved my private key — Continue
              </Button>
            </div>
          )}

          {/* === STEP 2: Confirm backup === */}
          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                 To make sure you saved your private key, enter the words at positions <strong className="text-foreground">4</strong>, <strong className="text-foreground">9</strong>, and <strong className="text-foreground">12</strong>.
              </p>

              <div className="space-y-4">
                {MNEMONIC_WORDS.map((wordNum) => (
                  <div key={wordNum} className="space-y-1.5">
                    <Label htmlFor={`word-${wordNum}`} className="text-sm font-medium">
                      Word {wordNum}
                    </Label>
                    <Input
                      id={`word-${wordNum}`}
                      value={confirmWords[wordNum]}
                      onChange={(e) => handleConfirmWord(wordNum, e.target.value)}
                      placeholder={`Enter word ${wordNum}`}
                      autoComplete="off"
                      className={cn(
                        'h-12 text-base font-medium',
                        errors[wordNum] ? 'border-destructive focus-visible:ring-destructive' : ''
                      )}
                    />
                    {errors[wordNum] && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {errors[wordNum]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground leading-relaxed">
                <p>
                   In a traditional app, you click "Forgot password?" to reset. Here, there's no reset — no company holds your keys. That's the point. That's what keeps your data private. It also means you're responsible for your private key.
                </p>
              </div>

              <Button
                onClick={handleVerify}
                disabled={!allWordsVerified}
                className="w-full h-12 text-base font-semibold btn-interactive"
              >
                Verify
              </Button>
            </div>
          )}

          {/* === STEP 3: You're all set === */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 pb-2">
                <div className="inline-flex h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/30 items-center justify-center mb-1">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your Nostr account is ready. Your budget data will be encrypted and synced across your devices.
                </p>
              </div>

              <div className="rounded-xl border bg-card/50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">What just happened:</h3>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    'Created cryptographic keys that only you hold',
                    'Backed them up with a private key',
                    'Set up encrypted syncing across your devices',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                No email. No tracking. No data harvesting.
              </p>

              {/* Settings form */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold">Quick preferences</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You can change these later in settings.
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-11 rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
                    >
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="GBP">GBP — British Pound</option>
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="AUD">AUD — Australian Dollar</option>
                      <option value="JPY">JPY — Japanese Yen</option>
                    </select>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="show-sats"
                      checked={showSats}
                      onCheckedChange={(v) => setShowSats(Boolean(v))}
                      className="mt-0.5"
                    />
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="show-sats" className="text-sm cursor-pointer">
                        Show sats
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="text-primary hover:text-primary/80 transition-colors"
                            aria-label="What's a sat?"
                          >
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-sm" side="top">
                          <p>
                            A "sat" (satoshi) is the smallest unit of Bitcoin — 1/100,000,000th of a bitcoin. Think of it like a cent, but for money no bank controls. Enabling this shows your spending in sats alongside dollars — a low-pressure way to start thinking in a sound money standard.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStartBudgeting}
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold btn-interactive"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : (
                  'Start Budgeting'
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
