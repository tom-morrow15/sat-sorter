import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

/**
 * Shows a small avatar + name indicator for the partner who logged
 * a transaction. Only renders if the transaction has a partnerPubkey
 * (i.e., it came from a shared budget partner).
 */
export function PartnerAttribution({ pubkey }: { pubkey: string }) {
  const profile = useAuthor(pubkey);
  const metadata = profile.data?.metadata;
  const name = metadata?.name || metadata?.display_name || genUserName(pubkey);
  const picture = metadata?.picture;

  // Use first name only for compactness
  const firstName = name.split(' ')[0].slice(0, 12);

  return (
    <span className="inline-flex items-center gap-1 ml-1.5 text-muted-foreground/70">
      <span className="text-[10px]">·</span>
      {picture ? (
        <img
          src={picture}
          alt={name}
          className="h-3 w-3 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <span className="text-[10px]">{firstName}</span>
    </span>
  );
}
