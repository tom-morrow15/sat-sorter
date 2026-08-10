import { Radio, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RelayListManager } from '@/components/RelayListManager';

interface RelaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelaySettingsDialog({ open, onOpenChange }: RelaySettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Relay Settings
          </DialogTitle>
          <DialogDescription>
            Manage where your budget data is stored and synced.
          </DialogDescription>
        </DialogHeader>

        {/* Personal Relays */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium mb-1">Personal Relays</h3>
            <p className="text-xs text-muted-foreground mb-3">
              These relays store your personal budget data (encrypted). You can add, remove, and configure read/write access.
            </p>
          </div>
          <RelayListManager />
        </div>

        {/* Shared Budget Relays */}
        <div className="space-y-3 pt-4 border-t border-border/40">
          <div>
            <h3 className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-petrol" />
              Shared Budget Relays
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              These 4 public relays are used for budget partner sync. Both partners publish to and read from these, ensuring changes always reach each other regardless of personal relay settings.
            </p>
          </div>
          <div className="space-y-1.5">
            {[
              'wss://relay.damus.io',
              'wss://relay.nostr.band',
              'wss://nos.lol',
              'wss://relay.ditto.pub',
            ].map((url) => {
              const host = (() => {
                try { return new URL(url).host; } catch { return url; }
              })();
              return (
                <div key={url} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-petrol shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground">{host}</span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
