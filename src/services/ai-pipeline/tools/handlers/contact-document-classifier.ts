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
import {
  downloadFile,
  extractOutputText,
  buildBufferVisionContent,
} from '@/services/ai/openai-responses';
import { requestVisionJson } from '../../shared/vision-json-request';

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
  /**
   * AI-suggested Greek display label for the document.
   * Critical for 'generic' purpose: becomes the FileRecord.displayName
   * (e.g., "Απόδειξη Παροχής Υπηρεσιών", "Βεβαίωση Κατοικίας").
   */
  suggestedLabel: string;
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
  'ΚΡΙΣΙΜΟ: Διάλεξε κατηγορία ΜΟΝΟ αν ταιριάζει ακριβώς. ' +
  'Αν το έγγραφο δεν αντιστοιχεί σε καμία συγκεκριμένη κατηγορία ' +
  '(π.χ. απόδειξη παροχής υπηρεσιών, τιμολόγιο τρίτου, βεβαίωση μη οφειλών, κλπ), ' +
  'χρησιμοποίησε "generic". ΜΗΝ βάζεις ένα έγγραφο σε λάθος κατηγορία μόνο ' +
  'επειδή περιέχει ΑΦΜ ή ΦΠΑ — αυτά υπάρχουν σε πολλά έγγραφα. ' +
  'Πάντα δίνε ένα suggestedLabel: σύντομη ελληνική περιγραφή του τύπου εγγράφου. ' +
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
      required: ['contactPurpose', 'confidence', 'reasoning', 'suggestedLabel'],
      additionalProperties: false,
      properties: {
        contactPurpose: {
          type: 'string',
          enum: purposes,
          description: 'The matched purpose from the catalog. Use "generic" if no specific category matches.',
        },
        confidence: {
          type: 'number',
          description: 'Confidence score 0-1.',
        },
        reasoning: {
          type: 'string',
          description: 'Brief reasoning in Greek (1 sentence).',
        },
        suggestedLabel: {
          type: 'string',
          description: 'Short Greek document type label (e.g., "Απόδειξη Παροχής Υπηρεσιών", "Ταυτότητα", "Βιογραφικό"). Used as display name.',
        },
      },
    },
  };
}

// ============================================================================
// OPENAI VISION CALL
// ============================================================================

const CONFIDENCE_THRESHOLD = 0.5;

const FALLBACK_RESULT: ContactClassifyResult = {
  purpose: 'generic',
  confidence: 0,
  reasoning: 'Αυτόματη ταξινόμηση δεν ήταν δυνατή.',
  suggestedLabel: 'Άλλο Έγγραφο',
};

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

  const content = buildBufferVisionContent(userPrompt, fileBuffer, filename, contentType);

  // Call OpenAI Responses API
  const schema = buildClassificationSchema();

  try {
    const payload = await requestVisionJson({
      apiKey,
      timeoutMs: AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS,
      systemPrompt: SYSTEM_PROMPT,
      content,
      format: { type: 'json_schema', ...schema },
    });

    const outputText = extractOutputText(payload);
    if (!outputText) return FALLBACK_RESULT;

    const parsed: unknown = JSON.parse(outputText);
    if (!isRecord(parsed)) return FALLBACK_RESULT;

    const purpose = String(parsed.contactPurpose ?? 'generic');
    const confidence = Number(parsed.confidence ?? 0);
    const reasoning = String(parsed.reasoning ?? '');
    const suggestedLabel = String(parsed.suggestedLabel ?? 'Άλλο Έγγραφο').trim();

    // Validate purpose exists in catalog
    if (!isValidContactPurpose(purpose)) {
      return { ...FALLBACK_RESULT, suggestedLabel, reasoning: `Unknown purpose: ${purpose}` };
    }

    // Apply confidence threshold
    if (confidence < CONFIDENCE_THRESHOLD) {
      return { purpose: 'generic', confidence, reasoning, suggestedLabel };
    }

    return { purpose, confidence, reasoning, suggestedLabel };
  } catch {
    return FALLBACK_RESULT;
  }
}

