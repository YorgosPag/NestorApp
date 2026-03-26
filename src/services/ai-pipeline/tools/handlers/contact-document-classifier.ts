/**
 * =============================================================================
 * CONTACT DOCUMENT CLASSIFIER — AI Vision Auto-Classification
 * =============================================================================
 *
 * Classifies uploaded documents into contact-specific categories using
 * OpenAI vision. Maps to the 117 upload entry point purposes so files
 * land in the correct card (e.g., "Ταυτότητα" instead of "Άλλο Γενικό").
 *
 * @module services/ai-pipeline/tools/handlers/contact-document-classifier
 * @see ADR-191 (Enterprise Document Management)
 * @see entries-contact.ts (Upload Entry Points SSoT)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { CONTACT_ENTRY_POINTS } from '@/config/upload-entry-points/entries-contact';
import { isRecord } from '@/lib/type-guards';

// ============================================================================
// TYPES
// ============================================================================

export interface ContactClassifyResult {
  /** Matched purpose from entries-contact.ts (e.g., 'id', 'cv-resume') */
  purpose: string;
  /** AI confidence 0-1 */
  confidence: number;
  /** AI reasoning (1 sentence, Greek) */
  reasoning: string;
}

interface PurposeEntry {
  purpose: string;
  label: string;
}

// ============================================================================
// PURPOSE CATALOG (built once from SSoT)
// ============================================================================

let _purposeCatalog: PurposeEntry[] | null = null;
let _purposeSet: Set<string> | null = null;

function getPurposeCatalog(): PurposeEntry[] {
  if (_purposeCatalog) return _purposeCatalog;

  _purposeCatalog = CONTACT_ENTRY_POINTS
    .filter((e) => e.category === 'documents' || e.category === 'contracts')
    .map((e) => ({ purpose: e.purpose, label: e.label.el }));

  return _purposeCatalog;
}

function getPurposeSet(): Set<string> {
  if (_purposeSet) return _purposeSet;
  _purposeSet = new Set(getPurposeCatalog().map((e) => e.purpose));
  return _purposeSet;
}

/** Validate that a purpose string exists in entries-contact.ts */
export function isValidContactPurpose(purpose: string): boolean {
  return getPurposeSet().has(purpose);
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

const SYSTEM_PROMPT =
  'Είσαι enterprise document classifier για ελληνική κατασκευαστική / μεσιτική εταιρεία. ' +
  'Κοίτα το αρχείο και επέλεξε τη σωστή κατηγορία εγγράφου από τη λίστα. ' +
  'Αν δεν αναγνωρίζεις τον τύπο, χρησιμοποίησε "generic". ' +
  'Απάντησε ΜΟΝΟ με JSON σύμφωνα με το schema.';

function buildPurposeList(): string {
  return getPurposeCatalog()
    .map((e) => `${e.purpose}: ${e.label}`)
    .join('\n');
}

function buildClassificationSchema(): Record<string, unknown> {
  const purposes = getPurposeCatalog().map((e) => e.purpose);

  return {
    name: 'contact_document_classify',
    description: 'Classify a document into a contact-specific category.',
    strict: true,
    schema: {
      type: 'object',
      required: ['contactPurpose', 'confidence', 'reasoning'],
      additionalProperties: false,
      properties: {
        contactPurpose: {
          type: 'string',
          enum: purposes,
          description: 'The matched purpose from the catalog.',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score 0-1.',
        },
        reasoning: {
          type: 'string',
          description: 'Brief reasoning in Greek (1 sentence).',
        },
      },
    },
  };
}

// ============================================================================
// OPENAI VISION CALL
// ============================================================================

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const CONFIDENCE_THRESHOLD = 0.5;

const FALLBACK_RESULT: ContactClassifyResult = {
  purpose: 'generic',
  confidence: 0,
  reasoning: 'Αυτόματη ταξινόμηση δεν ήταν δυνατή.',
};

export async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) return null;

    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export function isImageMime(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export type VisionContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

/**
 * Classify a contact document using OpenAI vision.
 *
 * Downloads the file, sends to OpenAI gpt-4o-mini vision with the full
 * purpose catalog, and returns the matched purpose + confidence.
 *
 * Falls back to 'generic' on: API error, large file, low confidence.
 */
export async function classifyContactDocument(params: {
  downloadUrl: string;
  filename: string;
  contentType: string;
}): Promise<ContactClassifyResult> {
  const { downloadUrl, filename, contentType } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return FALLBACK_RESULT;

  // Download file
  const fileBuffer = await downloadFile(downloadUrl);
  if (!fileBuffer) return FALLBACK_RESULT;

  // Build content array
  const purposeList = buildPurposeList();
  const userPrompt = [
    'Ταξινόμησε αυτό το έγγραφο. Επίλεξε τη σωστή κατηγορία από τη λίστα:',
    '',
    purposeList,
    '',
    `Filename: ${filename}`,
    `MIME: ${contentType}`,
  ].join('\n');

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

  // Call OpenAI Responses API
  const schema = buildClassificationSchema();
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL;
  const timeoutMs = AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            ...schema,
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return FALLBACK_RESULT;

    const payload: unknown = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) return FALLBACK_RESULT;

    const parsed: unknown = JSON.parse(outputText);
    if (!isRecord(parsed)) return FALLBACK_RESULT;

    const purpose = String(parsed.contactPurpose ?? 'generic');
    const confidence = Number(parsed.confidence ?? 0);
    const reasoning = String(parsed.reasoning ?? '');

    // Validate purpose exists in catalog
    if (!isValidContactPurpose(purpose)) {
      return { ...FALLBACK_RESULT, reasoning: `Unknown purpose: ${purpose}` };
    }

    // Apply confidence threshold
    if (confidence < CONFIDENCE_THRESHOLD) {
      return { purpose: 'generic', confidence, reasoning };
    }

    return { purpose, confidence, reasoning };
  } catch {
    return FALLBACK_RESULT;
  }
}

// ============================================================================
// RESPONSE PARSING (mirrors OpenAIAnalysisProvider pattern)
// ============================================================================

export function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const outputText = (payload as Record<string, unknown>).output_text;
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim();
  }

  const output = (payload as Record<string, unknown>).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if ((item as Record<string, unknown>).type !== 'message') continue;
    const itemContent = (item as Record<string, unknown>).content;
    if (!Array.isArray(itemContent)) continue;

    for (const entry of itemContent) {
      if (!isRecord(entry)) continue;
      if ((entry as Record<string, unknown>).type !== 'output_text') continue;
      const text = (entry as Record<string, unknown>).text;
      if (typeof text === 'string' && text.trim()) {
        return text.trim();
      }
    }
  }

  return null;
}
