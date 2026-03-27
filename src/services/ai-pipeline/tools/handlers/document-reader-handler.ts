/**
 * =============================================================================
 * DOCUMENT READER HANDLER — On-Demand Document Reading via Vision API
 * =============================================================================
 *
 * Allows the AI agent to read ANY document at any time — new uploads or
 * files already attached to contacts. Downloads from Firebase Storage,
 * sends to OpenAI Vision (Responses API), returns full text extraction
 * or answers a specific question about the document.
 *
 * @module services/ai-pipeline/tools/handlers/document-reader-handler
 * @see ADR-171 (Autonomous AI Agent — read_document tool)
 * @see document-preview-service.ts (shared download/vision patterns)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { isRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';

import type { AgenticContext, ToolResult, ToolHandler } from '../executor-shared';
import {
  downloadAndValidateFile,
  isVisionSupportedMime,
} from '../../document-preview-service';
import {
  isImageMime,
  extractOutputText,
} from './contact-document-classifier';
import type { VisionContent } from './contact-document-classifier';

const logger = createModuleLogger('DOC_READER');

// ============================================================================
// CONSTANTS
// ============================================================================

const READ_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT_EXTRACT =
  'Είσαι AI βοηθός ελληνικής κατασκευαστικής/μεσιτικής εταιρείας. ' +
  'Ανάλυσε αυτό το αρχείο και εξήγαγε ΟΛΟ το περιεχόμενό του. ' +
  'Μεταγράψε κείμενα, αριθμούς, ημερομηνίες, ονόματα, ποσά — ό,τι περιέχει. ' +
  'Αν είναι εικόνα, περίγραψε τι απεικονίζεται αναλυτικά. ' +
  'Απάντησε στα ελληνικά αν το έγγραφο είναι ελληνικό, αλλιώς στη γλώσσα του εγγράφου.';

const SYSTEM_PROMPT_QA =
  'Είσαι AI βοηθός ελληνικής κατασκευαστικής/μεσιτικής εταιρείας. ' +
  'Ανάλυσε αυτό το αρχείο και απάντησε στην ερώτηση που ακολουθεί. ' +
  'Βασίσου ΜΟΝΟ στο περιεχόμενο του εγγράφου. ' +
  'Αν η απάντηση δεν βρίσκεται στο αρχείο, πες το ξεκάθαρα.';

const READ_DOCUMENT_SCHEMA = {
  name: 'read_document_result',
  description: 'Content extracted from a document or answer to a question.',
  strict: true,
  schema: {
    type: 'object',
    required: ['content', 'language', 'confidence'],
    additionalProperties: false,
    properties: {
      content: {
        type: 'string',
        description: 'Extracted text content or answer to the question.',
      },
      language: {
        type: 'string',
        description: 'Detected language (el, en, etc.).',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-1.',
      },
    },
  },
} as const;

// ============================================================================
// HANDLER
// ============================================================================

export class DocumentReaderHandler implements ToolHandler {
  readonly toolNames = ['read_document'] as const;

  async execute(
    _toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const fileRecordId = String(args.fileRecordId ?? '').trim();
    const question = typeof args.question === 'string' ? args.question.trim() : null;

    if (!fileRecordId) {
      return { success: false, error: 'fileRecordId is required.' };
    }

    // 1. Fetch FileRecord
    const db = getAdminFirestore();
    const fileDoc = await db.collection(COLLECTIONS.FILES).doc(fileRecordId).get();

    if (!fileDoc.exists) {
      return { success: false, error: `FileRecord "${fileRecordId}" not found.` };
    }

    const fileData = fileDoc.data() as Record<string, unknown>;

    // 2. Security: company isolation
    if (fileData.companyId !== ctx.companyId) {
      return { success: false, error: 'Access denied: file belongs to a different company.' };
    }

    const downloadUrl = String(fileData.downloadUrl ?? '');
    const filename = String(fileData.filename ?? fileData.originalFilename ?? 'unknown');
    const contentType = String(fileData.contentType ?? '');

    if (!downloadUrl) {
      return { success: false, error: 'File has no downloadUrl — it may still be processing.' };
    }

    // 3. MIME check
    if (!isVisionSupportedMime(contentType)) {
      return {
        success: false,
        error: `File type "${contentType}" not supported. Supported: images, PDF, Office documents.`,
      };
    }

    // 4. Download + validate
    const fileBuffer = await downloadAndValidateFile({
      downloadUrl,
      filename,
      contentType,
      fileRecordId,
    });

    if (!fileBuffer) {
      return { success: false, error: 'Failed to download file (may be too large or inaccessible).' };
    }

    // 5. Vision API call
    const result = await callReadVisionAPI({
      fileBuffer,
      filename,
      contentType,
      fileRecordId,
      question,
    });

    if (!result) {
      return { success: false, error: 'Failed to analyze document with Vision API.' };
    }

    return {
      success: true,
      data: {
        fileRecordId,
        filename,
        content: result.content,
        language: result.language,
        confidence: result.confidence,
        questionAsked: question,
      },
    };
  }
}

// ============================================================================
// VISION API
// ============================================================================

interface ReadVisionParams {
  fileBuffer: Buffer;
  filename: string;
  contentType: string;
  fileRecordId: string;
  question: string | null;
}

interface ReadVisionResult {
  content: string;
  language: string;
  confidence: number;
}

async function callReadVisionAPI(params: ReadVisionParams): Promise<ReadVisionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('No OPENAI_API_KEY — cannot read document');
    return null;
  }

  const { fileBuffer, filename, contentType, fileRecordId, question } = params;

  // Build user content
  const userPrompt = question
    ? `Ερώτηση: «${question}»\n\nFilename: ${filename}\nMIME: ${contentType}`
    : `Εξήγαγε όλο το περιεχόμενο αυτού του αρχείου.\n\nFilename: ${filename}\nMIME: ${contentType}`;

  const content: VisionContent[] = [
    { type: 'input_text', text: userPrompt },
  ];

  const base64 = fileBuffer.toString('base64');

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

  const systemPrompt = question ? SYSTEM_PROMPT_QA : SYSTEM_PROMPT_EXTRACT;
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content },
        ],
        text: { format: { type: 'json_schema', ...READ_DOCUMENT_SCHEMA } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body');
      logger.warn('Vision API non-OK for read_document', {
        status: response.status,
        fileRecordId,
        error: errorBody.substring(0, 500),
      });
      return null;
    }

    const payload: unknown = await response.json();
    return parseReadResponse(payload, fileRecordId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.warn('Vision API error for read_document', { error: msg, fileRecordId });
    return null;
  }
}

function parseReadResponse(payload: unknown, fileRecordId: string): ReadVisionResult | null {
  const outputText = extractOutputText(payload);
  if (!outputText) {
    logger.warn('No output_text in read_document response', { fileRecordId });
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(outputText);
    if (!isRecord(parsed)) return null;

    const record = parsed as Record<string, unknown>;
    return {
      content: String(record.content ?? ''),
      language: String(record.language ?? 'el'),
      confidence: Number(record.confidence ?? 0),
    };
  } catch {
    logger.warn('Failed to parse read_document JSON', { fileRecordId });
    return null;
  }
}
