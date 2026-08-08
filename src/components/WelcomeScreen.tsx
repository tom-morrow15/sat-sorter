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
import { InfoModal, NostrInfoContent, DifferenceInfoContent, PrivacyPromiseContent } from '@/components/InfoModal';
import { cn } from '@/lib/utils';

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

  const choices = [
    {
      key: 'fresh',
      icon: Sparkles,
      title: 'START FRESH',
      body: 'Create a private Nostr account in 60 seconds. No email. No phone. Just a 12-word backup you control.',
      onClick: () => navigate('/create-account'),
      accent: '#D9662E',
      primary: true,
    },
    {
      key: 'signin',
      icon: Key,
      title: 'SIGN IN',
      body: 'Already set up? Use your 12 words or nsec — they unlock the same account.',
      onClick: () => navigate('/sign-in'),
      accent: '#2F6E6A',
      primary: false,
    },
    {
      key: 'guest',
      icon: Eye,
      title: 'USE WITHOUT AN ACCOUNT',
      body: 'Try without an account. Your budget stays in this browser only. You can upgrade anytime.',
      onClick: () => { onGuestMode(); navigate('/home', { replace: true }); },
      accent: '#7C8F6B',
      primary: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ===== INK HERO ===== */}
      <header className="relative w-full bh-brand overflow-hidden">
        {/* Flat geometric grid texture */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--brand-grid)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--brand-grid)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        {/* Color-blocked corner shape */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-md bg-primary/20 rotate-12 pointer-events-none" aria-hidden />

        <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-6 pt-12 pb-14 sm:pt-16 sm:pb-16">
          <div className="flex items-center gap-3 mb-8 animate-slide-in-down">
            <div className="h-12 w-12 rounded-md bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" strokeWidth={2.2} />
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-white/50">Bitcoin Budgeting</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl tracking-tight leading-[0.95] text-white animate-slide-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Sat Sorter
          </h1>
          <p className="text-base sm:text-lg text-white/60 mt-4 max-w-md animate-slide-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Zero-based budgeting on a Bitcoin standard. Give every sat a job.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35 mt-3 animate-fade-in" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
            Your budget · Your keys · Your freedom
          </p>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-5 sm:px-6 py-8 pb-12">
          {/* Guest return banner */}
          {hasGuestData && (
            <div className="mb-6 animate-scale-in bh-card border-l-4 border-l-mustard p-5" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-md bg-mustard/15 flex items-center justify-center shrink-0">
                  <ArrowRight className="h-5 w-5 text-mustard" />
                </div>
                <div>
                  <h3 className="font-serif text-lg leading-tight">Welcome back</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You have budget data from a previous guest session.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => { onGuestMode(); navigate('/home', { replace: true }); }}
                  className="flex-1 touch-target-sm"
                >
                  Continue as guest
                </Button>
                <Button onClick={() => setHasGuestData(false)} variant="ghost" className="text-sm touch-target-sm">
                  Start fresh instead
                </Button>
              </div>
            </div>
          )}

          {/* Choice cards */}
          <div className="space-y-3 mb-8">
            {choices.map((c, idx) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  onClick={c.onClick}
                  className="w-full text-left bh-card bh-tap flex items-center gap-4 p-4 border-l-4 hover:border-foreground/20 transition-colors animate-slide-in-up group"
                  style={{ borderLeftColor: c.accent, animationDelay: `${0.15 + idx * 0.08}s`, animationFillMode: 'both' }}
                >
                  <div
                    className="h-11 w-11 rounded-md flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: `${c.accent}1f`, borderColor: `${c.accent}55` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: c.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn('font-mono text-[13px] tracking-wide', c.primary ? 'text-foreground' : 'text-foreground')}>
                      {c.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.body}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Expandable info sections */}
          <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.45s', animationFillMode: 'both' }}>
            {[
              {
                key: 'nostr',
                title: 'What is Nostr — and why does it matter?',
                teaser: 'Nostr is an open protocol that gives you full control of your data using cryptographic keys instead of accounts and passwords. No company owns it, no one can take it away.',
                accent: '#D9662E',
              },
              {
                key: 'difference',
                title: 'How is this different from traditional budgeting apps?',
                teaser: 'Unlike traditional apps that store your data on their servers, Sat Sorter encrypts everything on your device and stores it on public relays that nobody but you can read.',
                accent: '#7C8F6B',
              },
              {
                key: 'privacy',
                title: 'Read our privacy promise',
                teaser: 'Sat Sorter cannot read your budget, access your keys, or sell your data. All encryption happens on your device. Your data is yours — period.',
                accent: '#2F6E6A',
              },
            ].map((section) => (
              <div key={section.key} className="bh-card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left touch-target-sm"
                  onClick={() => toggleSection(section.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: section.accent }} />
                    <span className="text-sm font-medium">{section.title}</span>
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0', expandedSection === section.key && 'rotate-180')}
                  />
                </button>
                {expandedSection === section.key && (
                  <div className="px-4 pb-4 border-t border-border">
                    <p className="text-sm text-muted-foreground leading-relaxed pt-3">{section.teaser}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveModal(section.key); }}
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
              <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
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
        onConfirm={() => { setActiveModal(null); navigate('/create-account'); }}
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
