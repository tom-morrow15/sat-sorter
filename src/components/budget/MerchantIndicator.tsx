import { useState } from 'react';
import { MapPin, Zap, Bitcoin, ExternalLink, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  const closestMerchant = matchingMerchants[0] as BTCMapElement & { distance: number };

  const openMerchantInMaps = (merchant: BTCMapElement) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${merchant.osm_json.lat},${merchant.osm_json.lon}`;
    window.open(url, '_blank');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full',
            'bg-gradient-to-r from-primary/10 to-orange-500/10',
            'border border-primary/20 hover:border-primary/40',
            'transition-all hover:scale-105',
            'text-xs font-medium text-primary',
            className
          )}
        >
          <MapPin className="h-3 w-3" />
          <span>{matchingMerchants.length}</span>
          <Zap className="h-2.5 w-2.5 text-amber-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-orange-500/5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
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
        
        <ScrollArea className="max-h-[250px]">
          <div className="p-2 space-y-1">
            {(matchingMerchants as (BTCMapElement & { distance: number })[]).slice(0, 10).map((merchant) => {
              const hasLightning = acceptsLightning(merchant);
              const hasOnchain = acceptsOnchain(merchant);
              
              return (
                <button
                  key={merchant.id}
                  onClick={() => openMerchantInMaps(merchant)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="secondary" 
                            className="h-5 w-5 p-0 flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          >
                            <Zap className="h-3 w-3" />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Accepts Lightning</TooltipContent>
                      </Tooltip>
                    )}
                    {hasOnchain && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="secondary" 
                            className="h-5 w-5 p-0 flex items-center justify-center bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          >
                            <Bitcoin className="h-3 w-3" />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Accepts On-chain</TooltipContent>
                      </Tooltip>
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

// Simple badge version for compact display
export function MerchantBadge({ lineItemName, merchants }: MerchantIndicatorProps) {
  const matchingMerchants = lineItemMatchesMerchant(lineItemName, merchants);
  
  if (matchingMerchants.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="secondary" 
          className="h-5 px-1.5 gap-0.5 bg-gradient-to-r from-primary/10 to-orange-500/10 border-primary/20 text-primary cursor-help"
        >
          <MapPin className="h-3 w-3" />
          <span className="text-[10px]">{matchingMerchants.length}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{matchingMerchants.length} Bitcoin merchant{matchingMerchants.length !== 1 ? 's' : ''} nearby</p>
        <p className="text-xs text-muted-foreground">Click line item to see options</p>
      </TooltipContent>
    </Tooltip>
  );
}
