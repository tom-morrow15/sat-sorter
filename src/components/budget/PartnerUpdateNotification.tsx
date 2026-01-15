import { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface PartnerUpdateNotificationProps {
  partnerPubkey: string | null;
  onDismiss: () => void;
}

export function PartnerUpdateNotification({
  partnerPubkey,
  onDismiss,
}: PartnerUpdateNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const author = useAuthor(partnerPubkey || '');

  const partnerName = partnerPubkey
    ? author.data?.metadata?.name ||
      author.data?.metadata?.display_name ||
      genUserName(partnerPubkey)
    : null;

  // Animate in when partnerPubkey changes
  useEffect(() => {
    if (partnerPubkey) {
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [partnerPubkey]);

  if (!partnerPubkey) return null;

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg">
        <Users className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          {partnerName} updated the budget
        </span>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-primary-foreground/20 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
