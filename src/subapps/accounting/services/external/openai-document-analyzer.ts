/**
 * @fileoverview OpenAI Document Analyzer — AI Vision-powered Document Processing
 * @description Implements IDocumentAnalyzer using OpenAI Responses API (Vision)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @see Pattern: src/services/ai-analysis/providers/OpenAIAnalysisProvider.ts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

import 'server-only';

import { safeJsonParse } from '@/lib/json-utils';
import { canonicalMimeForUrl, filenameFromUrl } from '@/config/file-types/classification-registry';
import { downloadAdminObjectByPublicUrl } from '@/lib/firebaseAdmin-storage';
import {
  beginVisionContent,
  executeResponsesRequest,
  extractOutputText,
  type ResponsesContent,
  type ResponsesRequestBody,
} from '@/services/ai/openai-responses';
import type { IDocumentAnalyzer } from '../../types/interfaces';
import type {
  DocumentClassification,
  DocumentType,
  ExtractedDocumentData,
  ExtractedLineItem,
} from '../../types/documents';
import type { ExpenseCategory } from '../../types/common';
import {
  EXPENSE_CLASSIFY_SCHEMA,
  EXPENSE_EXTRACT_SCHEMA,
  CLASSIFY_SYSTEM_PROMPT,
  EXTRACT_SYSTEM_PROMPT,
} from './document-analyzer.schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Used only when the URL carries no usable filename segment. */
const FALLBACK_PDF_FILENAME = 'document.pdf';

// ============================================================================
// TYPES
// ============================================================================

interface OpenAIDocumentConfig {
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  timeoutMs: number;
  maxRetries: number;
}

// ============================================================================
// FALLBACK RESULTS
// ============================================================================

function buildFallbackClassification(): DocumentClassification {
  return {
    documentType: 'other',
    suggestedCategory: 'other_expense',
    typeConfidence: 0,
    categoryConfidence: 0,
    alternativeCategories: [],
  };
}

function buildFallbackExtractedData(): ExtractedDocumentData {
  return {
    issuerName: null,
    issuerVatNumber: null,
    issuerAddress: null,
    documentNumber: null,
    issueDate: null,
    netAmount: null,
    vatAmount: null,
    grossAmount: null,
    vatRate: null,
    lineItems: [],
    paymentMethod: null,
    overallConfidence: 0,
  };
}

// ============================================================================
// OpenAI Document Analyzer
// ============================================================================

export class OpenAIDocumentAnalyzer implements IDocumentAnalyzer {
  private readonly config: OpenAIDocumentConfig;

  constructor(config: OpenAIDocumentConfig) {
    this.config = config;
  }

  // ── classifyDocument ────────────────────────────────────────────────────

  async classifyDocument(
    fileUrl: string,
    mimeType: string
  ): Promise<DocumentClassification> {
    try {
      const content = await this.buildVisionContent(fileUrl, mimeType, 'Ταξινόμησε αυτό το παραστατικό.');

      const request: ResponsesRequestBody = {
        model: this.config.visionModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: CLASSIFY_SYSTEM_PROMPT }] },
          { role: 'user', content },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: EXPENSE_CLASSIFY_SCHEMA.name,
            description: EXPENSE_CLASSIFY_SCHEMA.description,
            strict: EXPENSE_CLASSIFY_SCHEMA.strict,
            schema: EXPENSE_CLASSIFY_SCHEMA.schema as Record<string, unknown>,
          },
        },
      };

      const responsePayload = await this.executeRequest(request);
      const outputText = extractOutputText(responsePayload);

      if (!outputText) {
        return buildFallbackClassification();
      }

      const parsed = safeJsonParse<DocumentClassification>(outputText, null as unknown as DocumentClassification);
      if (parsed === null) {
        return buildFallbackClassification();
      }
      return {
        documentType: parsed.documentType,
        suggestedCategory: parsed.suggestedCategory,
        typeConfidence: parsed.typeConfidence,
        categoryConfidence: parsed.categoryConfidence,
        alternativeCategories: parsed.alternativeCategories ?? [],
      };
    } catch (error) {
      console.error('[OpenAIDocumentAnalyzer] classifyDocument failed:', error);
      return buildFallbackClassification();
    }
  }

  // ── extractData ─────────────────────────────────────────────────────────

  async extractData(
    fileUrl: string,
    documentType: DocumentType
  ): Promise<ExtractedDocumentData> {
    try {
      const mimeType = canonicalMimeForUrl(fileUrl);
      const promptText = `Εξάγαγε δεδομένα από αυτό το ${documentType}. Τύπος εγγράφου: ${documentType}`;
      const content = await this.buildVisionContent(fileUrl, mimeType, promptText);

      const request: ResponsesRequestBody = {
        model: this.config.visionModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: EXTRACT_SYSTEM_PROMPT }] },
          { role: 'user', content },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: EXPENSE_EXTRACT_SCHEMA.name,
            description: EXPENSE_EXTRACT_SCHEMA.description,
            strict: EXPENSE_EXTRACT_SCHEMA.strict,
            schema: EXPENSE_EXTRACT_SCHEMA.schema as Record<string, unknown>,
          },
        },
      };

      const responsePayload = await this.executeRequest(request);
      const outputText = extractOutputText(responsePayload);

      if (!outputText) {
        return buildFallbackExtractedData();
      }

      const parsed = safeJsonParse<ExtractedDocumentData>(outputText, null as unknown as ExtractedDocumentData);
      if (parsed === null) {
        return buildFallbackExtractedData();
      }
      return this.normalizeExtractedData(parsed);
    } catch (error) {
      console.error('[OpenAIDocumentAnalyzer] extractData failed:', error);
      return buildFallbackExtractedData();
    }
  }

  // ── categorizeExpense ───────────────────────────────────────────────────

  async categorizeExpense(
    _issuerVatNumber: string,
    _description: string
  ): Promise<ExpenseCategory | null> {
    // Phase 1: Vendor learning will be implemented when we have enough data.
    // For now, returns null to indicate no learned category available.
    return null;
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private async buildVisionContent(
    fileUrl: string,
    mimeType: string,
    promptText: string,
  ): Promise<ResponsesContent[]> {
    const { content, pdfAttachmentPending } = beginVisionContent(promptText, fileUrl, mimeType);
    if (pdfAttachmentPending) {
      const b64 = await this.fetchFileAsBase64(fileUrl);
      // The real filename is a signal the model reads ("ΤΙΜΟΛΟΓΙΟ_2026.pdf");
      // the generic fallback only applies to URLs with no usable segment.
      const filename = filenameFromUrl(fileUrl) || FALLBACK_PDF_FILENAME;
      content.push({ type: 'input_file', filename, file_data: `data:application/pdf;base64,${b64}` });
    }
    return content;
  }

  private async fetchFileAsBase64(url: string): Promise<string> {
    const buffer = await downloadAdminObjectByPublicUrl(url);
    return buffer.toString('base64');
  }

  private normalizeExtractedData(raw: ExtractedDocumentData): ExtractedDocumentData {
    const lineItems: ExtractedLineItem[] = Array.isArray(raw.lineItems)
      ? raw.lineItems.map((item) => ({
          description: item.description ?? '',
          quantity: item.quantity ?? null,
          unitPrice: item.unitPrice ?? null,
          netAmount: item.netAmount ?? 0,
          vatRate: item.vatRate ?? null,
        }))
      : [];

    return {
      issuerName: raw.issuerName ?? null,
      issuerVatNumber: raw.issuerVatNumber ?? null,
      issuerAddress: raw.issuerAddress ?? null,
      documentNumber: raw.documentNumber ?? null,
      issueDate: raw.issueDate ?? null,
      netAmount: raw.netAmount ?? null,
      vatAmount: raw.vatAmount ?? null,
      grossAmount: raw.grossAmount ?? null,
      vatRate: raw.vatRate ?? null,
      lineItems,
      paymentMethod: raw.paymentMethod ?? null,
      overallConfidence: raw.overallConfidence ?? 0,
    };
  }

  private async executeRequest(request: ResponsesRequestBody): Promise<unknown> {
    return executeResponsesRequest(this.config, request);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create OpenAI Document Analyzer from environment variables.
 * Returns null if OPENAI_API_KEY is not configured (graceful fallback to stub).
 */
export function createOpenAIDocumentAnalyzer(): OpenAIDocumentAnalyzer | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const config: OpenAIDocumentConfig = {
    apiKey,
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').trim(),
    visionModel: (process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini').trim(),
    timeoutMs: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
    maxRetries: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
  };

  return new OpenAIDocumentAnalyzer(config);
}
