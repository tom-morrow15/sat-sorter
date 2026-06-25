import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Zap, Key, Shield, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseKeyInput, encryptSecretKey } from '@/utils/nostrAuth';
import { saveSession } from '@/utils/sessionStore';
import { useOnboarding } from '@/contexts/OnboardingContext';

function generateBrowserPassword(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function SignInScreen() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboarding();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSignIn = async () => {
    setError(null);

    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter your 12-word seed phrase or nsec.');
      return;
    }

    setIsSubmitting(true);
    try {
      const keys = parseKeyInput(trimmed);
      const password = generateBrowserPassword();
      const ncryptsec = encryptSecretKey(keys.secretKey, password);
      await saveSession(ncryptsec, password);

      completeOnboarding({
        ...keys,
        displayName: '',
        currency: 'USD',
        showSats: false,
      });

      navigate('/home', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not parse your input. Please check your seed phrase or nsec and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header bar */}
      <header className="relative w-full bg-header-gradient text-white overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-mesh-gradient opacity-30 pointer-events-none" />
        <div className="relative z-10 container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Sat Sorter</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-lg">
        <div className="animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          {/* Header block */}
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 border border-primary/10 items-center justify-center mb-4">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Paste your 12-word seed phrase or nsec to restore your account.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border bg-card shadow-sm p-5 sm:p-6 space-y-4 animate-slide-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <div className="space-y-2">
              <label htmlFor="key-input" className="text-sm font-medium">
                Your private key
              </label>
              <Textarea
                id="key-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your 12-word seed phrase, nsec1..., or 64-character hex key..."
                className="min-h-[140px] font-mono text-sm resize-none bg-muted/20 border-muted-foreground/20 focus:bg-background"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                12 words, nsec, or hex — all unlock the same account.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex gap-2.5 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isSubmitting || !input.trim()}
              className="w-full h-12 text-base font-semibold btn-interactive"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </div>

          {/* Help section */}
          <div className="mt-6 space-y-4 animate-slide-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            {/* Info card */}
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">Your key stays on your device.</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We never see, store, or transmit it. It's encrypted in your browser with a random session password. Sat Sorter cannot decrypt it without your browser.
                  </p>
                </div>
              </div>
            </div>

            {/* Extension sign-in */}
            <div className="rounded-xl border bg-card p-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Sign in with a browser extension
                </span>
                <span className="text-xs">{showAdvanced ? 'Hide' : 'Show'}</span>
              </button>
              {showAdvanced && (
                <div className="mt-3 pt-3 border-t animate-fade-in">
                  <p className="text-xs text-muted-foreground mb-3">
                    If you have a NIP-07 extension (Alby, nos2x, etc.), you can sign in without pasting your key.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/home', { replace: true })}
                  >
                    Use NIP-07 extension
                  </Button>
                </div>
              )}
            </div>

            {/* No account link */}
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  to="/create-account"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
