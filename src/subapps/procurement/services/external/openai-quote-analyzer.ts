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

import { downloadAdminObjectByPublicUrl } from '@/lib/firebaseAdmin-storage';
import { beginVisionContent, type ResponsesContent } from '@/services/ai/openai-responses';
import { readDocumentAnalyzerTransport, requestStructuredDocument } from '@/services/ai/structured-document-request';
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
import {
  validateExtraction,
  buildRetryFeedback,
  EMPTY_OUTPUT_ISSUE,
  UNPARSEABLE_ISSUE,
} from './quote-analyzer.validation';

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
      const outcome = await requestStructuredDocument(this.config, {
        model: this.config.visionModel,
        system: QUOTE_CLASSIFY_PROMPT,
        content,
        schema: { ...QUOTE_CLASSIFY_SCHEMA, schema: QUOTE_CLASSIFY_SCHEMA.schema as Record<string, unknown> },
      });
      if (outcome.kind !== 'parsed') return buildFallbackClassification();
      const parsed = outcome.value as QuoteClassification;

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
        const outcome = await requestStructuredDocument(this.config, {
          model: visionModel,
          system: QUOTE_EXTRACT_PROMPT,
          content,
          schema: { ...QUOTE_EXTRACT_SCHEMA, schema: QUOTE_EXTRACT_SCHEMA.schema as Record<string, unknown> },
        });

        // An empty or unparseable response is a transient model failure — the
        // same class of problem as inconsistent numbers, so it takes the same
        // road: retry with feedback, escalating the model on attempt 1+.
        // Bailing out here instead would spend the LEAST effort on the most
        // recoverable failure.
        if (outcome.kind !== 'parsed') {
          lastIssues = [outcome.kind === 'unparseable' ? UNPARSEABLE_ISSUE : EMPTY_OUTPUT_ISSUE];
          console.warn(`[OpenAIQuoteAnalyzer] no usable JSON on attempt ${attempt + 1}:`, lastIssues);
          promptText = buildRetryFeedback(lastIssues, 'parse');
          continue;
        }
        const parsed = outcome.value as RawExtractedQuote;
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
  ): Promise<ResponsesContent[]> {
    const { content, pdfAttachmentPending } = beginVisionContent(promptText, fileUrl, mimeType);
    if (pdfAttachmentPending) {
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
    return downloadAdminObjectByPublicUrl(url);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Returns null if `OPENAI_API_KEY` not configured (caller falls back to QuoteAnalyzerStub).
 */
export function createOpenAIQuoteAnalyzer(): OpenAIQuoteAnalyzer | null {
  const transport = readDocumentAnalyzerTransport();
  if (!transport) return null;

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
    ...transport,
    visionModel: primaryModel,
    escalateModel: escalateRaw.length > 0 ? escalateRaw : null,
    maxValidationRetries: Number.parseInt(process.env.OPENAI_QUOTE_VALIDATION_RETRIES || '2', 10),
    rasterizePdf,
    rasterDpi: Number.parseInt(process.env.OPENAI_QUOTE_RASTER_DPI || '200', 10),
  };

  return new OpenAIQuoteAnalyzer(config);
}
