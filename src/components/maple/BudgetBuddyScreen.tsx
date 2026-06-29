import { useState, useRef, useEffect } from 'react';
import { useSeoMeta } from '@unhead/react';
import { MessageSquare, Send, Trash2, TrendingUp, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useMapleSettings } from '@/hooks/useMapleSettings';
import { useMapleChat } from '@/hooks/useMapleChat';
import { ChatMessageBubble } from './ChatMessageBubble';
import { QuickActionChips } from './QuickActionChips';
import { TypingIndicator } from './TypingIndicator';
import { ContextBottomSheet } from './ContextBottomSheet';
import { OverspendDialog } from './OverspendDialog';
import { MAPLE_MODELS_FALLBACK, type MapleModelOption } from '@/services/mapleAi';
import type { Bucket } from '@/lib/budgetTypes';

export function BudgetBuddyScreen() {
  const { isMapleEnabled, evergreenContext, model, setModel, availableModels } = useMapleSettings();
  const { messages, isLoading, sendMessage, clearHistory, preflightCheck } =
    useMapleChat();

  // Use fetched models if available, fall back to hardcoded list
  const modelList: MapleModelOption[] = availableModels.length > 0 ? availableModels : MAPLE_MODELS_FALLBACK;

  // Find the active model info. If the model isn't in the list (custom model),
  // show the raw ID as the label.
  const findModel = (modelId: string): MapleModelOption => {
    const found = modelList.find((m) => m.id === modelId);
    if (found) return found;
    return { id: modelId, label: modelId, description: '' };
  };
  const activeModel = findModel(model);

  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [overspendState, setOverspendState] = useState<{
    open: boolean;
    bucket: Bucket;
    amount: number;
    pendingMessage: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSeoMeta({
    title: 'Budget Buddy - Sat Sorter',
    description: 'Chat with your AI budget assistant.',
  });

  // Auto-scroll to the newest message whenever the conversation changes or the
  // typing indicator appears. The Radix ScrollArea renders its scrollable
  // content inside a [data-radix-scroll-area-viewport] element, so setting
  // scrollTop on the root ref does nothing — we must target the viewport (or
  // scroll a bottom anchor into view).
  useEffect(() => {
    // Defer to the next frame so freshly-rendered messages are measured first.
    const id = requestAnimationFrame(() => {
      const viewport = scrollRef.current?.querySelector<HTMLElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');

    // Local pre-check for spend intents
    const check = preflightCheck(text);
    if (check.blocked) {
      setOverspendState({
        open: true,
        bucket: check.bucket,
        amount: check.overspendAmount,
        pendingMessage: text,
      });
      return;
    }

    await sendMessage(text);
  };

  const handleAskMapleAnyway = async () => {
    if (!overspendState) return;
    const text = overspendState.pendingMessage;
    setOverspendState(null);
    await sendMessage(text);
  };

  const handleOverspendCancel = () => {
    setOverspendState(null);
  };

  const handleQuickAction = (text: string) => {
    const check = preflightCheck(text);
    if (check.blocked) {
      setOverspendState({
        open: true,
        bucket: check.bucket,
        amount: check.overspendAmount,
        pendingMessage: text,
      });
      return;
    }
    setInput(text);
    // Small delay so the user sees the text before send
    setTimeout(() => {
      sendMessage(text);
      setInput('');
    }, 100);
  };

  if (!isMapleEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Budget Buddy</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Budget Buddy is disabled. Add a Maple API key in the app menu and
          enable it to chat with your AI budget assistant.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100dvh - 4rem - env(safe-area-inset-bottom))' }}
    >
      {/* Chat header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b bg-background shrink-0"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Maple</h2>
            {/* Always-visible model indicator (tap to change) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Cpu className="h-3 w-3" />
                  <span>{activeModel.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Choose a model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {modelList.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {m.label}
                      {m.id === model && (
                        <span className="text-[10px] text-primary">● active</span>
                      )}
                    </span>
                    {m.description && (
                      <span className="text-[11px] text-muted-foreground">
                        {m.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowContext(true)}
            className={cn(
              'text-[10px] px-2 py-1 rounded-full border transition-colors',
              'bg-muted/50 border-border/60 text-muted-foreground hover:bg-muted'
            )}
          >
            Context
          </button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearHistory}
              title="New chat"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">
                  Welcome to Budget Buddy
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  Ask Maple anything about your budget, spending, or how to
                  optimize your sats.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))
          )}
          {isLoading && <TypingIndicator />}
          {/* Scroll anchor — keeps the newest message in view on send/response */}
          <div ref={bottomRef} aria-hidden className="h-px" />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="shrink-0 border-t bg-background px-4 pt-3 pb-6 space-y-3">
        <QuickActionChips onSelect={handleQuickAction} />
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Maple about your budget..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Context bottom sheet */}
      <ContextBottomSheet
        open={showContext}
        onOpenChange={setShowContext}
        context={evergreenContext}
      />

      {/* Overspend pre-check dialog */}
      {overspendState && (
        <OverspendDialog
          open={overspendState.open}
          onOpenChange={(o) => !o && handleOverspendCancel()}
          bucket={overspendState.bucket}
          amount={overspendState.amount}
          onAskMaple={handleAskMapleAnyway}
          onCancel={handleOverspendCancel}
        />
      )}
    </div>
  );
}
