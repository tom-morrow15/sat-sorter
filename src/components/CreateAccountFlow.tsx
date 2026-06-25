import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, ChevronLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateMnemonic, keysFromMnemonic, encryptSecretKey } from '@/utils/nostrAuth';
import { saveSession } from '@/utils/sessionStore';
import { useOnboarding } from '@/contexts/OnboardingContext';

const MNEMONIC_WORDS = [4, 9, 12] as const;

function generateBrowserPassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function CreateAccountFlow() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboarding();

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

  // Generate mnemonic and derive keys once
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
        setErrors((prev) => ({ ...prev, [w]: `Word ${w} doesn't match your backup phrase.` }));
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
      const password = generateBrowserPassword();
      const ncryptsec = encryptSecretKey(keys.secretKey, password);
      await saveSession(ncryptsec, password);

      // Store display preferences in localStorage
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-0.5 rounded transition-colors ${
                    s < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Back button */}
        <button
          onClick={() => (step === 1 ? navigate('/') : setStep(step - 1))}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 1 ? 'Back to welcome' : 'Back'}
        </button>

        {/* === STEP 1: Show backup phrase === */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Step 1 of 3</p>
              <h2 className="text-2xl font-bold tracking-tight">Your backup phrase</h2>
            </div>

            {/* Mnemonic grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {mnemonicArray.map((word, i) => (
                <div
                  key={i}
                  className="bg-muted/50 border rounded-lg px-3 py-2 text-center"
                >
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <p className="text-sm font-medium">{word}</p>
                </div>
              ))}
            </div>

            {/* Warning callout */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                These words ARE your account. Anyone who has them can access your budget. Keep them safe. We don't have a copy and can't reset them.
              </p>
            </div>

            {/* nsec section */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Also: your nsec</h3>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 font-mono text-xs break-all">
                  {nsec}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyNsec}
                  className="shrink-0"
                >
                  {copiedNsec ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This long string starting with 'nsec' is your private key — a computer-readable version of the same account the 12 words unlock.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="font-medium block">12 words</span>
                  <span className="text-muted-foreground">= master key (for humans, write on paper)</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="font-medium block">nsec</span>
                  <span className="text-muted-foreground">= daily key (for apps, copy/paste to sign in quickly)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You can use either to sign into any Nostr app — including Sat Sorter. Most apps accept both.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
                <p className="text-xs text-destructive font-medium">
                  Treat your nsec like the 12 words: never share it, screenshot it, or store it online.
                </p>
              </div>
            </div>

            {/* Backup checkbox */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="backed-up"
                checked={backedUp}
                onCheckedChange={(v) => setBackedUp(Boolean(v))}
              />
              <Label htmlFor="backed-up" className="text-sm cursor-pointer">
                I've written down my 12 words and saved my nsec securely.
              </Label>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!backedUp}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {/* === STEP 2: Confirm backup === */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Step 2 of 3</p>
              <h2 className="text-2xl font-bold tracking-tight">Confirm your backup</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              To make sure you saved your phrase, enter word 4, word 9, and word 12.
            </p>

            <div className="space-y-4">
              {MNEMONIC_WORDS.map((wordNum) => (
                <div key={wordNum} className="space-y-1.5">
                  <Label htmlFor={`word-${wordNum}`}>Word {wordNum}</Label>
                  <Input
                    id={`word-${wordNum}`}
                    value={confirmWords[wordNum]}
                    onChange={(e) => handleConfirmWord(wordNum, e.target.value)}
                    placeholder={`Enter word ${wordNum}`}
                    autoComplete="off"
                    className={errors[wordNum] ? 'border-destructive' : ''}
                  />
                  {errors[wordNum] && (
                    <p className="text-xs text-destructive">{errors[wordNum]}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>
                Why this matters: In a traditional app, if you forget your password, you click 'Forgot password?' and get a reset email. Here, there's no reset button — because there's no company holding your keys. That's what keeps your data private. It also means you're responsible for your backup.
              </p>
            </div>

            <Button
              onClick={handleVerify}
              disabled={!allWordsVerified}
              className="w-full"
            >
              Verify
            </Button>
          </div>
        )}

        {/* === STEP 3: You're all set === */}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Step 3 of 3</p>
              <h2 className="text-2xl font-bold tracking-tight">You're all set.</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm">
                Your Nostr account has been created. Your budget data is encrypted and synced across your devices.
              </p>

              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold">What you just did:</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Created cryptographic keys that only you hold</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Backed them up with a 12-word phrase</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>Set up encrypted syncing across your devices</span>
                  </li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                No email. No tracking. No data harvesting. Just you and your money.
              </p>
            </div>

            {/* Setup form */}
            <div className="space-y-4 border rounded-xl p-5">
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
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="show-sats"
                  checked={showSats}
                  onCheckedChange={(v) => setShowSats(Boolean(v))}
                />
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="show-sats" className="text-sm cursor-pointer">
                    Show sats
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-primary hover:text-primary/80 transition-colors" aria-label="What's a sat?">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-sm" side="top">
                      <p>
                        A 'sat' (short for satoshi) is the smallest unit of Bitcoin — 1/100,000,000th of a bitcoin. Think of it like a cent to a dollar, but for digital money that no government or bank controls. If you enable this, Sat Sorter will show your spending in sats alongside dollars. It's a low-pressure way to start thinking in a sound money standard. You can turn it off anytime.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartBudgeting}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Setting up...' : 'Start Budgeting'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
