import { useState, useRef, useCallback } from 'react';
import { Camera, Loader2, X, AlertCircle, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/hooks/useToast';
import { compressImage, scanReceipt, getScanErrorMessage, type ReceiptData } from '@/services/receiptOcr';

interface ReceiptScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete: (data: ReceiptData) => void;
}

/**
 * Receipt Scanner — captures a photo (or file upload), compresses it,
 * sends it to the user's AI vision model, and returns structured receipt data.
 *
 * Flow:
 * 1. User takes a photo or picks an image file
 * 2. Image is compressed to JPEG (~200-500KB)
 * 3. Image is sent to the AI provider with a vision model
 * 4. AI returns structured JSON (merchant, total, line items)
 * 5. Parent component (AddTransactionDialog) receives the data
 */
export function ReceiptScanner({ open, onOpenChange, onScanComplete }: ReceiptScannerProps) {
  const { apiKey, proxyUrl, model, zdr, provider, hasKey } = useAISettings();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setPreview(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large. Please use an image under 10MB.');
      return;
    }

    if (!hasKey) {
      setError('Add an API key in Budget Buddy settings first.');
      return;
    }

    try {
      // Show preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Compress the image
      const compressedDataUrl = await compressImage(file);
      setIsScanning(true);

      // Send to AI vision model
      const data = await scanReceipt(compressedDataUrl, apiKey, proxyUrl, model, zdr);

      setIsScanning(false);
      setPreview(null);

      // Return the extracted data to the parent
      onScanComplete(data);

      toast({
        title: 'Receipt scanned!',
        description: data.merchant
          ? `Found ${data.merchant} — $${data.total.toFixed(2)}`
          : `Extracted ${data.lineItems.length} items — $${data.total.toFixed(2)}`,
      });

      onOpenChange(false);
    } catch (err) {
      setIsScanning(false);
      setPreview(null);
      const msg = getScanErrorMessage(err);
      setError(msg);
    }
  }, [apiKey, proxyUrl, model, zdr, hasKey, onScanComplete, toast, onOpenChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setError(null);
      setPreview(null);
      setIsScanning(false);
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Scan Receipt
          </DialogTitle>
          <DialogDescription>
            Take a photo of your receipt or upload an image. AI will extract the details automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input — accepts camera capture on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="py-4 space-y-4">
          {/* Preview + scanning state */}
          {preview && (
            <div className="relative rounded-xl overflow-hidden border">
              <img src={preview} alt="Receipt preview" className="w-full max-h-64 object-cover" />
              {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                  <p className="text-white text-sm font-medium">Reading receipt...</p>
                  <p className="text-white/70 text-xs">Extracting items and prices</p>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isScanning && (
            <div className="space-y-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full btn-interactive"
                size="lg"
                disabled={!hasKey}
              >
                <Camera className="h-5 w-5 mr-2" />
                Take Photo
              </Button>

              {/* Upload from gallery alternative */}
              <Button
                variant="outline"
                onClick={() => {
                  // Remove capture attribute for gallery selection
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                  }
                }}
                className="w-full"
                disabled={!hasKey}
              >
                <FileImage className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            </div>
          )}

          {/* Privacy notice */}
          {!isScanning && !error && (
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Your receipt image is processed by {provider === 'ppq' ? 'PPQ' : 'Maple'} AI.
              {zdr && provider === 'ppq' && ' Zero Data Retention is enabled — your data is not stored.'}
            </p>
          )}

          {/* Not configured notice */}
          {!hasKey && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Add an API key from Maple or PPQ in Budget Buddy settings to enable receipt scanning.
              </p>
            </div>
          )}
        </div>

        {/* Close button */}
        {!isScanning && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
