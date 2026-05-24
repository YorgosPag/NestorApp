/**
 * =============================================================================
 * ISO 19650 METADATA ENRICHER — AI Vision Auto-Fill (ADR-373 Phase 1)
 * =============================================================================
 *
 * Fire-and-forget enricher invoked AFTER a FileRecord is finalized
 * (post-finalize-hooks). Calls OpenAI vision with a strict-mode JSON schema
 * to extract the 5 ISO 19650 fields:
 *   disciplineCode | documentSeries | revisionCode | cdeState | buildingCode
 *
 * Behavior (OQ6 + OQ7 — approved 2026-05-24):
 *  - **Always** attempts AI call (no skip on purpose-derivation certainty).
 *  - Hard budget cap $0.01/file → skip + derive only.
 *  - **Never throws** — returns enrichment payload or derivation fallback.
 *  - Concurrency control deferred Phase 2 (Firestore-backed token bucket).
 *
 * Pattern mirrors `contact-document-classifier.ts` (same Responses API +
 * vision pipeline). Vision helpers (`downloadFile`, `extractOutputText`,
 * `isImageMime`, `VisionContent`) imported directly from the contact
 * classifier — extraction to a `vision-helpers.ts` SSoT is queued as a
 * Phase 2 small task (Boy Scout, N.0.2).
 *
 * @module services/ai-pipeline/tools/handlers/iso19650-enricher
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 * @see ADR-191 — Enterprise Document Management (parent)
 */

import 'server-only';

import { AI_ANALYSIS_DEFAULTS, AI_COST_CONFIG } from '@/config/ai-analysis-config';
import {
  CDE_STATE_VALUES,
  DISCIPLINE_CODE_VALUES,
  DOCUMENT_SERIES_VALUES,
  ISO19650_BUDGET_CAP_USD,
  type CdeState,
  type DisciplineCode,
  type DocumentSeries,
} from '@/config/iso19650-constants';
import {
  deriveFromPurpose,
  isCdeState,
  isDisciplineCode,
  isDocumentSeries,
  validateBuildingCode,
  validateRevisionCode,
} from '@/services/iso19650/validators';
import { isRecord } from '@/lib/type-guards';
import {
  downloadFile,
  extractOutputText,
  isImageMime,
  type VisionContent,
} from '@/services/ai-pipeline/tools/handlers/contact-document-classifier';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type Iso19650FilledBy = 'ai' | 'derived' | 'user' | 'skipped';

export interface Iso19650SourceAudit {
  filledBy: Iso19650FilledBy;
  aiProvider?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  aiCostUsd?: number;
  filledAt: string;
}

export interface Iso19650EnrichmentResult {
  disciplineCode?: DisciplineCode;
  documentSeries?: DocumentSeries;
  revisionCode?: string;
  cdeState?: CdeState;
  buildingCode?: string;
  source: Iso19650SourceAudit;
}

export interface Iso19650EnrichmentInput {
  downloadUrl: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  purpose?: string;
}

// ============================================================================
// CONFIG CONSTANTS (handler-local)
// ============================================================================

/** Hard size cap — files larger skip AI entirely (per contact-classifier convention, raised to 8MB για architectural PDFs). */
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

/** Heuristic: bytes-per-token for vision input (gpt-4o-mini, conservative proxy). */
const VISION_BYTES_PER_TOKEN = 800;

/** Fixed prompt overhead (system + user, no file). */
const PROMPT_TOKENS_OVERHEAD = 1500;

/** Fixed schema response size. */
const SCHEMA_OUTPUT_TOKENS = 200;

/** Minimum AI confidence accepted as authoritative (else fallback). */
const CONFIDENCE_THRESHOLD = 0.5;

// ============================================================================
// COST ESTIMATION (OQ6 — hard cap $0.01/file via ISO19650_BUDGET_CAP_USD)
// ============================================================================

/**
 * Estimate USD cost of an enrichment AI call.
 * Uses gpt-4o-mini pricing from AI_COST_CONFIG.PRICING.
 * Conservative — overestimates rather than underestimates for safety.
 */
export function estimateEnrichmentCostUsd(sizeBytes: number): number {
  const pricing = AI_COST_CONFIG.PRICING['gpt-4o-mini'];
  const inputTokens = Math.ceil(sizeBytes / VISION_BYTES_PER_TOKEN) + PROMPT_TOKENS_OVERHEAD;
  const outputTokens = SCHEMA_OUTPUT_TOKENS;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1MTokens;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1MTokens;
  return inputCost + outputCost;
}

// ============================================================================
// PROMPT + SCHEMA BUILDERS
// ============================================================================

const SYSTEM_PROMPT =
  'Είσαι enterprise ISO 19650-2 metadata extractor για ελληνική κατασκευαστική / μεσιτική εταιρεία. ' +
  'Διάβασε το αρχείο και εξάγαγε ΜΟΝΟ τα πεδία που μπορείς να επιβεβαιώσεις από το περιεχόμενο. ' +
  'ΑΥΣΤΗΡΟ: αν δεν είσαι σίγουρος για ένα πεδίο, βγάλε `null`. ΜΗΝ μαντεύεις. ' +
  'disciplineCode: ένα γράμμα (A=Αρχιτεκτονικά, S=Στατικά, M=Μηχανολογικά, E=Ηλεκτρολογικά, ' +
  'K=Ενεργειακά, H=ΣΑΥ-ΦΑΥ, N=Διοικητικά, X=Φορολογικά, T=Τοπογραφικά, L=Ανελκυστήρες, ' +
  'P=Άδειες, F=Πυρασφάλεια, D=Κατεδαφίσεις). ' +
  'documentSeries: αριθμός σειράς (100=Κατόψεις, 200=Όψεις, 300=Τομές, 400=Λεπτομέρειες, ' +
  '500=Πίνακες κουφωμάτων, 600=Διαμορφώσεις, 700=Στατικά σχέδια, 800=Η/Μ schematics, 900=As-Built). ' +
  'revisionCode: τύπος (P|T|C|R|AB) + 2 ψηφία π.χ. P01, R02, C03. ' +
  'cdeState: WIP (σε εξέλιξη), SHARED (διαβούλευση), PUBLISHED (εγκεκριμένο), SUPERSEDED (αντικατασταθηκε). ' +
  'buildingCode: κωδικός κτιρίου π.χ. Κ1, Κ1-Α, A-1. ' +
  'Απάντησε ΜΟΝΟ με JSON σύμφωνα με το schema.';

function buildUserPrompt(params: { filename: string; contentType: string; purpose?: string }): string {
  const lines = [
    'Εξάγαγε τα ISO 19650 metadata fields από αυτό το αρχείο.',
    `Filename: ${params.filename}`,
    `MIME: ${params.contentType}`,
  ];
  if (params.purpose) {
    lines.push(`Purpose (από upload entry point): ${params.purpose}`);
  }
  return lines.join('\n');
}

/**
 * OpenAI strict-mode JSON schema — all 5 ISO fields nullable + confidence + reasoning.
 * `enum: [...values, null]` pattern allows null while keeping enum constraint.
 * Evaluated once at module init (pure data, no logic).
 */
const ENRICHMENT_SCHEMA: Record<string, unknown> = {
  name: 'iso19650_enrichment_result',
  description: 'Extract ISO 19650 metadata fields from a Greek construction document.',
  strict: true,
  schema: {
    type: 'object',
    required: [
      'disciplineCode',
      'documentSeries',
      'revisionCode',
      'cdeState',
      'buildingCode',
      'confidence',
      'reasoning',
    ],
    additionalProperties: false,
    properties: {
      disciplineCode: {
        type: ['string', 'null'],
        enum: [...DISCIPLINE_CODE_VALUES, null],
        description: 'Discipline letter (A/S/M/E/K/H/N/X/T/L/P/F/D) or null if uncertain.',
      },
      documentSeries: {
        type: ['integer', 'null'],
        enum: [...DOCUMENT_SERIES_VALUES, null],
        description: 'Document series 100..900 or null if uncertain.',
      },
      revisionCode: {
        type: ['string', 'null'],
        description: 'Revision tag (P|T|C|R|AB + 2 digits) or null if not present.',
      },
      cdeState: {
        type: ['string', 'null'],
        enum: [...CDE_STATE_VALUES, null],
        description: 'CDE workflow state (WIP/SHARED/PUBLISHED/SUPERSEDED) or null.',
      },
      buildingCode: {
        type: ['string', 'null'],
        description: 'Building short code (Κ1, Κ1-Α, A-1) or null if not present.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score 0-1 reflecting certainty across all fields.',
      },
      reasoning: {
        type: 'string',
        description: 'Brief Greek reasoning (1 sentence).',
      },
    },
  },
};

// ============================================================================
// FALLBACK BUILDER — derivation + skipped/error variants
// ============================================================================

function buildFallbackFromPurpose(
  purpose: string | undefined,
  filledBy: Iso19650FilledBy,
  reasoning: string,
  estimatedCostUsd?: number,
): Iso19650EnrichmentResult {
  const derivation = deriveFromPurpose(purpose);
  const result: Iso19650EnrichmentResult = {
    source: {
      filledBy,
      aiReasoning: reasoning,
      filledAt: new Date().toISOString(),
    },
  };
  if (derivation.disciplineCode) {
    result.disciplineCode = derivation.disciplineCode;
  }
  if (typeof estimatedCostUsd === 'number') {
    result.source.aiCostUsd = estimatedCostUsd;
  }
  return result;
}

// ============================================================================
// VISION CONTENT ASSEMBLY
// ============================================================================

function buildVisionContent(params: {
  fileBuffer: Buffer;
  filename: string;
  contentType: string;
  userPrompt: string;
}): VisionContent[] {
  const content: VisionContent[] = [{ type: 'input_text', text: params.userPrompt }];
  const base64 = params.fileBuffer.toString('base64');
  if (isImageMime(params.contentType)) {
    content.push({
      type: 'input_image',
      image_url: `data:${params.contentType};base64,${base64}`,
    });
  } else {
    content.push({
      type: 'input_file',
      filename: params.filename,
      file_data: `data:${params.contentType};base64,${base64}`,
    });
  }
  return content;
}

// ============================================================================
// OPENAI CALL — wrapped in try/catch, returns null on any failure
// ============================================================================

async function callOpenAiVisionEnricher(params: {
  apiKey: string;
  content: VisionContent[];
}): Promise<unknown | null> {
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL;
  const timeoutMs = AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
          { role: 'user', content: params.content },
        ],
        text: { format: { type: 'json_schema', ...ENRICHMENT_SCHEMA } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// RESULT PARSING + VALIDATION
// ============================================================================

function decodeAiResponseRecord(
  payload: unknown,
  purpose: string | undefined,
  estimatedCostUsd: number,
): Record<string, unknown> | Iso19650EnrichmentResult {
  const outputText = extractOutputText(payload);
  if (!outputText) {
    return buildFallbackFromPurpose(purpose, 'derived', 'AI response empty.', estimatedCostUsd);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return buildFallbackFromPurpose(purpose, 'derived', 'AI response invalid JSON.', estimatedCostUsd);
  }
  if (!isRecord(parsed)) {
    return buildFallbackFromPurpose(purpose, 'derived', 'AI response not object.', estimatedCostUsd);
  }
  return parsed;
}

function buildAiResult(
  parsed: Record<string, unknown>,
  confidence: number,
  reasoning: string,
  estimatedCostUsd: number,
): Iso19650EnrichmentResult {
  const result: Iso19650EnrichmentResult = {
    source: {
      filledBy: 'ai',
      aiProvider: `openai-${AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL}`,
      aiConfidence: confidence,
      aiReasoning: reasoning,
      aiCostUsd: estimatedCostUsd,
      filledAt: new Date().toISOString(),
    },
  };
  if (isDisciplineCode(parsed.disciplineCode)) result.disciplineCode = parsed.disciplineCode;
  if (isDocumentSeries(parsed.documentSeries)) result.documentSeries = parsed.documentSeries;
  if (validateRevisionCode(parsed.revisionCode)) result.revisionCode = parsed.revisionCode;
  if (isCdeState(parsed.cdeState)) result.cdeState = parsed.cdeState;
  if (validateBuildingCode(parsed.buildingCode)) result.buildingCode = parsed.buildingCode;
  return result;
}

function parseEnrichmentResponse(
  payload: unknown,
  purpose: string | undefined,
  estimatedCostUsd: number,
): Iso19650EnrichmentResult {
  const decoded = decodeAiResponseRecord(payload, purpose, estimatedCostUsd);
  if (!isRecord(decoded) || 'source' in decoded) {
    // decodeAiResponseRecord returned an already-built fallback EnrichmentResult.
    return decoded as Iso19650EnrichmentResult;
  }
  const confidence = Number(decoded.confidence ?? 0);
  const reasoning = String(decoded.reasoning ?? 'AI enrichment.');
  if (confidence < CONFIDENCE_THRESHOLD) {
    return buildFallbackFromPurpose(
      purpose,
      'derived',
      `AI confidence ${confidence.toFixed(2)} below threshold.`,
      estimatedCostUsd,
    );
  }
  return buildAiResult(decoded, confidence, reasoning, estimatedCostUsd);
}

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

/**
 * Pre-flight check — returns a fallback if AI should be skipped, else null.
 * Reasons: missing API key, file too large, estimated cost over budget cap.
 */
function checkPreflightGate(
  params: Iso19650EnrichmentInput,
  apiKey: string | undefined,
  estimatedCostUsd: number,
): Iso19650EnrichmentResult | null {
  if (!apiKey) {
    return buildFallbackFromPurpose(params.purpose, 'derived', 'AI provider unavailable.');
  }
  if (params.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return buildFallbackFromPurpose(
      params.purpose,
      'skipped',
      `File ${params.sizeBytes} bytes exceeds ${MAX_FILE_SIZE_BYTES} byte limit.`,
    );
  }
  if (estimatedCostUsd > ISO19650_BUDGET_CAP_USD) {
    return buildFallbackFromPurpose(
      params.purpose,
      'skipped',
      `Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds $${ISO19650_BUDGET_CAP_USD} cap.`,
      estimatedCostUsd,
    );
  }
  return null;
}

/**
 * Enrich a finalized FileRecord with ISO 19650 metadata via AI vision.
 *
 * Always returns a result — never throws. Caller (post-finalize-hooks) treats
 * this as fire-and-forget and applies the payload via `applyIso19650Enrichment`.
 *
 * Decision tree:
 *  1. Missing API key                → 'derived' fallback
 *  2. File too large (>8MB)          → 'skipped' + derivation
 *  3. Estimated cost > $0.01 cap     → 'skipped' + derivation
 *  4. Download fails                 → 'derived' fallback
 *  5. AI call fails / parse fails    → 'derived' fallback
 *  6. AI confidence < threshold      → 'derived' fallback
 *  7. AI success                     → 'ai' with all validated fields
 */
export async function enrichFileWithIso19650Metadata(
  params: Iso19650EnrichmentInput,
): Promise<Iso19650EnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const estimatedCostUsd = estimateEnrichmentCostUsd(params.sizeBytes);

  const gateResult = checkPreflightGate(params, apiKey, estimatedCostUsd);
  if (gateResult) return gateResult;

  const fileBuffer = await downloadFile(params.downloadUrl);
  if (!fileBuffer) {
    return buildFallbackFromPurpose(params.purpose, 'derived', 'File download failed.', estimatedCostUsd);
  }

  const content = buildVisionContent({
    fileBuffer,
    filename: params.filename,
    contentType: params.contentType,
    userPrompt: buildUserPrompt({
      filename: params.filename,
      contentType: params.contentType,
      purpose: params.purpose,
    }),
  });

  const payload = await callOpenAiVisionEnricher({ apiKey: apiKey!, content });
  if (!payload) {
    return buildFallbackFromPurpose(params.purpose, 'derived', 'AI call failed.', estimatedCostUsd);
  }

  return parseEnrichmentResponse(payload, params.purpose, estimatedCostUsd);
}
