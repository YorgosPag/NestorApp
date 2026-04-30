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
import { rasterizePdfPages, RasterizeUnavailableError } from '@/services/pdf/pdf-rasterize.service';
import type { IQuoteAnalyzer, QuoteClassification } from '../../types/quote-analyzer';
import type { ExtractedQuoteData } from '../../types/quote';
import {
  QUOTE_CLASSIFY_SCHEMA,
  QUOTE_EXTRACT_SCHEMA,
  QUOTE_CLASSIFY_PROMPT,
  QUOTE_EXTRACT_PROMPT,
  type RawExtractedQuote,
} from './quote-analyzer.schemas';
import {
  buildFallbackExtractedData,
  normalizeExtracted,
} from './quote-analyzer.normalizers';
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
  rasterizePdf: boolean;
  rasterDpi: number;
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
      let lastIssues: string[] = [];
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
          return normalizeExtracted(parsed, [], validation.warnings);
        }
        lastIssues = validation.issues;
        console.warn(`[OpenAIQuoteAnalyzer] validation failed on attempt ${attempt + 1}:`, validation.issues);
        promptText = buildRetryFeedback(validation.issues);
      }

      return lastParsed
        ? normalizeExtracted(lastParsed, lastIssues)
        : buildFallbackExtractedData();
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
      const buffer = fileBuffer ?? await this.fetchFileAsBuffer(fileUrl);
      let usedRaster = false;
      if (this.config.rasterizePdf) {
        try {
          const pageBuffers = await rasterizePdfPages(buffer, { dpi: this.config.rasterDpi, maxPages: 10 });
          for (const png of pageBuffers) {
            const b64 = png.toString('base64');
            content.push({ type: 'input_image', image_url: `data:image/png;base64,${b64}` });
          }
          usedRaster = true;
        } catch (err) {
          if (err instanceof RasterizeUnavailableError) {
            console.warn('[OpenAIQuoteAnalyzer] PDF rasterize unavailable, falling back to native input_file:', err.message);
          } else {
            console.error('[OpenAIQuoteAnalyzer] PDF rasterize threw, falling back to native input_file:', err);
          }
        }
      }
      if (!usedRaster) {
        const b64 = buffer.toString('base64');
        content.push({ type: 'input_file', filename: 'quote.pdf', file_data: `data:application/pdf;base64,${b64}` });
      }
    }
    return content;
  }

  private async fetchFileAsBuffer(url: string): Promise<Buffer> {
    const bucket = getAdminBucket();
    const prefix = `https://storage.googleapis.com/${bucket.name}/`;
    if (!url.startsWith(prefix)) throw new Error(`Unexpected storage URL: ${url}`);
    const storagePath = decodeURIComponent(url.slice(prefix.length));
    const [buffer] = await bucket.file(storagePath).download();
    return buffer;
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

  // Rasterize PDF → PNG before vision call. Bypasses native PDF parsing limits
  // for column-heavy/image-overlay layouts (FENPLAST-class). Disable via env=0.
  const rasterizePdf = (process.env.OPENAI_QUOTE_RASTERIZE_PDF || '1').trim() !== '0';

  const config: OpenAIQuoteConfig = {
    apiKey,
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim(),
    visionModel: primaryModel,
    escalateModel: escalateRaw.length > 0 ? escalateRaw : null,
    timeoutMs: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10),
    maxRetries: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
    maxValidationRetries: Number.parseInt(process.env.OPENAI_QUOTE_VALIDATION_RETRIES || '2', 10),
    rasterizePdf,
    rasterDpi: Number.parseInt(process.env.OPENAI_QUOTE_RASTER_DPI || '200', 10),
  };

  return new OpenAIQuoteAnalyzer(config);
}
