import { useCallback, useState, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useMapleSettings } from './useMapleSettings';
import { useBudget } from './useBudget';
import { useBitcoinPrice } from './useBitcoinPrice';
import { useToast } from './useToast';
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

function getMonthStorageKey(month: string): string {
  return `sat-sorter:maple-chat:${month}`;
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
  const { apiKey, evergreenContext, proxyUrl } = useMapleSettings();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useLocalStorage<ChatEntry[]>(
    getMonthStorageKey(currentMonth),
    []
  );

  const abortRef = useRef<AbortController | null>(null);

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
        const history: ChatMessage[] = [
          ...previousMessages,
          { role: 'user', content: text },
        ];

        const responseText = await chatWithMaple(apiKey, proxyUrl, context, history);

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
    [apiKey, proxyUrl, messages, getContext, setMessages, toast]
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
      const text = await analyzeMonth(apiKey, proxyUrl, context);
      return text;
    } catch (err) {
      const msg = getMapleErrorMessage(err);
      setError(msg);
      toast({ title: msg, variant: 'destructive' });
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, proxyUrl, getContext, toast]);

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
