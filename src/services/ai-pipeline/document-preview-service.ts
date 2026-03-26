/**
 * =============================================================================
 * DOCUMENT PREVIEW SERVICE — AI Vision Content Analysis (ADR-264)
 * =============================================================================
 *
 * Analyzes document content using OpenAI Vision when a user sends a file
 * WITHOUT an explicit command. Returns a structured summary so the agentic
 * loop can describe the document and offer actions to the user.
 *
 * Reuses download/vision patterns from contact-document-classifier.ts.
 *
 * @module services/ai-pipeline/document-preview-service
 * @see ADR-264 (Document Preview Mode)
 * @see contact-document-classifier.ts (shared vision pattern)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { isRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  downloadFile,
  isImageMime,
  extractOutputText,
} from './tools/handlers/contact-document-classifier';
import type { VisionContent } from './tools/handlers/contact-document-classifier';

const logger = createModuleLogger('DOC_PREVIEW');

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentPreviewResult {
  summary: string;
  documentType: string;
  language: string;
  suggestedActions: string[];
  confidence: number;
}

export interface DocumentPreviewParams {
  fileRecordId: string;
  downloadUrl: string;
  filename: string;
  contentType: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const PREVIEW_TIMEOUT_MS = 15_000;
const MAX_PREVIEWS_PER_MESSAGE = 2;

const VISION_SUPPORTED_PREFIXES = [
  'image/',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/msword',
];

// ============================================================================
// HELPERS
// ============================================================================

export function isVisionSupportedMime(contentType: string): boolean {
  return VISION_SUPPORTED_PREFIXES.some(p => contentType.startsWith(p));
}

export { MAX_PREVIEWS_PER_MESSAGE };

// ============================================================================
// SCHEMA (OpenAI strict JSON)
// ============================================================================

const PREVIEW_SCHEMA = {
  name: 'document_preview',
  description: 'Analyze and summarize a document for the user.',
  strict: true,
  schema: {
    type: 'object',
    required: ['summary', 'documentType', 'language', 'suggestedActions', 'confidence'],
    additionalProperties: false,
    properties: {
      summary: {
        type: 'string',
        description: 'Σύντομη περιγραφή περιεχομένου (2-4 προτάσεις, στα ελληνικά αν είναι ελληνικό).',
      },
      documentType: {
        type: 'string',
        enum: [
          'invoice', 'receipt', 'contract', 'id_card', 'passport',
          'tax_document', 'certificate', 'letter', 'cv_resume',
          'photo', 'floorplan', 'technical_drawing', 'spreadsheet',
          'presentation', 'other',
        ],
        description: 'Τύπος εγγράφου.',
      },
      language: {
        type: 'string',
        description: 'Γλώσσα εγγράφου (el, en, κλπ).',
      },
      suggestedActions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Προτεινόμενες ενέργειες (2-4, στα ελληνικά).',
      },
      confidence: {
        type: 'number',
        description: 'Βαθμός εμπιστοσύνης αναγνώρισης (0-1).',
      },
    },
  },
} as const;

const SYSTEM_PROMPT =
  'Είσαι AI βοηθός ελληνικής κατασκευαστικής/μεσιτικής εταιρείας. ' +
  'Ο χρήστης έστειλε αρχείο χωρίς εντολή. Ανάλυσε το περιεχόμενό του. ' +
  'Περίγραψε ΤΙ ΑΚΡΙΒΩΣ περιέχει (ποσά, ημερομηνίες, ονόματα, κλπ). ' +
  'Πρότεινε 2-4 λογικές ενέργειες. Απάντησε ΜΟΝΟ JSON σύμφωνα με το schema.';

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Analyze a document using OpenAI Vision and return a structured preview.
 * Returns `null` on failure (unsupported type, large file, API error).
 */
export async function previewDocument(
  params: DocumentPreviewParams
): Promise<DocumentPreviewResult | null> {
  const { downloadUrl, filename, contentType, fileRecordId } = params;

  if (!isVisionSupportedMime(contentType)) {
    logger.info('Unsupported MIME for preview', { contentType, filename });
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('No OPENAI_API_KEY — skipping document preview');
    return null;
  }

  const fileBuffer = await downloadFile(downloadUrl);
  if (!fileBuffer) {
    logger.warn('Download failed or file too large', { filename, fileRecordId });
    return null;
  }

  if (fileBuffer.byteLength > MAX_FILE_SIZE) {
    logger.info('File exceeds 4MB — skipping preview', { filename, size: fileBuffer.byteLength });
    return null;
  }

  const content = buildVisionContent(fileBuffer, filename, contentType);
  return callVisionAPI(content, apiKey, fileRecordId);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function buildVisionContent(
  buffer: Buffer,
  filename: string,
  contentType: string
): VisionContent[] {
  const userPrompt = [
    'Ανάλυσε αυτό το αρχείο. Τι τύπος εγγράφου είναι; Τι πληροφορίες περιέχει;',
    `Filename: ${filename}`,
    `MIME: ${contentType}`,
  ].join('\n');

  const content: VisionContent[] = [
    { type: 'input_text', text: userPrompt },
  ];

  const base64 = buffer.toString('base64');

  if (isImageMime(contentType)) {
    content.push({
      type: 'input_image',
      image_url: `data:${contentType};base64,${base64}`,
    });
  } else {
    content.push({
      type: 'input_file',
      filename,
      file_data: `data:${contentType};base64,${base64}`,
    });
  }

  return content;
}

async function callVisionAPI(
  content: VisionContent[],
  apiKey: string,
  fileRecordId: string
): Promise<DocumentPreviewResult | null> {
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', ...PREVIEW_SCHEMA } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body');
      logger.warn('Vision API non-OK', {
        status: response.status,
        fileRecordId,
        error: errorBody.substring(0, 500),
      });
      return null;
    }

    const payload: unknown = await response.json();
    return parsePreviewResponse(payload, fileRecordId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.warn('Vision API error', { error: msg, fileRecordId });
    return null;
  }
}

function parsePreviewResponse(
  payload: unknown,
  fileRecordId: string
): DocumentPreviewResult | null {
  const outputText = extractOutputText(payload);
  if (!outputText) {
    logger.warn('No output_text in vision response', { fileRecordId });
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(outputText);
    if (!isRecord(parsed)) return null;

    const record = parsed as Record<string, unknown>;
    return {
      summary: String(record.summary ?? ''),
      documentType: String(record.documentType ?? 'other'),
      language: String(record.language ?? 'el'),
      suggestedActions: Array.isArray(record.suggestedActions)
        ? (record.suggestedActions as unknown[]).map(String).slice(0, 4)
        : [],
      confidence: Number(record.confidence ?? 0),
    };
  } catch {
    logger.warn('Failed to parse preview JSON', { fileRecordId });
    return null;
  }
}
