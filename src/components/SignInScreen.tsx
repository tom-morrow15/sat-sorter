import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Zap, Key, Shield, ExternalLink, Sparkles, ChevronDown, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  const [bunkerUri, setBunkerUri] = useState('');
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('key');

  const hasExtension = typeof window !== 'undefined' && 'nostr' in window;

  // ─── NIP-07 Extension login ──────────────────────────────────────────────
  const handleExtensionLogin = async () => {
    setExtensionError(null);
    setIsSubmitting(true);
    try {
      if (!hasExtension) {
        throw new Error('Nostr extension not found. Please install a NIP-07 extension like Alby.');
      }
      await login.extension();
      navigate('/home', { replace: true });
    } catch (e) {
      setExtensionError(e instanceof Error ? e.message : 'Extension login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── nsec / mnemonic / hex paste login ────────────────────────────────────
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

  // ─── NIP-46 Bunker login ──────────────────────────────────────────────────
  const handleBunkerLogin = async () => {
    setBunkerError(null);

    const trimmed = bunkerUri.trim();
    if (!trimmed) {
      setBunkerError('Please enter a bunker URI');
      return;
    }

    if (!trimmed.startsWith('bunker://')) {
      setBunkerError('Invalid bunker URI format. Must start with bunker://');
      return;
    }

    setIsSubmitting(true);
    try {
      await login.bunker(trimmed);
      navigate('/home', { replace: true });
    } catch {
      setBunkerError('Failed to connect to bunker. Please check the URI.');
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
              Restore your account or connect your wallet.
            </p>
          </div>

          {/* ─── Extension login (primary if available) ─── */}
          {hasExtension && (
            <div className="space-y-3 animate-slide-in-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
              {extensionError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{extensionError}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleExtensionLogin}
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold btn-interactive"
              >
                {isSubmitting ? 'Connecting...' : 'Continue with Extension'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your key stays in your extension's secure context — it never touches this page.
              </p>
            </div>
          )}

          {/* ─── Divider ─── */}
          {hasExtension && (
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">or use a key</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* ─── Key paste form (primary when no extension, secondary when extension exists) ─── */}
          <div className="animate-slide-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            {/* If extension exists, collapse key paste + bunker into "More Options" */}
            {hasExtension ? (
              <Collapsible open={isMoreOptionsOpen} onOpenChange={setIsMoreOptionsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span>More Options</span>
                    <ChevronDown className={`w-4 w-4 transition-transform ${isMoreOptionsOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SignInTabs
                    input={input}
                    setInput={(v) => { setInput(v); setError(null); }}
                    error={error}
                    isSubmitting={isSubmitting}
                    onSignIn={handleSignIn}
                    bunkerUri={bunkerUri}
                    setBunkerUri={(v) => { setBunkerUri(v); setBunkerError(null); }}
                    bunkerError={bunkerError}
                    onBunkerLogin={handleBunkerLogin}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                  />
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SignInTabs
                input={input}
                setInput={(v) => { setInput(v); setError(null); }}
                error={error}
                isSubmitting={isSubmitting}
                onSignIn={handleSignIn}
                bunkerUri={bunkerUri}
                setBunkerUri={(v) => { setBunkerUri(v); setBunkerError(null); }}
                bunkerError={bunkerError}
                onBunkerLogin={handleBunkerLogin}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}
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

            {/* Extension recommendation (shown when no extension detected) */}
            {!hasExtension && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-sm text-foreground font-medium">Want better security? Use a browser extension.</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Extensions like <a href="https://getalby.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Alby</a> or nos2x store your key in a separate security context. You sign in with one click — your private key never touches any website.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

// ─── Sub-component: Tabs for key paste + bunker ────────────────────────────

interface SignInTabsProps {
  input: string;
  setInput: (v: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSignIn: () => void;
  bunkerUri: string;
  setBunkerUri: (v: string) => void;
  bunkerError: string | null;
  onBunkerLogin: () => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
}

function SignInTabs({
  input, setInput, error, isSubmitting, onSignIn,
  bunkerUri, setBunkerUri, bunkerError, onBunkerLogin,
  activeTab, setActiveTab,
}: SignInTabsProps) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm p-5 sm:p-6 space-y-4 mt-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-muted/80 rounded-lg">
          <TabsTrigger value="key">
            Secret Key
          </TabsTrigger>
          <TabsTrigger value="bunker">
            Remote Signer
          </TabsTrigger>
        </TabsList>

        {/* ─── Secret Key tab ─── */}
        <TabsContent value="key" className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-200">
            ⚠️ Pasting your secret key into any website is equivalent to typing your private key into a website — only do this if you fully trust the site and understand the risk.
          </div>
          <div className="space-y-2">
            <label htmlFor="key-input" className="text-sm font-medium">
              Your private key
            </label>
            <Textarea
              id="key-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your private key (nsec1..., 12-word phrase, or hex)..."
              className="min-h-[120px] font-mono text-sm resize-none bg-muted/20 border-muted-foreground/20 focus:bg-background"
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSignIn();
                }
              }}
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
            onClick={onSignIn}
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
        </TabsContent>

        {/* ─── Remote Signer (Bunker) tab ─── */}
        <TabsContent value="bunker" className="space-y-4">
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
            Connect to a remote signer (NIP-46). Your key stays on a separate device — this app never sees it.
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            onBunkerLogin();
          }} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="bunker-input" className="text-sm font-medium">
                Bunker URI
              </label>
              <Input
                id="bunker-input"
                value={bunkerUri}
                onChange={(e) => setBunkerUri(e.target.value)}
                placeholder="bunker://..."
                autoComplete="off"
                className={bunkerError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {bunkerError && (
                <p className="text-sm text-destructive">{bunkerError}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !bunkerUri.trim()}
              className="w-full h-12 text-base font-semibold btn-interactive"
            >
              {isSubmitting ? 'Connecting...' : 'Connect'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
