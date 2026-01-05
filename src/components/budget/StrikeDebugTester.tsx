import { useState } from 'react';
import { AlertCircle, Play, RotateCcw, Copy, Check } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface TestResult {
  name: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  success: boolean;
  error?: string;
  time: number;
}

export function StrikeDebugTester() {
  const [apiKey, setApiKey] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const testMethods = [
    {
      name: 'Bearer token at /v1/me',
      url: 'https://api.strike.me/v1/me',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    {
      name: 'X-API-Key header at /v1/me',
      url: 'https://api.strike.me/v1/me',
      headers: { 'X-API-Key': apiKey },
    },
    {
      name: 'Bearer token at /v1/account',
      url: 'https://api.strike.me/v1/account',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    {
      name: 'Bearer token at /v1/user',
      url: 'https://api.strike.me/v1/user',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  ];

  const runTests = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }

    setIsTesting(true);
    setResults([]);

    for (const method of testMethods) {
      const startTime = Date.now();
      try {
        const response = await fetch(method.url, {
          method: 'GET',
          headers: {
            ...method.headers,
            'Content-Type': 'application/json',
          },
        });

        const time = Date.now() - startTime;
        const result: TestResult = {
          name: method.name,
          url: method.url,
          method: 'GET',
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          time,
        };

        setResults((prev) => [...prev, result]);
      } catch (error) {
        const time = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result: TestResult = {
          name: method.name,
          url: method.url,
          method: 'GET',
          success: false,
          error: errorMsg,
          time,
        };
        setResults((prev) => [...prev, result]);
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setIsTesting(false);
  };

  const resetTests = () => {
    setResults([]);
    setApiKey('');
  };

  const copyLogs = () => {
    const text = results
      .map(
        (r) =>
          `${r.name}\n` +
          `  URL: ${r.url}\n` +
          `  Status: ${r.status || 'Error'} ${r.statusText || ''}\n` +
          `  Success: ${r.success ? '✓' : '✗'}\n` +
          (r.error ? `  Error: ${r.error}\n` : '') +
          `  Time: ${r.time}ms\n`
      )
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          Debug
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Strike API Debug Tester</DialogTitle>
          <DialogDescription>
            Test different authentication methods to find what works with your API key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This tool tests various authentication methods against Strike API. It helps identify
              which method works with your key.
            </AlertDescription>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="debug-api-key">API Key</Label>
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

          {/* Test Buttons */}
          <div className="flex gap-2">
            <Button onClick={runTests} disabled={!apiKey.trim() || isTesting} className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              {isTesting ? 'Testing...' : 'Run Tests'}
            </Button>
            <Button variant="outline" onClick={resetTests} disabled={isTesting}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Test Results</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyLogs}
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
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-sm ${
                      result.success
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          {result.url}
                        </p>
                      </div>
                      <Badge variant={result.success ? 'default' : 'destructive'} className="ml-2">
                        {result.success
                          ? `${result.status}`
                          : result.status
                          ? `${result.status}`
                          : 'Error'}
                      </Badge>
                    </div>

                    {result.statusText && (
                      <p className="text-xs mt-2">{result.statusText}</p>
                    )}

                    {result.error && (
                      <p className="text-xs mt-2 text-red-600 dark:text-red-300">
                        {result.error}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">{result.time}ms</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="p-3 bg-muted rounded-lg text-sm">
                {results.some((r) => r.success) ? (
                  <p className="text-green-600 dark:text-green-300">
                    ✓ Found {results.filter((r) => r.success).length} working method(s)!
                  </p>
                ) : (
                  <p className="text-red-600 dark:text-red-300">
                    ✗ No working authentication method found. Try a different API key.
                  </p>
                )}
              </div>

              {/* Advice */}
              <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
                <p>
                  <strong>Next steps:</strong>
                </p>
                {results.some((r) => r.success) ? (
                  <p>
                    Your API key works! Try connecting in Sat Sorter normally. The app will try
                    all methods.
                  </p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Check that you copied your key correctly from Strike Settings</li>
                    <li>Verify the key hasn't expired</li>
                    <li>Try generating a new API key in Strike</li>
                    <li>Check that https://strike.me is accessible</li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
