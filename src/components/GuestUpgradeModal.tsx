import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetSync } from '@/hooks/useBudgetSync';
import { generateMnemonic, keysFromMnemonic } from '@/utils/nostrAuth';
import { useToast } from '@/hooks/useToast';

interface GuestUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal shown to guest users when they choose to upgrade to a Nostr account.
 * Generates keys, encrypts existing budget data, and publishes to relays.
 */
export function GuestUpgradeModal({ open, onOpenChange }: GuestUpgradeModalProps) {
  const navigate = useNavigate();
  const { upgradeGuest } = useOnboarding();
  const { fullState: budgetState } = useBudget();
  const { uploadBudget } = useBudgetSync();
  const { toast } = useToast();
  const [step, setStep] = useState<'confirm' | 'generating' | 'encrypting' | 'publishing' | 'done' | 'error'>('confirm');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  const handleUpgrade = async () => {
    try {
      setStep('generating');
      // Small delay so the user sees the transition
      await new Promise(r => setTimeout(r, 400));

      const m = generateMnemonic();
      setMnemonic(m);
      const keys = keysFromMnemonic(m);

      setStep('encrypting');
      await new Promise(r => setTimeout(r, 400));

      setStep('publishing');

      // Call upgradeGuest, which encrypts the secret key, saves to session,
      // publishes budget data, and cleans up guest localStorage
      await upgradeGuest({
        secretKey: keys.secretKey,
        nsec: keys.nsec,
        npub: keys.npub,
        budgetState,
        publishBudget: uploadBudget,
      });

      setStep('done');
    } catch (err) {
      console.error('Guest upgrade failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upgrade account');
      setStep('error');
    }
  };

  const handleDone = () => {
    toast({
      title: 'Account created!',
      description: 'Your budget is now synced and backed up. Welcome to self-sovereign budgeting.',
    });
    onOpenChange(false);
    navigate('/home', { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Upgrade to a Nostr Account
              </DialogTitle>
              <DialogDescription>
                Your budget is currently stored in this browser only. Create a free Nostr account to sync across devices and back up your data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-4">
              <p className="text-sm text-muted-foreground">
                 We'll generate a private key and encrypt your budget data. Your data will be synced to Nostr relays and available on any device you sign into.
              </p>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>What happens next:</strong> We'll create Nostr keys, encrypt your existing budget, publish it to relays, and clean up local storage. This is one-way — once upgraded, your budget lives on Nostr.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleUpgrade} className="flex-1">
                <Shield className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </div>
          </>
        )}

        {step === 'generating' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Generating your Nostr keys...</p>
               <p className="text-sm text-muted-foreground mt-1">Creating a secure private key</p>
            </div>
          </div>
        )}

        {step === 'encrypting' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Encrypting your budget data...</p>
              <p className="text-sm text-muted-foreground mt-1">Your data is being encrypted with NIP-44 before it leaves your device</p>
            </div>
          </div>
        )}

        {step === 'publishing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Publishing to Nostr relays...</p>
              <p className="text-sm text-muted-foreground mt-1">Your encrypted budget is being synced across the network</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Account Created!
              </DialogTitle>
              <DialogDescription>
                Your budget is now synced and backed up across devices.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4">
              {mnemonic && (
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="text-xs font-medium text-destructive mb-2">⚠️ Save your private key — it's the only way to recover your account:</p>
                  <div className="grid grid-cols-3 gap-1">
                    {mnemonic.split(' ').map((word, i) => (
                      <div key={i} className="text-xs font-mono bg-background rounded px-2 py-1 text-center border">
                        {i + 1}. {word}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                 Your budget data has been encrypted and published to Nostr relays. You can now access it from any device by signing in with your private key.
              </p>
            </div>

            <Button onClick={handleDone} className="w-full">
              <Check className="h-4 w-4 mr-2" />
              Start Budgeting
            </Button>
          </>
        )}

        {step === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Upgrade Failed
              </DialogTitle>
              <DialogDescription>
                Something went wrong while upgrading your account.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4">
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                {errorMsg || 'An unknown error occurred. Please try again.'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => { setStep('confirm'); setErrorMsg(null); }} className="flex-1">
                Try Again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
