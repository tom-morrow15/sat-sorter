import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Sparkles, Key, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InfoModal, NostrInfoContent, DifferenceInfoContent, PrivacyPromiseContent } from '@/components/InfoModal';

interface WelcomeScreenProps {
  onGuestMode: () => void;
}

export function WelcomeScreen({ onGuestMode }: WelcomeScreenProps) {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
            SAT SORTER
          </h1>
          <p className="text-lg text-muted-foreground">
            Your budget. Your keys. Your freedom.
          </p>
        </div>

        {/* Three choice cards */}
        <div className="space-y-3 mb-8">
          {/* Card 1: Start Fresh */}
          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
            onClick={() => navigate('/create-account')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">START FRESH</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a private Nostr account in 60 seconds. No email. No phone. Just a 12-word backup you control.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </CardContent>
          </Card>

          {/* Card 2: Sign In */}
          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
            onClick={() => navigate('/sign-in')}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">SIGN IN</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Already set up? Use your 12 words or nsec. Either works — they unlock the same account.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </CardContent>
          </Card>

          {/* Card 3: Skip */}
          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
            onClick={onGuestMode}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Eye className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">SKIP FOR NOW</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Try Sat Sorter without an account. Your budget stays in this browser only. You can upgrade anytime.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* Expandable info sections */}
        <div className="space-y-1 border rounded-xl overflow-hidden">
          {/* Section 1: What is Nostr */}
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            onClick={() => toggleSection('nostr')}
          >
            <span className="text-sm font-medium">What is Nostr — and why does it matter?</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                expandedSection === 'nostr' ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSection === 'nostr' && (
            <div className="px-5 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nostr is an open protocol that gives you full control of your data using cryptographic keys instead of accounts and passwords. No company owns it, no one can take it away.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal('nostr'); }}
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                Learn more →
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Section 2: How is this different */}
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            onClick={() => toggleSection('difference')}
          >
            <span className="text-sm font-medium">How is this different from normal apps?</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                expandedSection === 'difference' ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSection === 'difference' && (
            <div className="px-5 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Unlike traditional apps that store your data on their servers, Sat Sorter encrypts everything on your device and stores it on public relays that nobody but you can read.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal('difference'); }}
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                See full comparison →
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Section 3: Privacy promise */}
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            onClick={() => toggleSection('privacy')}
          >
            <span className="text-sm font-medium">Read our privacy promise (60 seconds)</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                expandedSection === 'privacy' ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSection === 'privacy' && (
            <div className="px-5 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sat Sorter cannot read your budget, access your keys, or sell your data. All encryption happens on your device. Your data is yours — period.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveModal('privacy'); }}
                className="text-sm text-primary hover:underline mt-2 inline-block"
              >
                Read the full promise →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/70 mt-8 leading-relaxed">
          Sat Sorter won't track you, sell you, or lock you in. Your money. Your data. Your freedom.
        </p>
      </div>

      {/* Modals */}
      <InfoModal
        isOpen={activeModal === 'nostr'}
        onClose={() => setActiveModal(null)}
        title="What is Nostr?"
      >
        <NostrInfoContent />
      </InfoModal>

      <InfoModal
        isOpen={activeModal === 'difference'}
        onClose={() => setActiveModal(null)}
        title="The difference"
      >
        <DifferenceInfoContent />
      </InfoModal>

      <InfoModal
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        title="Our privacy promise"
      >
        <PrivacyPromiseContent />
      </InfoModal>
    </div>
  );
}
