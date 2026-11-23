/**
 * Background classification logic — runs inside Next.js 15 after().
 * Extracted from route.ts for SRP (API routes max 300 lines).
 *
 * @module api/files/classify/classify-background
 */

import { createModuleLogger } from '@/lib/telemetry';
import { COLLECTIONS } from '@/config/firestore-collections';
import { evidenceFieldKeysFor, evidenceRecheckFieldsFor } from '@/config/contact-document-evidence';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type {
  DocumentClassifyInput,
  DocumentEvidenceRequest,
  IAIAnalysisProvider,
} from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import { isDocumentClassifyAnalysis, type DocumentEvidenceField } from '@/schemas/ai-analysis';
import { corroborateEvidence, type EvidenceCorroboration } from '@/server/files/evidence-corroboration';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { extractTextFromDocx } from '@/lib/document-extractors/docx-extractor';
import { extractTextFromXlsx } from '@/lib/document-extractors/xlsx-extractor';
import { extractTextFromDxf } from '@/lib/document-extractors/dxf-extractor';
import {
  getExtractorKind,
  type ExtractorKind,
} from '@/config/file-types/classification-registry';

const DXF_MAX_BYTES = 50_000;

/**
 * Extractor dispatch table — one entry per `ExtractorKind`.
 * Adding a new extractor means:
 *   1. Add the `*-extractor.ts` module under `src/lib/document-extractors/`
 *   2. Add its `ExtractorKind` literal in classification-registry.ts
 *   3. Wire it here — the TypeScript switch makes the missing branch a compile error
 *
 * Guarded by CHECK 3.20 (extractor registry ratchet) and by the Jest test
 * `extractor-registry.test.ts` which asserts the dispatch covers the union.
 */
async function runExtractor(
  kind: ExtractorKind,
  buffer: Buffer,
  originalFilename: string | undefined,
): Promise<{ buffer: Buffer; mime: string }> {
  switch (kind) {
    case 'docx': {
      const text = await extractTextFromDocx(buffer);
      return {
        buffer: Buffer.from(text || `Filename: ${originalFilename ?? 'document'}`),
        mime: 'text/plain',
      };
    }
    case 'xlsx': {
      const text = await extractTextFromXlsx(buffer);
      return {
        buffer: Buffer.from(text || `Filename: ${originalFilename ?? 'document'}`),
        mime: 'text/plain',
      };
    }
    case 'dxf': {
      const sliced = buffer.slice(0, DXF_MAX_BYTES);
      const text = extractTextFromDxf(sliced);
      logger.info(
        `[after] DXF extracted text (first 400 chars): ${text.slice(0, 400) || '(empty — no TEXT/MTEXT entities found)'}`,
      );
      return { buffer: text ? Buffer.from(text) : sliced, mime: 'text/plain' };
    }
    case 'svg-truncate': {
      return { buffer: buffer.slice(0, DXF_MAX_BYTES), mime: 'text/plain' };
    }
  }
}

const logger = createModuleLogger('FileClassifyBackground');

export interface ClassifyInBackgroundInput {
  readonly fileId: string;
  readonly downloadUrl: string;
  readonly contentType: string;
  readonly originalFilename: string | undefined;
  readonly sizeBytes: number | undefined;
  readonly userId: string;
  readonly fileExt?: string;
  /** ADR-950: για ποιο έγγραφο ανέβηκε (`entries-contact.ts`). */
  readonly purpose: string | null;
  readonly entityType: string | null;
}

/**
 * ADR-950 §4.2 — ζητάμε πεδία **μόνο** για αρχεία επαφής με `purpose` που έχει χάρτη. Αλλιώς `undefined` ⇒ η κλήση
 * AI είναι ακριβώς η σημερινή.
 */
function evidenceRequestFor(input: ClassifyInBackgroundInput): DocumentEvidenceRequest | undefined {
  if (input.entityType !== ENTITY_TYPES.CONTACT || input.purpose === null) return undefined;
  const fields = evidenceFieldKeysFor(input.purpose);
  return fields.length > 0 ? { purpose: input.purpose, fields } : undefined;
}

/**
 * ADR-950 §8 — τα τεκμήρια διακομιστή μιας ανάγνωσης (consensus ψηφίων · χάρτης · τύπος γραμμής). Η δεύτερη ανάγνωση
 * είναι **νέα, ανεξάρτητη** κλήση του ίδιου provider στο ίδιο αρχείο, μόνο για τα ψηφιακά πεδία.
 */
function corroborate(
  provider: IAIAnalysisProvider,
  request: DocumentClassifyInput,
  evidence: DocumentEvidenceRequest,
  fields: readonly DocumentEvidenceField[],
): Promise<EvidenceCorroboration> {
  return corroborateEvidence({
    purpose: evidence.purpose,
    fields,
    recheckFields: evidenceRecheckFieldsFor(evidence.purpose),
    rereadDigits: async (recheck) => {
      const second = await provider.analyze({ ...request, evidence: { purpose: evidence.purpose, fields: recheck, pass: 'digit-recheck' } });
      return isDocumentClassifyAnalysis(second) ? second.fields ?? null : null;
    },
  });
}

export async function classifyInBackground(input: ClassifyInBackgroundInput): Promise<void> {
  const { fileId, downloadUrl, contentType, originalFilename, sizeBytes, userId, fileExt } = input;
  const evidence = evidenceRequestFor(input);
  const db = getAdminFirestore();
  const fileRef = db.collection(COLLECTIONS.FILES).doc(fileId);

  try {
    logger.info(`[after] Classifying file ${fileId} (${contentType})`);

    // 1. Download file from Firebase Storage
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: HTTP ${fileResponse.status}`);
    }
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    // 2. Extract body text if the SSoT registry declares an extractor for this
    // family. OpenAI does not accept DOCX/XLSX/DXF as input_file, so they must
    // be converted to plain text before the AI call.
    let analyzeBuffer: Buffer = fileBuffer;
    let analyzeMimeType: string = contentType;
    const extractorKind = getExtractorKind(contentType, originalFilename, fileExt);
    if (extractorKind) {
      const { buffer, mime } = await runExtractor(extractorKind, fileBuffer, originalFilename);
      analyzeBuffer = buffer;
      analyzeMimeType = mime;
    }

    // 3. Call AI provider
    const provider = createAIAnalysisProvider();
    const request: DocumentClassifyInput = {
      kind: 'document_classify',
      content: analyzeBuffer,
      filename: originalFilename ?? (fileExt ? `drawing.${fileExt}` : 'document'),
      mimeType: analyzeMimeType,
      sizeBytes: sizeBytes ?? fileBuffer.length,
    };
    const result = await provider.analyze({ ...request, evidence });

    if (!isDocumentClassifyAnalysis(result)) {
      throw new Error(`AI returned unexpected result kind: ${result.kind}`);
    }

    const evidenceFields = evidence === undefined ? [] : (result.fields ?? []).filter((f) => evidence.fields.includes(f.field));
    const corroboration = evidence === undefined ? {} : await corroborate(provider, request, evidence, evidenceFields);

    // 3. Write classification results to Firestore
    const aiDescription = ('description' in result && typeof result.description === 'string')
      ? result.description
      : null;

    const updateData: Record<string, unknown> = {
      'ingestion.analysis': {
        kind: result.kind,
        documentType: result.documentType,
        confidence: result.confidence,
        signals: result.signals ?? [],
        aiModel: result.aiModel ?? null,
        analysisTimestamp: result.analysisTimestamp ?? nowISO(),
        description: aiDescription,
        // ADR-950: τα πεδία γράφονται ΜΟΝΟ στο αρχείο — ποτέ στην επαφή. Ανήκουν στο `purpose` για το οποίο ζητήθηκαν.
        ...(evidence !== undefined
          ? { fields: evidenceFields, evidencePurpose: evidence.purpose, ...corroboration }
          : {}),
      },
      'ingestion.state': 'classified',
      'ingestion.stateChangedAt': nowISO(),
      updatedAt: nowISO(),
    };

    const fileSnap = await fileRef.get();
    const currentDescription = fileSnap.data()?.description as string | undefined;
    if (aiDescription && !currentDescription) {
      updateData.description = aiDescription;
    }

    await fileRef.update(updateData);

    // 4. Audit log (fire-and-forget)
    try {
      const { generateAuditId } = await import('@/services/enterprise-id.service');
      await db.collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
        fileId,
        action: 'ai_classify',
        performedBy: userId,
        timestamp: nowISO(),
        metadata: {
          documentType: result.documentType,
          confidence: result.confidence,
          aiModel: result.aiModel ?? null,
        },
      });
    } catch (auditErr) {
      logger.warn('[after] Audit log failed (non-blocking)', { error: auditErr });
    }

    logger.info(`[after] Classified file ${fileId}: ${result.documentType} (${result.confidence})`);
  } catch (err) {
    const message = getErrorMessage(err, 'Classification failed');
    logger.error(`[after] Classification error for ${fileId}: ${message}`);

    try {
      await fileRef.update({
        'ingestion.state': 'classification_failed',
        'ingestion.stateChangedAt': nowISO(),
        updatedAt: nowISO(),
      });
    } catch (updateErr) {
      logger.error('[after] Failed to update error state', { error: updateErr });
    }
  }
}
