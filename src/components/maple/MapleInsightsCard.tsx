import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { useAISettings } from '@/hooks/useAISettings';
import { useBudget } from '@/hooks/useBudget';
import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { analyzeMonth, buildBudgetContext, getMapleErrorMessage } from '@/services/mapleAi';
import { cleanMarkdown } from '@/lib/cleanMarkdown';

export function MapleInsightsCard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { apiKey, evergreenContext, proxyUrl, model, zdr } = useAISettings();
  const { currentBudget, currentMonth } = useBudget();
  const { data: priceData } = useBitcoinPrice();

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btcPrice = priceData?.usdPerBtc ?? 0;
  const hasKey = apiKey.length > 0;

  if (!hasKey) return null;

  const handleAnalyze = async () => {
    if (!btcPrice) {
      toast({ title: 'BTC price unavailable', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const context = buildBudgetContext(currentMonth, currentBudget, btcPrice, evergreenContext, undefined, undefined);
      const text = await analyzeMonth(apiKey, proxyUrl, context, model, zdr);
      if (!text || !text.trim()) {
        const msg = "Maple didn't return any insights for this month. Try again or check your spending data.";
        setInsights(msg);
        toast({
          title: 'No insights returned',
          description: 'Maple sent back an empty response. Tap "Retry".',
          variant: 'destructive',
        });
        return;
      }
      setInsights(cleanMarkdown(text));
    } catch (err) {
      const msg = getMapleErrorMessage(err);
      setError(msg);
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const monthLabel = (() => {
    const [year, month] = currentMonth.split('-');
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Maple Insights
        </h2>
        {insights && (
          <span className="text-[10px] text-muted-foreground">AI-powered</span>
        )}
      </div>

      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Initial state: no insights yet, no error */}
          {!insights && !isLoading && !error && (
            <div className="p-6 text-center space-y-4">
              <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  Get AI insights for {monthLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  Maple will analyze your spending and give you 2–3 actionable
                  observations.
                </p>
              </div>
              <Button size="sm" onClick={handleAnalyze}>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze This Month
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="p-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          )}

          {/* Error state: inline error with retry button */}
          {error && !isLoading && (
            <div className="p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-md bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm text-destructive">
                  Could not generate insights
                </p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleAnalyze}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {insights && !isLoading && (
            <div className="p-5 space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {insights}
              </p>
              <div className="flex gap-4">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-xs"
                  onClick={() => navigate('/buddy')}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Ask Maple more...
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-xs"
                  onClick={handleAnalyze}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
