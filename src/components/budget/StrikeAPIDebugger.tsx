import { useState } from 'react';
import { AlertCircle, Play, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface TestResult {
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  responsePreview?: string;
  success: boolean;
  error?: string;
  time: number;
}

export function StrikeAPIDebugger() {
  const [apiKey, setApiKey] = useState('');
  const [customUrl, setCustomUrl] = useState('https://api.strike.me');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpoints = [
    '/v1/me',
    '/v1/account',
    '/v1/profile',
    '/v1/user',
    '/v1/users/me',
    '/account',
    '/profile',
    '/me',
    '/user',
    '/api/v1/me',
    '/v2/me',
    '/',
  ];

  const testEndpoint = async (endpoint: string, headers: Record<string, string>) => {
    const startTime = Date.now();
    const url = `${customUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      });

      const time = Date.now() - startTime;

      let responsePreview = '';
      try {
        const contentType = response.headers.get('content-type');
        let body;
        if (contentType?.includes('application/json')) {
          body = await response.json();
          responsePreview = JSON.stringify(body).substring(0, 100);
        } else {
          body = await response.text();
          responsePreview = body.substring(0, 100);
        }
      } catch (e) {
        responsePreview = '(Could not read response)';
      }

      return {
        endpoint,
        method: 'GET',
        status: response.status,
        statusText: response.statusText,
        responsePreview: responsePreview || undefined,
        success: response.ok,
        time,
      };
    } catch (error) {
      const time = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        endpoint,
        method: 'GET',
        success: false,
        error: errorMsg,
        time,
      };
    }
  };

  const runTests = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }

    setIsTesting(true);
    setResults([]);

    const headerVariations = [
      { name: 'Bearer', headers: { Authorization: `Bearer ${apiKey}` } },
      { name: 'X-API-Key', headers: { 'X-API-Key': apiKey } },
      { name: 'Basic', headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` } },
    ];

    for (const headerVar of headerVariations) {
      for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint, headerVar.headers);
        setResults((prev) => [
          ...prev,
          {
            ...result,
            endpoint: `[${headerVar.name}] ${endpoint}`,
          },
        ]);

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsTesting(false);
  };

  const copyResults = () => {
    const text = results
      .map(
        (r) =>
          `${r.endpoint}\n` +
          `  Status: ${r.status || 'Error'} ${r.statusText || ''}\n` +
          `  Success: ${r.success ? '✓' : '✗'}\n` +
          (r.error ? `  Error: ${r.error}\n` : '') +
          (r.responsePreview ? `  Response: ${r.responsePreview}\n` : '') +
          `  Time: ${r.time}ms\n`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const successfulEndpoints = results.filter((r) => r.success);
  const statusCounts = results.reduce(
    (acc, r) => {
      const key = r.status || 'Error';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          🔍 Debug API
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Strike API Endpoint Debugger</DialogTitle>
          <DialogDescription>
            Test different endpoints to find what works with your API key. This will help us
            identify the correct Strike API structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This tool tests 39 endpoint combinations (13 endpoints × 3 auth methods). It will
              take about 5-10 seconds. Your results help us improve Strike integration!
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="debug-api-key">Strike API Key</Label>
            <div className="relative">
              <Input
                id="debug-api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Paste your Strike API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isTesting}
              />
              <button
                type="button"
                className="absolute right-3 top-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Custom URL */}
          <div className="space-y-2">
            <Label htmlFor="custom-url">Base URL (optional)</Label>
            <Input
              id="custom-url"
              placeholder="https://api.strike.me"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              disabled={isTesting}
            />
          </div>

          {/* Run Tests */}
          <Button onClick={runTests} disabled={!apiKey.trim() || isTesting} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            {isTesting
              ? 'Testing endpoints (this takes a moment)...'
              : 'Test All Endpoints (39 tests)'}
          </Button>

          {/* Summary */}
          {results.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {successfulEndpoints.length}
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">Working</div>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Object.entries(statusCounts)
                      .filter(([key]) => key.startsWith('2') || key.startsWith('3'))
                      .reduce((sum, [, count]) => sum + count, 0)}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">2xx/3xx</div>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {results.filter((r) => !r.success && !r.status).length}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300">Errors</div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="bg-muted p-3 rounded text-sm space-y-1">
                <p className="font-semibold">Status Code Breakdown:</p>
                {Object.entries(statusCounts)
                  .sort()
                  .map(([status, count]) => (
                    <p key={status} className="text-xs">
                      {status === 'Error' ? 'Network Errors' : `HTTP ${status}`}: {count} results
                    </p>
                  ))}
              </div>

              {/* Working Endpoints */}
              {successfulEndpoints.length > 0 && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm">✓ Working Endpoints:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {successfulEndpoints.map((result, idx) => (
                      <div key={idx} className="p-2 bg-green-50 dark:bg-green-950 rounded text-sm">
                        <p className="font-mono text-xs">{result.endpoint}</p>
                        {result.responsePreview && (
                          <p className="text-xs text-muted-foreground mt-1">{result.responsePreview}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Results */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">All Results:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyResults}
                    className="text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy All
                      </>
                    )}
                  </Button>
                </div>

                <div className="p-3 bg-muted rounded max-h-60 overflow-y-auto">
                  <div className="space-y-2 text-xs font-mono">
                    {results.map((result, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <Badge className="h-5" variant="default">
                              {result.status}
                            </Badge>
                          ) : (
                            <Badge className="h-5" variant="destructive">
                              {result.status || 'ERR'}
                            </Badge>
                          )}
                          <span className="font-semibold">{result.endpoint}</span>
                        </div>
                        {result.error && (
                          <div className="text-red-600 dark:text-red-400 ml-12">
                            {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Found working endpoints?</strong> Share the green ones above! They show
                  which endpoints and authentication methods work with your API key. This will help
                  us fix the Strike integration for everyone.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
