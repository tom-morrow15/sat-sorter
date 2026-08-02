import { useCallback, useState, useRef } from 'react';
import { useAISettings } from './useAISettings';
import {
  buildBudgetContext,
  chatWithMaple,
  analyzeMonth,
  parseSpendIntent,
  findCategory,
  getBucketRemainingUsd,
  getMapleErrorMessage,
  type ChatMessage,
} from '@/services/mapleAi';
import type { Bucket } from '@/lib/budgetTypes';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface UseMapleChatReturn {
  messages: ChatEntry[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  analyze: () => Promise<string>;
  clearHistory: () => void;
  preflightCheck: (
    text: string
  ) =>
    | { blocked: false }
    | { blocked: true; reason: string; bucket: Bucket; overspendAmount: number };
}

export function useMapleChat(): UseMapleChatReturn {
  const { currentBudget, currentMonth } = useBudget();
  const { data: priceData } = useBitcoinPrice();
  const { apiKey, evergreenContext, proxyUrl, model, zdr } = useAISettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chats are intentionally ephemeral: a fresh, in-memory conversation each
  // time Budget Buddy is opened. Closing/reopening the app starts over.
  const [messages, setMessages] = useState<ChatEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Maximum number of ChatEntry items to keep in the API history.
   * Prevents the context window from blowing out on long conversations.
   */
  const MAX_HISTORY_MESSAGES = 30;

  /**
   * Trim conversation history to stay within a reasonable context window.
   * Keeps the first 2 messages (greeting context) and the last 20 messages,
   * inserting a synthetic summary note in between.
   */
  function trimHistory(history: ChatMessage[]): ChatMessage[] {
    if (history.length <= MAX_HISTORY_MESSAGES) return history;

    const firstTwo = history.slice(0, 2);
    const lastTwenty = history.slice(-20);

    return [
      ...firstTwo,
      {
        role: 'assistant' as const,
        content:
          '(Earlier conversation summarized: you were discussing budget categories and transactions.)',
      },
      ...lastTwenty,
    ];
  }

  const getContext = useCallback(() => {
    const btcPrice = priceData?.usdPerBtc ?? 0;
    if (!btcPrice) {
      throw new Error('BTC price unavailable');
    }
    return buildBudgetContext(currentMonth, currentBudget, btcPrice, evergreenContext);
  }, [currentMonth, currentBudget, priceData, evergreenContext]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!apiKey) {
        toast({
          title: 'Maple API key missing',
          description: 'Add your API key in Settings to use Budget Buddy.',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(true);
      setError(null);

      // Add user message immediately
      const userEntry: ChatEntry = {
        id: `${Date.now()}-user`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userEntry]);

      try {
        const context = getContext();

        // Build history for API (exclude the just-added user message —
        // we include it manually)
        const previousMessages: ChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const fullHistory: ChatMessage[] = [
          ...previousMessages,
          { role: 'user', content: text },
        ];

        // Trim history to stay within context window limits
        const trimmedHistory = trimHistory(fullHistory);

        const responseText = await chatWithMaple(apiKey, proxyUrl, context, trimmedHistory, model, zdr);

        const assistantEntry: ChatEntry = {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: responseText,
        };
        setMessages((prev) => [...prev, assistantEntry]);
      } catch (err) {
        const msg = getMapleErrorMessage(err);
        setError(msg);
        toast({ title: msg, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, proxyUrl, model, zdr, messages, getContext, setMessages, toast]
  );

  const analyze = useCallback(async () => {
    if (!apiKey) {
      toast({
        title: 'Maple API key missing',
        description: 'Add your API key in Settings to use Budget Buddy.',
        variant: 'destructive',
      });
      return '';
    }

    setIsLoading(true);
    setError(null);

    try {
      const context = getContext();
      const text = await analyzeMonth(apiKey, proxyUrl, context, model, zdr);
      return text;
    } catch (err) {
      const msg = getMapleErrorMessage(err);
      setError(msg);
      toast({ title: msg, variant: 'destructive' });
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, proxyUrl, model, zdr, getContext, toast]);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const preflightCheck = useCallback(
    (text: string) => {
      const btcPrice = priceData?.usdPerBtc ?? 0;
      if (!btcPrice) return { blocked: false as const };

      const intent = parseSpendIntent(text);
      if (!intent) return { blocked: false as const };

      const bucket = findCategory(intent.category, currentBudget.buckets);
      if (!bucket) return { blocked: false as const };

      const remaining = getBucketRemainingUsd(bucket, currentBudget.transactions, btcPrice);
      if (intent.amount > remaining + 0.005) {
        const overspendAmount = Math.round((intent.amount - remaining) * 100) / 100;
        return {
          blocked: true,
          reason: `This puts you $${overspendAmount.toFixed(2)} over your ${bucket.name} budget. Ask Maple how to reallocate?`,
          bucket,
          overspendAmount,
        };
      }

      return { blocked: false as const };
    },
    [currentBudget, priceData]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    analyze,
    clearHistory,
    preflightCheck,
  };
}
