/**
 * OpenAI Quote Analyzer — ADR-327 §6 (v2.0, Google Document AI pattern).
 *
 * Pipeline: classify → extract (with CoT structure-notes) → validate → retry
 * with feedback (escalation model optional). Hierarchical lineItems flattened
 * post-extraction. Generic, zero template-specific knowledge.
 *
 * @see ADR-327 — AI Extraction Strategy v2.0
 * @see ./quote-analyzer.schemas.ts — strict JSON schemas + RAW types
 * @see ./quote-analyzer.validation.ts — self-consistency loop
 */

import 'server-only';

import { safeJsonParse } from '@/lib/json-utils';
import { isRecord } from '@/lib/type-guards';
import { getAdminBucket } from '@/lib/firebaseAdmin';
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
  type RawExtractedQuote,
  type RawComponent,
} from './quote-analyzer.schemas';
import { validateExtraction, buildRetryFeedback } from './quote-analyzer.validation';

// ============================================================================
// TYPES
// ============================================================================

interface OpenAIQuoteConfig {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  escalateModel: string | null;
  timeoutMs: number;
  maxRetries: number;
  maxValidationRetries: number;
}

type OpenAIRequestContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

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

function normalizeComponent(c: RawComponent, parentRowNumber: string | null, parentDescription: string): ExtractedQuoteLine {
  const compDesc = c.description ?? '';
  const merged = parentDescription && compDesc && !compDesc.includes(parentDescription)
    ? `${parentDescription} — ${compDesc}`
    : compDesc || parentDescription;
  return {
    description: { value: merged, confidence: c.descriptionConfidence ?? 0 },
    quantity: { value: c.quantity ?? 0, confidence: c.quantityConfidence ?? 0 },
    unit: { value: c.unit ?? '', confidence: c.unitConfidence ?? 0 },
    unitPrice: { value: c.unitPrice ?? 0, confidence: c.unitPriceConfidence ?? 0 },
    discountPercent: { value: c.discountPercent, confidence: c.discountPercentConfidence ?? 0 },
    vatRate: { value: c.vatRate ?? 24, confidence: c.vatRateConfidence ?? 0 },
    lineTotal: { value: c.lineTotal ?? 0, confidence: c.lineTotalConfidence ?? 0 },
    parentRowNumber,
  };
}

function normalizeLineItems(raw: RawExtractedQuote['lineItems']): ExtractedQuoteLine[] {
  if (!Array.isArray(raw)) return [];
  const flat: ExtractedQuoteLine[] = [];
  for (const item of raw) {
    const parentDesc = item.description ?? '';
    const components = Array.isArray(item.components) ? item.components : [];
    if (components.length === 0) {
      flat.push({
        description: { value: parentDesc, confidence: item.descriptionConfidence ?? 0 },
        quantity: { value: 1, confidence: 0 },
        unit: { value: '', confidence: 0 },
        unitPrice: { value: item.rowSubtotal ?? 0, confidence: item.rowSubtotalConfidence ?? 0 },
        discountPercent: { value: null, confidence: 0 },
        vatRate: { value: 24, confidence: 0 },
        lineTotal: { value: item.rowSubtotal ?? 0, confidence: item.rowSubtotalConfidence ?? 0 },
        parentRowNumber: item.rowNumber ?? null,
      });
      continue;
    }
    for (const c of components) {
      flat.push(normalizeComponent(c, item.rowNumber ?? null, parentDesc));
    }
  }
  return flat;
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

  async classifyQuote(fileUrl: string, mimeType: string, fileBuffer?: Buffer): Promise<QuoteClassification> {
    try {
      const content = await this.buildVisionContent(fileUrl, mimeType, 'Είναι αυτό το αρχείο προσφορά προμηθευτή;', fileBuffer);
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

  async extractQuote(fileUrl: string, mimeType: string, fileBuffer?: Buffer): Promise<ExtractedQuoteData> {
    try {
      let lastParsed: RawExtractedQuote | null = null;
      let promptText = 'Εξάγαγε τα δεδομένα της προσφοράς.';

      for (let attempt = 0; attempt <= this.config.maxValidationRetries; attempt += 1) {
        const visionModel = attempt === 0
          ? this.config.visionModel
          : (this.config.escalateModel || this.config.visionModel);
        const content = await this.buildVisionContent(fileUrl, mimeType, promptText, fileBuffer);
        const request: OpenAIRequestBody = {
          model: visionModel,
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
        if (!outputText) break;

        const parsed = safeJsonParse<RawExtractedQuote>(outputText, null as unknown as RawExtractedQuote);
        if (parsed === null) break;
        lastParsed = parsed;

        const validation = validateExtraction(parsed);
        if (validation.valid) {
          console.info(`[OpenAIQuoteAnalyzer] extraction OK on attempt ${attempt + 1} (model=${visionModel})`);
          return normalizeExtracted(parsed);
        }
        console.warn(`[OpenAIQuoteAnalyzer] validation failed on attempt ${attempt + 1}:`, validation.issues);
        promptText = buildRetryFeedback(validation.issues);
      }

      return lastParsed ? normalizeExtracted(lastParsed) : buildFallbackExtractedData();
    } catch (error) {
      console.error('[OpenAIQuoteAnalyzer] extractQuote failed:', error);
      return buildFallbackExtractedData();
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async buildVisionContent(
    fileUrl: string,
    mimeType: string,
    promptText: string,
    fileBuffer?: Buffer,
  ): Promise<OpenAIRequestContent[]> {
    const content: OpenAIRequestContent[] = [{ type: 'input_text', text: promptText }];
    if (detectImageMime(mimeType)) {
      content.push({ type: 'input_image', image_url: fileUrl });
    } else if (mimeType === 'application/pdf') {
      const b64 = fileBuffer
        ? fileBuffer.toString('base64')
        : await this.fetchFileAsBase64(fileUrl);
      content.push({ type: 'input_file', filename: 'quote.pdf', file_data: `data:application/pdf;base64,${b64}` });
    }
    return content;
  }

  private async fetchFileAsBase64(url: string): Promise<string> {
    const bucket = getAdminBucket();
    const prefix = `https://storage.googleapis.com/${bucket.name}/`;
    if (!url.startsWith(prefix)) throw new Error(`Unexpected storage URL: ${url}`);
    const storagePath = decodeURIComponent(url.slice(prefix.length));
    const [buffer] = await bucket.file(storagePath).download();
    return buffer.toString('base64');
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

  // Quote extraction is vision-heavy (table layout, multi-column numbers).
  // Default primary = gpt-4o (full vision, much better on tables than mini).
  // Escalation model used on validation retry when primary keeps producing inconsistent numbers.
  const primaryModel = (
    process.env.OPENAI_QUOTE_VISION_MODEL ||
    process.env.OPENAI_VISION_MODEL ||
    'gpt-4o'
  ).trim();
  const escalateRaw = process.env.OPENAI_QUOTE_ESCALATE_MODEL?.trim() || '';

  const config: OpenAIQuoteConfig = {
    apiKey,
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim(),
    visionModel: primaryModel,
    escalateModel: escalateRaw.length > 0 ? escalateRaw : null,
    timeoutMs: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '60000', 10),
    maxRetries: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
    maxValidationRetries: Number.parseInt(process.env.OPENAI_QUOTE_VALIDATION_RETRIES || '2', 10),
  };

  return new OpenAIQuoteAnalyzer(config);
}
