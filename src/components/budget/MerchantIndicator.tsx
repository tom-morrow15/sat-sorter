import { useState } from 'react';
import { MapPin, Zap, Bitcoin, ExternalLink, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  lineItemMatchesMerchant,
  getMerchantName,
  getMerchantCategory,
  acceptsLightning,
  acceptsOnchain,
  formatDistance,
  type BTCMapElement,
} from '@/hooks/useBTCMap';
import { cn } from '@/lib/utils';

interface MerchantIndicatorProps {
  lineItemName: string;
  merchants: (BTCMapElement & { distance: number })[];
  className?: string;
}

export function MerchantIndicator({ lineItemName, merchants, className }: MerchantIndicatorProps) {
  const [open, setOpen] = useState(false);
  
  // Find matching merchants for this line item
  const matchingMerchants = lineItemMatchesMerchant(lineItemName, merchants);
  
  if (matchingMerchants.length === 0) {
    return null;
  }

  const openMerchantInMaps = (merchant: BTCMapElement) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${merchant.osm_json.lat},${merchant.osm_json.lon}`;
    window.open(url, '_blank');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm',
            'bg-primary/10',
            'border border-primary/20 hover:border-primary/40',
            'transition-all hover:scale-105 active:scale-95',
            'text-xs font-medium text-primary cursor-pointer',
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <MapPin className="h-3 w-3" />
          <span>{matchingMerchants.length}</span>
          <Zap className="h-2.5 w-2.5 text-amber-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Spend Sats on {lineItemName}</p>
              <p className="text-xs text-muted-foreground">
                {matchingMerchants.length} Bitcoin merchant{matchingMerchants.length !== 1 ? 's' : ''} nearby
              </p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-1">
            {(matchingMerchants as (BTCMapElement & { distance: number })[]).map((merchant) => {
              const hasLightning = acceptsLightning(merchant);
              const hasOnchain = acceptsOnchain(merchant);
              
              return (
                <button
                  key={merchant.id}
                  onClick={() => openMerchantInMaps(merchant)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {getMerchantName(merchant)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {getMerchantCategory(merchant)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {formatDistance(merchant.distance)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasLightning && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 w-5 p-0 flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        <Zap className="h-3 w-3" />
                      </Badge>
                    )}
                    {hasOnchain && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 w-5 p-0 flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      >
                        <Bitcoin className="h-3 w-3" />
                      </Badge>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => window.open('https://btcmap.org', '_blank')}
          >
            <MapPin className="h-3 w-3 mr-1" />
            View All on BTCMap
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Compact badge version that also opens popover (for mobile)
export function MerchantBadge({ lineItemName, merchants, className }: MerchantIndicatorProps) {
  const [open, setOpen] = useState(false);
  const matchingMerchants = lineItemMatchesMerchant(lineItemName, merchants);
  
  if (matchingMerchants.length === 0) {
    return null;
  }

  const openMerchantInMaps = (merchant: BTCMapElement) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${merchant.osm_json.lat},${merchant.osm_json.lon}`;
    window.open(url, '_blank');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm',
            'bg-primary/10',
            'border border-primary/20 hover:border-primary/40 active:border-primary/60',
            'transition-all active:scale-95 cursor-pointer',
            className
          )}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <MapPin className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-medium text-primary">{matchingMerchants.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 sm:w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Spend Sats: {lineItemName}</p>
              <p className="text-xs text-muted-foreground">
                {matchingMerchants.length} merchant{matchingMerchants.length !== 1 ? 's' : ''} nearby
              </p>
            </div>
          </div>
        </div>
        
        <ScrollArea className="max-h-[250px]">
          <div className="p-2 space-y-1">
            {(matchingMerchants as (BTCMapElement & { distance: number })[]).map((merchant) => {
              const hasLightning = acceptsLightning(merchant);
              const hasOnchain = acceptsOnchain(merchant);
              
              return (
                <button
                  key={merchant.id}
                  onClick={() => openMerchantInMaps(merchant)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getMerchantName(merchant)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{getMerchantCategory(merchant)}</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {formatDistance(merchant.distance)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasLightning && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 w-5 p-0 flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        <Zap className="h-3 w-3" />
                      </Badge>
                    )}
                    {hasOnchain && (
                      <Badge 
                        variant="secondary" 
                        className="h-5 w-5 p-0 flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                      >
                        <Bitcoin className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => window.open('https://btcmap.org', '_blank')}
          >
            <MapPin className="h-3 w-3 mr-1" />
            View All on BTCMap
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
