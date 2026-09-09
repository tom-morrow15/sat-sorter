import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Zap, Key, Shield, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseKeyInput, encryptSecretKey } from '@/utils/nostrAuth';
import { saveSession, generateSessionPassword } from '@/utils/sessionStore';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLoginActions } from '@/hooks/useLoginActions';

export function SignInScreen() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOnboarding();
  const login = useLoginActions();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSignIn = async () => {
    setError(null);

    let trimmed = input.trim();
    // Strip "nostr:" URI prefix if present (NIP-21)
    if (trimmed.startsWith('nostr:')) {
      trimmed = trimmed.slice(6).trim();
    }

    if (!trimmed) {
      setError('Please enter your private key.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse the key first — this is fast and validates the input
      const keys = parseKeyInput(trimmed);

      // Log in immediately so the user is authenticated without waiting
      // for the expensive scrypt-based session encryption
      login.nsec(keys.nsec);

      // Transition the onboarding state to 'authenticated' so the router
      // switches to app routes
      completeOnboarding({
        ...keys,
        displayName: '',
        currency: 'USD',
        showSats: false,
      });

      // Navigate to home immediately — the user is now logged in
      navigate('/home', { replace: true });

      // Save the encrypted session in the background (non-blocking).
      // This is the expensive scrypt operation (N=2^16) that can take
      // several seconds on mobile devices. We do it after navigation
      // so the user sees the app immediately.
      // Use setTimeout to yield to the event loop first.
      setTimeout(() => {
        try {
          const password = generateSessionPassword();
          const ncryptsec = encryptSecretKey(keys.secretKey, password);
          saveSession(ncryptsec, password).catch((e) => {
            console.warn('[SignInScreen] Background session save failed:', e);
          });
        } catch (e) {
          console.warn('[SignInScreen] Background session encryption failed:', e);
        }
      }, 100);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not parse your input. Please check your private key and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header bar */}
      <header className="relative w-full bh-brand overflow-hidden shrink-0 border-b border-[hsl(var(--brand-border))]">
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors touch-target-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg tracking-tight text-white">Sat Sorter</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto px-4 py-8 sm:py-12 max-w-lg w-full">
        <div className="animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          {/* Header block */}
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 rounded-md bg-primary/10 border border-primary/25 items-center justify-center mb-4">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-serif tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Paste your private key to restore your account.
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
                placeholder="Enter your private key (nsec1..., 12-word phrase, or hex)..."
                className="min-h-[140px] font-mono text-sm resize-none bg-muted/20 border-muted-foreground/20 focus:bg-background"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Your private key can be in any format — all unlock the same account.
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
                    onClick={async () => {
                      try {
                        login.extension();
                      } catch {
                        // ignore; user may not have extension
                      }
                      navigate('/home', { replace: true });
                    }}
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
