import { Heart, Sparkles, Zap, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supporterTiers, getActiveTiers, getTotalSupporterCount, hasSupporters } from '@/lib/supporters';
import { SupporterCard } from './SupporterCard';
import { cn } from '@/lib/utils';

interface DevelopmentSupportersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevelopmentSupportersDialog({ open, onOpenChange }: DevelopmentSupportersDialogProps) {
  const activeTiers = getActiveTiers();
  const totalSupporters = getTotalSupporterCount();
  const hasAnySupporters = hasSupporters();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0 overflow-hidden">
        {/* Celebratory Header */}
        <div className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-orange-500/20 to-rose-500/20 animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

          {/* Sparkle decorations */}
          <div className="absolute top-4 left-8 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>✨</div>
          <div className="absolute top-6 right-12 text-xl animate-bounce" style={{ animationDelay: '0.2s' }}>⚡</div>
          <div className="absolute top-3 right-28 text-lg animate-bounce" style={{ animationDelay: '0.4s' }}>💫</div>

          <DialogHeader className="relative p-6 pb-4">
            <div className="flex items-center justify-center mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full blur-lg opacity-50 animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg">
                  <Heart className="h-8 w-8 text-white fill-white" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">
              Development Supporters
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {hasAnySupporters ? (
                <>
                  <span className="font-semibold text-foreground">{totalSupporters}</span>{' '}
                  {totalSupporters === 1 ? 'amazing person has' : 'amazing people have'} helped fund Sat Sorter's development
                </>
              ) : (
                'Be the first to support Sat Sorter\'s development!'
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[55vh] px-6">
          <div className="space-y-6 py-4">
            {hasAnySupporters ? (
              <>
                {/* Thank you message */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-amber-500/10 to-orange-500/10 border border-primary/20 text-center">
                  <p className="text-sm font-medium">
                    🙏 A heartfelt <span className="text-primary font-bold">THANK YOU</span> to everyone who has supported Sat Sorter!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your generosity keeps this project alive and growing.
                  </p>
                </div>

                {/* Tier sections */}
                {activeTiers.map((tier) => (
                  <div key={tier.id} className="space-y-3">
                    {/* Tier header */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-xl",
                        "bg-gradient-to-br shadow-md",
                        tier.gradient
                      )}>
                        {tier.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={cn("font-bold text-lg", tier.color)}>
                            {tier.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {tier.supporters.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tier.description}
                        </p>
                      </div>
                    </div>

                    {/* Supporters grid */}
                    <div className="grid gap-2">
                      {tier.supporters.map((npub) => (
                        <SupporterCard
                          key={npub}
                          npub={npub}
                          tierGradient={tier.gradient}
                          tierIcon={tier.icon}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <Separator />

                {/* All tiers reference */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground text-center">
                    Support Tiers
                  </h4>
                  <div className="grid grid-cols-5 gap-1">
                    {supporterTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="text-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="text-xl">{tier.icon}</span>
                        <p className="text-[8px] font-medium mt-1 leading-tight">{tier.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* No supporters yet - encouraging message */
              <div className="space-y-6 text-center py-6">
                <div className="space-y-2">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <h3 className="font-semibold text-lg">Be a Pioneer!</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    No supporters yet, but you could be the first to help fund Sat Sorter's continued development!
                  </p>
                </div>

                {/* Tier preview */}
                <div className="p-4 rounded-xl border bg-muted/30">
                  <h4 className="font-medium text-sm mb-3">Support Tiers</h4>
                  <div className="space-y-2">
                    {supporterTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xl">{tier.icon}</span>
                        <div className="flex-1 text-left">
                          <span className={cn("font-medium text-sm", tier.color)}>
                            {tier.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with donate CTA */}
        <div className="p-6 pt-4 border-t bg-muted/30">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Support Sat Sorter and get your name on this wall of fame! ⚡
            </p>
            <Button
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white shadow-lg"
              onClick={() => window.open('https://geyser.fund/project/satsorter', '_blank')}
            >
              <Zap className="h-4 w-4 mr-2" />
              Become a Development Supporter
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
