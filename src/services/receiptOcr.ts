/**
 * Receipt OCR service — sends a receipt image to an AI vision model
 * and returns structured data (merchant, total, date, line items).
 *
 * Uses the same OpenAI-compatible API as the chat feature, but sends
 * the image as base64 in the message content (multimodal/vision format).
 *
 * The user's configured AI provider (Maple or PPQ) handles the vision
 * request. Both support OpenAI-compatible vision models.
 */

import { getMapleErrorMessage } from './mapleAi';

export interface ReceiptLineItem {
  name: string;
  price: number;
}

export interface ReceiptData {
  merchant: string;
  total: number;
  date?: string;
  tax?: number;
  lineItems: ReceiptLineItem[];
}

const RECEIPT_SYSTEM_PROMPT = `You are a receipt scanner. Extract the merchant name, total amount, date, and individual line items from this receipt image. Return ONLY valid JSON with this exact format:
{
  "merchant": "store name",
  "total": 100.00,
  "date": "YYYY-MM-DD or null if not found",
  "tax": 0.00,
  "lineItems": [
    {"name": "item name", "price": 10.00}
  ]
}
Rules:
- All amounts should be numbers (not strings)
- If a field can't be determined, use null for strings and 0 for numbers
- Do NOT include markdown formatting, code blocks, or explanations — only the JSON object
- Combine multi-line item descriptions into a single line item name`;

/**
 * Compress an image file to JPEG with max dimensions for fast upload.
 * Returns a base64 data URL.
 */
export function compressImage(file: File, maxSize = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Scale down if either dimension exceeds maxSize
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Build the chat completions URL from a base proxy URL */
function getChatCompletionsUrl(proxyUrl: string): string {
  const base = proxyUrl.replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

/**
 * Scan a receipt image and extract structured data using AI vision.
 *
 * @param imageDataUrl - Base64 data URL of the compressed receipt image
 * @param apiKey - API key for the AI provider
 * @param proxyUrl - Base URL for the AI provider
 * @param model - Vision-capable model ID
 * @param zdr - Whether to use zero-data-retention routing (PPQ)
 * @returns Parsed receipt data
 */
export async function scanReceipt(
  imageDataUrl: string,
  apiKey: string,
  proxyUrl: string,
  model: string,
  zdr: boolean = false
): Promise<ReceiptData> {
  const url = getChatCompletionsUrl(proxyUrl);

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content: RECEIPT_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all data from this receipt image and return it as JSON.',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    temperature: 0.1, // Low temperature for accurate extraction
    max_tokens: 1024,
    stream: false, // Non-streaming for structured extraction
  };

  // PPQ zero-data-retention routing
  if (zdr) {
    requestBody.provider = { zdr: true };
  }

  // Try direct request, fall back to CORS proxy if blocked
  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  // CORS fallback
  if (!response.ok && response.status === 0) {
    const corsUrl = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(url)}`;
    response = await fetch(corsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key. Check your settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please try again in a moment.');
    }
    throw new Error(`Scan failed (${response.status}): ${errorText}`);
  }

  // Parse the response — non-streaming, so we get the full JSON at once
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from AI model.');
  }

  // Extract JSON from the response (model may wrap it in markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse receipt data from AI response.');
  }

  const parsed: ReceiptData = JSON.parse(jsonMatch[0]);

  // Validate the extracted data
  if (!parsed.merchant && !parsed.total && (!parsed.lineItems || parsed.lineItems.length === 0)) {
    throw new Error('No receipt data found in the image. Try taking a clearer photo.');
  }

  return parsed;
}

/**
 * Get a user-friendly error message for receipt scanning failures.
 */
export function getScanErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
      return 'Cannot reach the AI provider. Check your connection and try again.';
    }
    if (error.message.includes('Invalid API key')) {
      return 'Invalid API key. Update your key in Budget Buddy settings.';
    }
    if (error.message.includes('No receipt data')) {
      return 'Could not read the receipt. Make sure the photo is clear and well-lit.';
    }
    if (error.message.includes('parse')) {
      return 'Could not parse the receipt. Try taking another photo.';
    }
    return error.message;
  }
  return 'An unexpected error occurred while scanning. Please try again.';
}
