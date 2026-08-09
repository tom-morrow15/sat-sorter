import { useEffect, useState } from 'react';
import { Bug, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDebugLogs, clearDebugLogs, subscribeDebugLogs } from '@/lib/debugLog';
import type { DebugLogEntry } from '@/lib/debugLog';

interface DebugLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugLogDialog({ open, onOpenChange }: DebugLogDialogProps) {
  const [logs, setLogs] = useState<DebugLogEntry[]>(getDebugLogs());

  // Subscribe to new log entries so the dialog updates in real time
  useEffect(() => {
    const unsub = subscribeDebugLogs(() => setLogs(getDebugLogs()));
    return unsub;
  }, []);

  const handleClear = () => {
    clearDebugLogs();
    setLogs([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Sync Debug Log
          </DialogTitle>
          <DialogDescription>
            Partner sync diagnostics. Useful for troubleshooting why changes aren't syncing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </p>
          <Button size="sm" variant="outline" onClick={handleClear} className="h-8">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No sync activity logged yet.
            </div>
          ) : (
            <div className="space-y-1 font-mono text-[11px] leading-relaxed pb-4">
              {logs.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.level === 'error'
                      ? 'text-destructive'
                      : entry.level === 'warn'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground/80'
                  }
                >
                  <span className="text-muted-foreground/50 mr-1.5">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
