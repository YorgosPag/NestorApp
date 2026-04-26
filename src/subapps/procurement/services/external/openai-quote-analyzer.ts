/**
 * OpenAI Quote Analyzer — ADR-327 §6.
 *
 * Mirrors `OpenAIDocumentAnalyzer` (accounting) but specialized for vendor quotes.
 * Uses OpenAI Responses API + Vision (gpt-4o-mini default) with strict JSON schemas.
 *
 * @see ADR-327 — AI Extraction Strategy (Phase 2)
 * @see Pattern: src/subapps/accounting/services/external/openai-document-analyzer.ts
 */

import 'server-only';

import { safeJsonParse } from '@/lib/json-utils';
import { isRecord } from '@/lib/type-guards';
import type { IQuoteAnalyzer, QuoteClassification } from '../../types/quote-analyzer';
import type {
  ExtractedQuoteData,
  ExtractedQuoteLine,
  FieldWithConfidence,
} from '../../types/quote';
import {
  QUOTE_CLASSIFY_SCHEMA,
  QUOTE_EXTRACT_SCHEMA,
  QUOTE_CLASSIFY_PROMPT,
  QUOTE_EXTRACT_PROMPT,
} from './quote-analyzer.schemas';

// ============================================================================
// TYPES
// ============================================================================

interface OpenAIQuoteConfig {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  timeoutMs: number;
  maxRetries: number;
}

type OpenAIRequestContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

interface OpenAIRequestMessage {
  role: 'system' | 'user';
  content: OpenAIRequestContent[];
}

interface OpenAIResponsesFormat {
  type: 'json_schema';
  name: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

interface OpenAIRequestBody {
  model: string;
  input: OpenAIRequestMessage[];
  text?: { format?: OpenAIResponsesFormat };
}

interface OpenAIErrorPayload {
  error?: { message?: string; type?: string };
}

// Raw shape returned by OpenAI for QUOTE_EXTRACT_SCHEMA — flat values + parallel `confidence` object.
interface RawExtractedQuote {
  vendorName: string | null;
  vendorVat: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  quoteReference: string | null;
  lineItems: Array<{
    description: string;
    descriptionConfidence: number;
    quantity: number | null;
    quantityConfidence: number;
    unit: string | null;
    unitConfidence: number;
    unitPrice: number | null;
    unitPriceConfidence: number;
    vatRate: number | null;
    vatRateConfidence: number;
    lineTotal: number | null;
    lineTotalConfidence: number;
  }>;
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  tradeHint: string | null;
  detectedLanguage: string;
  overallConfidence: number;
  confidence: Record<string, number>;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const outputText = payload.output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText.trim();
  }

  const output = payload.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type !== 'output_text') continue;
      const text = entry.text;
      if (typeof text === 'string' && text.trim().length > 0) {
        return text.trim();
      }
    }
  }
  return null;
}

function detectImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function buildFallbackClassification(): QuoteClassification {
  return { isQuote: false, confidence: 0, detectedLanguage: 'unknown' };
}

function field<T>(value: T, confidence: number | undefined): FieldWithConfidence<T> {
  return { value, confidence: typeof confidence === 'number' ? confidence : 0 };
}

function buildFallbackExtractedData(): ExtractedQuoteData {
  return {
    vendorName: field<string | null>(null, 0),
    vendorVat: field<string | null>(null, 0),
    vendorPhone: field<string | null>(null, 0),
    vendorEmail: field<string | null>(null, 0),
    quoteDate: field<string | null>(null, 0),
    validUntil: field<string | null>(null, 0),
    quoteReference: field<string | null>(null, 0),
    lineItems: [],
    subtotal: field<number | null>(null, 0),
    vatAmount: field<number | null>(null, 0),
    totalAmount: field<number | null>(null, 0),
    paymentTerms: field<string | null>(null, 0),
    deliveryTerms: field<string | null>(null, 0),
    warranty: field<string | null>(null, 0),
    notes: field<string | null>(null, 0),
    tradeHint: field<string | null>(null, 0),
    detectedLanguage: 'unknown',
    overallConfidence: 0,
  };
}

function normalizeLineItems(raw: RawExtractedQuote['lineItems']): ExtractedQuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): ExtractedQuoteLine => ({
    description: { value: item.description ?? '', confidence: item.descriptionConfidence ?? 0 },
    quantity: { value: item.quantity ?? 0, confidence: item.quantityConfidence ?? 0 },
    unit: { value: item.unit ?? '', confidence: item.unitConfidence ?? 0 },
    unitPrice: { value: item.unitPrice ?? 0, confidence: item.unitPriceConfidence ?? 0 },
    vatRate: { value: item.vatRate ?? 24, confidence: item.vatRateConfidence ?? 0 },
    lineTotal: { value: item.lineTotal ?? 0, confidence: item.lineTotalConfidence ?? 0 },
  }));
}

function normalizeExtracted(raw: RawExtractedQuote): ExtractedQuoteData {
  const c = raw.confidence ?? {};
  return {
    vendorName: field<string | null>(raw.vendorName ?? null, c.vendorName),
    vendorVat: field<string | null>(raw.vendorVat ?? null, c.vendorVat),
    vendorPhone: field<string | null>(raw.vendorPhone ?? null, c.vendorPhone),
    vendorEmail: field<string | null>(raw.vendorEmail ?? null, c.vendorEmail),
    quoteDate: field<string | null>(raw.quoteDate ?? null, c.quoteDate),
    validUntil: field<string | null>(raw.validUntil ?? null, c.validUntil),
    quoteReference: field<string | null>(raw.quoteReference ?? null, c.quoteReference),
    lineItems: normalizeLineItems(raw.lineItems),
    subtotal: field<number | null>(raw.subtotal ?? null, c.subtotal),
    vatAmount: field<number | null>(raw.vatAmount ?? null, c.vatAmount),
    totalAmount: field<number | null>(raw.totalAmount ?? null, c.totalAmount),
    paymentTerms: field<string | null>(raw.paymentTerms ?? null, c.paymentTerms),
    deliveryTerms: field<string | null>(raw.deliveryTerms ?? null, c.deliveryTerms),
    warranty: field<string | null>(raw.warranty ?? null, c.warranty),
    notes: field<string | null>(raw.notes ?? null, c.notes),
    tradeHint: field<string | null>(raw.tradeHint ?? null, c.tradeHint),
    detectedLanguage: raw.detectedLanguage ?? 'unknown',
    overallConfidence: typeof raw.overallConfidence === 'number' ? raw.overallConfidence : 0,
  };
}

// ============================================================================
// CLASS
// ============================================================================

export class OpenAIQuoteAnalyzer implements IQuoteAnalyzer {
  private readonly config: OpenAIQuoteConfig;

  constructor(config: OpenAIQuoteConfig) {
    this.config = config;
  }

  async classifyQuote(fileUrl: string, mimeType: string): Promise<QuoteClassification> {
    try {
      const content = this.buildVisionContent(fileUrl, mimeType, 'Είναι αυτό το αρχείο προσφορά προμηθευτή;');
      const request: OpenAIRequestBody = {
        model: this.config.visionModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: QUOTE_CLASSIFY_PROMPT }] },
          { role: 'user', content },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: QUOTE_CLASSIFY_SCHEMA.name,
            description: QUOTE_CLASSIFY_SCHEMA.description,
            strict: QUOTE_CLASSIFY_SCHEMA.strict,
            schema: QUOTE_CLASSIFY_SCHEMA.schema as Record<string, unknown>,
          },
        },
      };

      const responsePayload = await this.executeRequest(request);
      const outputText = extractOutputText(responsePayload);
      if (!outputText) return buildFallbackClassification();

      const parsed = safeJsonParse<QuoteClassification>(outputText, null as unknown as QuoteClassification);
      if (parsed === null) return buildFallbackClassification();

      return {
        isQuote: Boolean(parsed.isQuote),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        detectedLanguage: parsed.detectedLanguage ?? 'unknown',
      };
    } catch (error) {
      console.error('[OpenAIQuoteAnalyzer] classifyQuote failed:', error);
      return buildFallbackClassification();
    }
  }

  async extractQuote(fileUrl: string, mimeType: string): Promise<ExtractedQuoteData> {
    try {
      const content = this.buildVisionContent(fileUrl, mimeType, 'Εξάγαγε τα δεδομένα της προσφοράς.');
      const request: OpenAIRequestBody = {
        model: this.config.visionModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: QUOTE_EXTRACT_PROMPT }] },
          { role: 'user', content },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: QUOTE_EXTRACT_SCHEMA.name,
            description: QUOTE_EXTRACT_SCHEMA.description,
            strict: QUOTE_EXTRACT_SCHEMA.strict,
            schema: QUOTE_EXTRACT_SCHEMA.schema as Record<string, unknown>,
          },
        },
      };

      const responsePayload = await this.executeRequest(request);
      const outputText = extractOutputText(responsePayload);
      if (!outputText) return buildFallbackExtractedData();

      const parsed = safeJsonParse<RawExtractedQuote>(outputText, null as unknown as RawExtractedQuote);
      if (parsed === null) return buildFallbackExtractedData();

      return normalizeExtracted(parsed);
    } catch (error) {
      console.error('[OpenAIQuoteAnalyzer] extractQuote failed:', error);
      return buildFallbackExtractedData();
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private buildVisionContent(fileUrl: string, mimeType: string, promptText: string): OpenAIRequestContent[] {
    const content: OpenAIRequestContent[] = [{ type: 'input_text', text: promptText }];
    if (detectImageMime(mimeType)) {
      content.push({ type: 'input_image', image_url: fileUrl });
    } else {
      content.push({ type: 'input_text', text: `[Attached file URL: ${fileUrl} (${mimeType})]` });
    }
    return content;
  }

  private async executeRequest(request: OpenAIRequestBody): Promise<unknown> {
    let attempt = 0;
    while (attempt <= this.config.maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(`${this.config.baseUrl}/responses`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;
          const message = errorPayload.error?.message || `OpenAI error (${response.status})`;
          throw new Error(message);
        }

        return await response.json();
      } catch (error) {
        if (attempt >= this.config.maxRetries) throw error;
        attempt += 1;
      }
    }
    throw new Error('OpenAI quote analyzer request failed');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Returns null if `OPENAI_API_KEY` not configured (caller falls back to QuoteAnalyzerStub).
 */
export function createOpenAIQuoteAnalyzer(): OpenAIQuoteAnalyzer | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const config: OpenAIQuoteConfig = {
    apiKey,
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim(),
    visionModel: (process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini').trim(),
    timeoutMs: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
    maxRetries: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
  };

  return new OpenAIQuoteAnalyzer(config);
}
