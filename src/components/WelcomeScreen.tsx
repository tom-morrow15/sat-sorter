import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  Sparkles,
  Key,
  Eye,
  ArrowRight,
  Zap,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InfoModal, NostrInfoContent, DifferenceInfoContent, PrivacyPromiseContent } from '@/components/InfoModal';

const GUEST_BUDGET_KEY = 'sat-sorter-budget';

interface WelcomeScreenProps {
  onGuestMode: () => void;
}

export function WelcomeScreen({ onGuestMode }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [hasGuestData, setHasGuestData] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GUEST_BUDGET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.budgets && Array.isArray(parsed.budgets) && parsed.budgets.length > 0) {
          setHasGuestData(true);
        }
      }
    } catch {
      // No guest data found
    }
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ===== HERO HEADER - matching BudgetHeader's dark gradient + mesh ===== */}
      <header className="relative w-full bg-header-gradient text-white overflow-hidden">
        <div className="absolute inset-0 bg-mesh-gradient opacity-40 pointer-events-none" />
        {/* Floating particles / noise grain decoration */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 35%, rgba(247,147,26,0.35) 0%, transparent 35%), radial-gradient(circle at 85% 65%, rgba(247,147,26,0.25) 0%, transparent 30%)',
          }}
        />

        <div className="relative z-10 container mx-auto px-4 py-10 sm:py-16 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6 animate-slide-in-down">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg bitcoin-glow-hover transition-all duration-500">
              <Zap className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-3 animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Sat Sorter
          </h1>
          <p className="text-lg sm:text-xl text-white/80 font-light tracking-wide animate-slide-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Zero-based budgeting on a Bitcoin standard.
          </p>
          <p className="text-sm text-white/50 mt-2 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
            Your budget. Your keys. Your freedom.
          </p>

          {/* Decorative bottom fade into content */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, hsl(220 8% 97% / 1))',
            }}
          />
        </div>
      </header>

      {/* ===== BODY - light background matching the app ===== */}
      <main className="flex-1 bg-background relative">
        {/* Subtle mesh decoration in the body */}
        <div className="absolute inset-0 bg-mesh-gradient opacity-[0.03] pointer-events-none" />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 -mt-4 sm:-mt-6 max-w-xl pb-12">
          {/* Guest return banner */}
          {hasGuestData && (
            <div className="mb-6 animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <Card className="border-amber-400/30 bg-amber-50/80 dark:bg-amber-950/20 backdrop-blur-sm shadow-lg shadow-amber-500/5">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <ArrowRight className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Welcome back!
                      </h3>
                      <p className="text-xs text-amber-800/70 dark:text-amber-300/60 mt-0.5">
                        You have budget data from a previous guest session.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => {
                        onGuestMode();
                        navigate('/home', { replace: true });
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm"
                    >
                      Continue as guest
                    </Button>
                    <Button
                      onClick={() => setHasGuestData(false)}
                      variant="ghost"
                      className="text-sm text-amber-800/60 dark:text-amber-300/50 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      Start fresh instead
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Three choice cards with staggered animation */}
          <div className="space-y-3 mb-8">
            {/* Card 1: Start Fresh — PRIMARY, most visual weight */}
            <Card
              className="cursor-pointer group overflow-hidden animate-slide-in-up border-transparent shadow-lg shadow-orange-500/5 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-0.5"
              onClick={() => navigate('/create-account')}
              style={{ animationDelay: '0.15s', animationFillMode: 'both' }}
            >
              {/* Accent stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-orange-500 rounded-l-lg" />
              <CardContent className="relative p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/10 flex items-center justify-center shrink-0 border border-primary/10 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm tracking-tight">START FRESH</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Create a private Nostr account in 60 seconds. No email. No phone. Just a 12-word backup you control.
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shrink-0">
                  <ChevronRight className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Sign In — SECONDARY */}
            <Card
              className="cursor-pointer group overflow-hidden animate-slide-in-up border transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              onClick={() => navigate('/sign-in')}
              style={{ animationDelay: '0.25s', animationFillMode: 'both' }}
            >
              <CardContent className="relative p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-secondary/60 flex items-center justify-center shrink-0 border border-border group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300">
                  <Key className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm tracking-tight">SIGN IN</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Already set up? Use your 12 words or nsec — they unlock the same account.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>

            {/* Card 3: Skip — TERTIARY, ghost card */}
            <Card
              className="cursor-pointer group overflow-hidden animate-slide-in-up border-dashed hover:border-solid transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5"
              onClick={() => {
                onGuestMode();
                navigate('/home', { replace: true });
              }}
              style={{ animationDelay: '0.35s', animationFillMode: 'both' }}
            >
              <CardContent className="relative p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-muted/40 flex items-center justify-center shrink-0 group-hover:bg-muted/70 transition-all duration-300">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm tracking-tight text-muted-foreground">USE WITHOUT AN ACCOUNT</h3>
                  <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                    Try without an account. Your budget stays in this browser only. You can upgrade anytime.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
              </CardContent>
            </Card>
          </div>

          {/* Expandable info sections — compact, glass-morphism feel */}
          <div className="space-y-1.5 animate-fade-in" style={{ animationDelay: '0.45s', animationFillMode: 'both' }}>
            {[
              {
                key: 'nostr',
                title: 'What is Nostr — and why does it matter?',
                teaser:
                  'Nostr is an open protocol that gives you full control of your data using cryptographic keys instead of accounts and passwords. No company owns it, no one can take it away.',
                modalTitle: 'What is Nostr?',
                content: <NostrInfoContent />,
              },
              {
                key: 'difference',
                title: 'How is this different from traditional budgeting apps?',
                teaser:
                  'Unlike traditional apps that store your data on their servers, Sat Sorter encrypts everything on your device and stores it on public relays that nobody but you can read.',
                modalTitle: 'The difference',
                content: <DifferenceInfoContent />,
              },
              {
                key: 'privacy',
                title: 'Read our privacy promise',
                teaser:
                  'Sat Sorter cannot read your budget, access your keys, or sell your data. All encryption happens on your device. Your data is yours — period.',
                modalTitle: 'Our privacy promise',
                content: <PrivacyPromiseContent />,
              },
            ].map((section, idx) => (
              <div
                key={section.key}
                className="rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden hover:bg-card/80 transition-colors"
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                  onClick={() => toggleSection(section.key)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full transition-colors ${
                        idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    />
                    <span className="text-sm font-medium">{section.title}</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                      expandedSection === section.key ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedSection === section.key && (
                  <div className="px-5 pb-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground leading-relaxed pt-3">
                      {section.teaser}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModal(section.key);
                      }}
                      className="text-sm text-primary hover:underline mt-2 inline-block font-medium"
                    >
                      Learn more →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-10 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground/60 text-center">
                No email. No tracking. No lock-in. Your data. Your keys.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/40">
              Vibed with{' '}
              <a
                href="https://shakespeare.diy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Shakespeare
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Modals */}
      <InfoModal
        isOpen={activeModal === 'nostr'}
        onClose={() => setActiveModal(null)}
        onConfirm={() => {
          setActiveModal(null);
          navigate('/create-account');
        }}
        title="What is Nostr?"
      >
        <NostrInfoContent />
      </InfoModal>
      <InfoModal isOpen={activeModal === 'difference'} onClose={() => setActiveModal(null)} title="The difference">
        <DifferenceInfoContent />
      </InfoModal>
      <InfoModal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title="Our privacy promise">
        <PrivacyPromiseContent />
      </InfoModal>
    </div>
  );
}
