import { nip19 } from 'nostr-tools';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';

interface SupporterCardProps {
  npub: string;
  tierGradient: string;
  tierIcon: string;
}

export function SupporterCard({ npub, tierGradient, tierIcon }: SupporterCardProps) {
  // Decode npub to get pubkey
  let pubkey: string | undefined;
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      pubkey = decoded.data;
    }
  } catch {
    // Invalid npub
  }

  const { data: author, isLoading } = useAuthor(pubkey);
  const metadata = author?.metadata;

  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey || '');
  const profileUrl = `https://primal.net/p/${npub}`;

  if (!pubkey) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
        "bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50",
        "hover:shadow-lg hover:scale-[1.02] hover:border-primary/30",
        "focus:outline-none focus:ring-2 focus:ring-primary/50"
      )}
    >
      {/* Avatar with tier gradient ring */}
      <div className={cn(
        "relative p-0.5 rounded-full bg-gradient-to-br",
        tierGradient
      )}>
        <Avatar className="h-11 w-11 border-2 border-background">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback className="text-sm font-semibold bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Tier icon badge */}
        <span className="absolute -bottom-1 -right-1 text-sm bg-background rounded-full p-0.5 shadow-sm">
          {tierIcon}
        </span>
      </div>

      {/* Name and NIP-05 */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
          {displayName}
        </p>
        {metadata?.nip05 && (
          <p className="text-xs text-muted-foreground truncate">
            {metadata.nip05}
          </p>
        )}
      </div>

      {/* External link indicator */}
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

/**
 * Compact version for showing multiple supporters in a row
 */
export function SupporterAvatar({ npub, tierGradient }: { npub: string; tierGradient: string }) {
  let pubkey: string | undefined;
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type === 'npub') {
      pubkey = decoded.data;
    }
  } catch {
    // Invalid npub
  }

  const { data: author, isLoading } = useAuthor(pubkey);
  const metadata = author?.metadata;
  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey || '');
  const profileUrl = `https://primal.net/p/${npub}`;

  if (!pubkey) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      title={displayName}
    >
      <div className={cn(
        "p-0.5 rounded-full bg-gradient-to-br transition-transform hover:scale-110",
        tierGradient
      )}>
        <Avatar className="h-9 w-9 border-2 border-background">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback className="text-xs font-semibold bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>
    </a>
  );
}
