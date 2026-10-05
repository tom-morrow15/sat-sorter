import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Copy, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { getDebugLogs, clearDebugLogs, subscribeDebugLogs, formatDebugLogs } from '@/lib/debugLog';
import type { DebugLogEntry } from '@/lib/debugLog';

interface DebugLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugLogDialog({ open, onOpenChange }: DebugLogDialogProps) {
  const [logs, setLogs] = useState<DebugLogEntry[]>(getDebugLogs());
  const { toast } = useToast();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeDebugLogs(() => setLogs(getDebugLogs()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!open) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [open, logs.length]);

  const handleClear = () => {
    clearDebugLogs();
    setLogs([]);
  };

  const handleCopy = async () => {
    const text = formatDebugLogs(logs);
    try {
      await navigator.clipboard.writeText(text || 'No log entries.');
      toast({ title: 'Logs copied' });
    } catch {
      toast({ title: 'Could not copy logs', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            App Logs
          </DialogTitle>
          <DialogDescription>
            What this phone just did. Copy them and send them when something breaks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { void handleCopy(); }} className="h-8">
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} className="h-8">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="h-[50vh] touch-pan-y overflow-y-auto overscroll-contain px-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nothing logged yet. Use the app, then come back.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
