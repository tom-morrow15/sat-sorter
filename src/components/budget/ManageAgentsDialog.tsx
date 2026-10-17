import { useEffect, useState } from 'react';
import { Bot, Copy, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useSharedSync } from './PartnerSyncWrapper';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BudgetAgent } from '@/lib/budgetTypes';

function agentCode(thread: { budgetId: string; ownerPubkey: string; partnerPubkey?: string; sharedFromMonth?: string }) {
  return `satsorter:agent:${thread.budgetId}:${thread.ownerPubkey}:${thread.partnerPubkey || '0'}:${thread.sharedFromMonth || ''}`;
}

function AgentRow({ agent, onRemove }: { agent: BudgetAgent; onRemove: () => void }) {
  const profile = useAuthor(agent.pubkey);
  const metadata = profile.data?.metadata;
  const label = metadata?.display_name || metadata?.name || agent.name || 'Agent';
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
      <Avatar className="h-9 w-9">
        <AvatarImage src={metadata?.picture} alt="" />
        <AvatarFallback>{label.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground">Can log expenses</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Agent options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
            Remove agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ManageAgentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const shared = useSharedSync();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const threadApi = shared?.thread;
  const thread = threadApi?.thread;
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!open || !user || !threadApi) return;
    const current = threadApi.ensureAgentThread();
    if (!current?.budgetId || !current.ownerPubkey) return;
    setCode(agentCode(current));
  }, [open, thread?.budgetId, thread?.ownerPubkey, thread?.partnerPubkey, thread?.sharedFromMonth, threadApi, user]);

  const connected = (thread?.agents || []).filter((agent) => !agent.removedAt);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: 'Code copied', description: 'Paste it into your agent.' });
    } catch {
      toast({ title: 'Copy the code', description: 'Select the code below and copy it.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Agents
          </DialogTitle>
          <DialogDescription>
            An agent can add expenses. It can also see your saved months, transactions, Wealth balances, and nearby Bitcoin places. More than one agent can use the same code. Remove an agent here at any time.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <p className="text-sm text-muted-foreground">Log in with Nostr before connecting an agent.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm">Paste this code into your agent. Leave Sat Sorter open until the agent appears below.</p>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{code || 'Preparing a code…'}</pre>
              <Button type="button" onClick={copy} disabled={!code} className="w-full">
                <Copy className="h-4 w-4 mr-2" /> Copy code
              </Button>
            </div>

            {connected.length > 0 ? (
              <div className="space-y-2">
                {connected.map((agent) => (
                  <AgentRow key={agent.pubkey} agent={agent} onRemove={() => threadApi?.removeAgent(agent.pubkey)} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for an agent to connect.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
