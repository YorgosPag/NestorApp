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

import type { IDocumentAnalyzer } from '../../types/interfaces';
import type {
  DocumentClassification,
  DocumentType,
  ExtractedDocumentData,
  ExtractedLineItem,
} from '../../types/documents';
import type { ExpenseCategory } from '../../types/common';

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
  text?: {
    format?: OpenAIResponsesFormat;
  };
}

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    type?: string;
  };
}

// ============================================================================
// SCHEMAS — OpenAI Strict Mode Compatible
// ============================================================================

/**
 * Schema for document classification
 * ALL properties in `required`, ALL objects have `additionalProperties: false`
 */
const EXPENSE_CLASSIFY_SCHEMA = {
  name: 'expense_classify',
  description: 'Classify an expense document by type and suggested category',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      documentType: {
        type: 'string',
        enum: [
          'purchase_invoice',
          'receipt',
          'utility_bill',
          'telecom_bill',
          'fuel_receipt',
          'bank_statement',
          'other',
        ],
      },
      suggestedCategory: {
        type: 'string',
        enum: [
          'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
          'vehicle_expenses', 'vehicle_insurance', 'office_supplies',
          'software', 'equipment', 'travel', 'training', 'advertising',
          'efka', 'professional_tax', 'bank_fees', 'tee_fees',
          'depreciation', 'other_expense',
        ],
      },
      typeConfidence: { type: 'number' },
      categoryConfidence: { type: 'number' },
      alternativeCategories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'third_party_fees', 'rent', 'utilities', 'telecom', 'fuel',
                'vehicle_expenses', 'vehicle_insurance', 'office_supplies',
                'software', 'equipment', 'travel', 'training', 'advertising',
                'efka', 'professional_tax', 'bank_fees', 'tee_fees',
                'depreciation', 'other_expense',
              ],
            },
            confidence: { type: 'number' },
          },
          required: ['category', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'documentType',
      'suggestedCategory',
      'typeConfidence',
      'categoryConfidence',
      'alternativeCategories',
    ],
    additionalProperties: false,
  },
} as const;

/**
 * Schema for data extraction from expense documents
 * Optional fields are nullable (type: ['string', 'null']) per strict mode rules
 */
const EXPENSE_EXTRACT_SCHEMA = {
  name: 'expense_extract',
  description: 'Extract structured data from an expense document (invoice, receipt, bill)',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      issuerName: { type: ['string', 'null'] },
      issuerVatNumber: { type: ['string', 'null'] },
      issuerAddress: { type: ['string', 'null'] },
      documentNumber: { type: ['string', 'null'] },
      issueDate: { type: ['string', 'null'] },
      netAmount: { type: ['number', 'null'] },
      vatAmount: { type: ['number', 'null'] },
      grossAmount: { type: ['number', 'null'] },
      vatRate: { type: ['number', 'null'] },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: ['number', 'null'] },
            unitPrice: { type: ['number', 'null'] },
            netAmount: { type: 'number' },
            vatRate: { type: ['number', 'null'] },
          },
          required: ['description', 'quantity', 'unitPrice', 'netAmount', 'vatRate'],
          additionalProperties: false,
        },
      },
      paymentMethod: {
        type: ['string', 'null'],
        enum: ['cash', 'bank_transfer', 'card', 'check', 'credit', 'mixed', null],
      },
      overallConfidence: { type: 'number' },
    },
    required: [
      'issuerName', 'issuerVatNumber', 'issuerAddress', 'documentNumber',
      'issueDate', 'netAmount', 'vatAmount', 'grossAmount', 'vatRate',
      'lineItems', 'paymentMethod', 'overallConfidence',
    ],
    additionalProperties: false,
  },
} as const;

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const CLASSIFY_SYSTEM_PROMPT = `Είσαι AI σύστημα ταξινόμησης παραστατικών για ελληνικό τεχνικό γραφείο (μηχανικός/κατασκευαστής).

Αναγνώρισε τον τύπο του εγγράφου:
- purchase_invoice: Τιμολόγιο αγοράς (ΤΠΥ/ΤΠ) — έχει ΑΦΜ εκδότη, αρ. παραστατικού
- receipt: Απόδειξη (ΑΛΠ/ΑΠΥ) — μικρό ποσό, λιανική
- utility_bill: ΔΕΚΟ (ΔΕΗ, ΕΥΔΑΠ, φυσικό αέριο)
- telecom_bill: Τηλεπικοινωνίες (OTE, Vodafone, Wind, Cosmote)
- fuel_receipt: Απόδειξη καυσίμων (βενζινάδικο)
- bank_statement: Τραπεζικό αντίγραφο κίνησης
- other: Λοιπά

Κατηγοριοποίησε στη σωστή κατηγορία εξόδου. Δώσε confidence 0-100.
Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;

const EXTRACT_SYSTEM_PROMPT = `Είσαι AI σύστημα εξαγωγής δεδομένων από ελληνικά παραστατικά εξόδων.

Εξάγαγε τα ακόλουθα πεδία:
- issuerName: Επωνυμία εκδότη (η εταιρεία που εξέδωσε)
- issuerVatNumber: ΑΦΜ εκδότη (9 ψηφία)
- issuerAddress: Διεύθυνση εκδότη
- documentNumber: Αριθμός παραστατικού
- issueDate: Ημερομηνία (ISO 8601: YYYY-MM-DD)
- netAmount: Καθαρό ποσό (χωρίς ΦΠΑ)
- vatAmount: Ποσό ΦΠΑ
- grossAmount: Μικτό ποσό (συνολικό)
- vatRate: Συντελεστής ΦΠΑ (6, 13, 24)
- lineItems: Γραμμές αν υπάρχουν
- paymentMethod: Τρόπος πληρωμής αν αναγράφεται
- overallConfidence: Βαθμός εμπιστοσύνης 0-100

Αν δεν αναγνωρίζεις κάποιο πεδίο, βάλε null. Μην μαντεύεις.
Επέστρεψε ΜΟΝΟ JSON σύμφωνα με το schema.`;

// ============================================================================
// HELPERS
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
      const content = this.buildVisionContent(fileUrl, mimeType, 'Ταξινόμησε αυτό το παραστατικό.');

      const request: OpenAIRequestBody = {
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

      const parsed = JSON.parse(outputText) as DocumentClassification;
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
      const mimeType = this.guessMimeFromUrl(fileUrl);
      const promptText = `Εξάγαγε δεδομένα από αυτό το ${documentType}. Τύπος εγγράφου: ${documentType}`;
      const content = this.buildVisionContent(fileUrl, mimeType, promptText);

      const request: OpenAIRequestBody = {
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

      const parsed = JSON.parse(outputText) as ExtractedDocumentData;
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

  private buildVisionContent(
    fileUrl: string,
    mimeType: string,
    promptText: string
  ): OpenAIRequestContent[] {
    const content: OpenAIRequestContent[] = [
      { type: 'input_text', text: promptText },
    ];

    if (detectImageMime(mimeType)) {
      content.push({
        type: 'input_image',
        image_url: fileUrl,
      });
    } else {
      // For PDFs and other files, instruct model via text
      content.push({
        type: 'input_text',
        text: `[Attached file URL: ${fileUrl} (${mimeType})]`,
      });
    }

    return content;
  }

  private guessMimeFromUrl(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg';
    if (lower.includes('.png')) return 'image/png';
    if (lower.includes('.webp')) return 'image/webp';
    if (lower.includes('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
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
        if (attempt >= this.config.maxRetries) {
          throw error;
        }
        attempt += 1;
      }
    }

    throw new Error('OpenAI document analyzer request failed');
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
