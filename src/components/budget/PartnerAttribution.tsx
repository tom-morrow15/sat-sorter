import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface PartnerAttributionProps {
  pubkey: string;
  /** Show the partner's name text (default: true on desktop, false on mobile) */
  showName?: boolean;
  className?: string;
}

/**
 * Shows a small avatar indicator for the partner who logged a transaction.
 * On mobile: just a 16px avatar circle (no text to save space).
 * On desktop: avatar + first name.
 */
export function PartnerAttribution({ pubkey, showName = true, className }: PartnerAttributionProps) {
  const profile = useAuthor(pubkey);
  const metadata = profile.data?.metadata;
  // Nostr convention: display_name is the human-facing name; name is the handle
  const name = metadata?.display_name || metadata?.name || genUserName(pubkey);
  const picture = metadata?.picture;
  const firstName = name.split(' ')[0].slice(0, 12);

  return (
    <span className={cn('inline-flex items-center gap-1 ml-1 shrink-0', className)}>
      <span className="text-[10px] text-muted-foreground/40">·</span>
      {picture ? (
        <img
          src={picture}
          alt={name}
          className="h-3.5 w-3.5 rounded-full object-cover border border-border/40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full bg-muted flex items-center justify-center text-[8px] text-muted-foreground">
          {firstName.charAt(0).toUpperCase()}
        </span>
      )}
      {showName && (
        <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">{firstName}</span>
      )}
    </span>
  );
}
