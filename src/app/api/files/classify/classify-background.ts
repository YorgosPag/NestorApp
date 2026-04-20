/**
 * Background classification logic — runs inside Next.js 15 after().
 * Extracted from route.ts for SRP (API routes max 300 lines).
 *
 * @module api/files/classify/classify-background
 */

import { createModuleLogger } from '@/lib/telemetry';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import { isDocumentClassifyAnalysis } from '@/schemas/ai-analysis';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import { extractTextFromDocx } from '@/lib/document-extractors/docx-extractor';
import { extractTextFromXlsx } from '@/lib/document-extractors/xlsx-extractor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const logger = createModuleLogger('FileClassifyBackground');

export async function classifyInBackground(
  fileId: string,
  downloadUrl: string,
  contentType: string,
  originalFilename: string | undefined,
  sizeBytes: number | undefined,
  userId: string,
): Promise<void> {
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

    // 2. Extract text for DOCX/XLSX — OpenAI does not accept these as input_file
    let analyzeBuffer = fileBuffer;
    let analyzeMimeType = contentType;
    if (contentType === DOCX_MIME) {
      const extractedText = await extractTextFromDocx(fileBuffer);
      analyzeBuffer = Buffer.from(extractedText || `Filename: ${originalFilename ?? 'document'}`);
      analyzeMimeType = 'text/plain';
    } else if (contentType === XLSX_MIME) {
      const extractedText = await extractTextFromXlsx(fileBuffer);
      analyzeBuffer = Buffer.from(extractedText || `Filename: ${originalFilename ?? 'document'}`);
      analyzeMimeType = 'text/plain';
    }

    // 3. Call AI provider
    const provider = createAIAnalysisProvider();
    const result = await provider.analyze({
      kind: 'document_classify',
      content: analyzeBuffer,
      filename: originalFilename ?? 'document',
      mimeType: analyzeMimeType,
      sizeBytes: sizeBytes ?? fileBuffer.length,
    });

    if (!isDocumentClassifyAnalysis(result)) {
      throw new Error(`AI returned unexpected result kind: ${result.kind}`);
    }

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
