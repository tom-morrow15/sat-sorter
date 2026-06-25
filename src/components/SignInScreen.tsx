import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Back link */}
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Sign in with your Nostr account
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste your 12-word seed phrase or your nsec:
          </p>
        </div>

        {/* Input area */}
        <div className="space-y-4">
          <Textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(null);
            }}
            placeholder="Enter your 12-word seed phrase or nsec1..."
            className="min-h-[120px] font-mono text-sm resize-none"
            autoComplete="off"
            spellCheck={false}
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSignIn}
            disabled={isSubmitting || !input.trim()}
            className="w-full"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </div>

        {/* Help text */}
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <p>
            Your 12 words and your nsec unlock the same account. Either works. 12 words: for humans, write down. nsec: for apps, copy/paste.
          </p>

          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs">
              Your key never leaves your browser. It's encrypted locally. We never see it.
            </p>
          </div>

          {/* Advanced section */}
          <div className="border-t pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? '▾' : '▸'} Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-3">
                  Use a NIP-07 browser extension (like nos2x, Alby, or Flamingo) to sign in without entering your key manually.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigate('/home', { replace: true });
                  }}
                >
                  Sign in with extension
                </Button>
              </div>
            )}
          </div>

          {/* Create account link */}
          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/create-account" className="text-primary hover:underline font-medium">
                Create a Nostr account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
