/**
 * =============================================================================
 * File Classification API — AI Auto-Classification
 * =============================================================================
 *
 * POST /api/files/classify
 * Body: { fileId: string }
 *
 * Fetches file from Firebase Storage, sends to OpenAI for classification,
 * and updates the FileRecord with the AI analysis result.
 *
 * @module api/files/classify
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 2.2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import { isDocumentClassifyAnalysis } from '@/schemas/ai-analysis';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FileClassifyRoute');

export const maxDuration = 60;

// ============================================================================
// SUPPORTED MIME TYPES FOR AI CLASSIFICATION
// ============================================================================

/** MIME types that OpenAI vision can process directly */
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** MIME types we can send as text-based context */
const TEXT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
]);

/** All classifiable MIME types */
function isClassifiable(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType) || TEXT_MIME_TYPES.has(mimeType);
}

// ============================================================================
// REQUEST / RESPONSE TYPES
// ============================================================================

interface ClassifyRequest {
  fileId: string;
}

interface ClassifyResponse {
  success: boolean;
  fileId: string;
  documentType?: string;
  confidence?: number;
  signals?: string[];
  error?: string;
}

// ============================================================================
// FIREBASE STORAGE URL VALIDATION
// ============================================================================

function isFirebaseStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'firebasestorage.googleapis.com' ||
      parsed.hostname === 'storage.googleapis.com' ||
      parsed.hostname.endsWith('.storage.googleapis.com')
    );
  } catch {
    return false;
  }
}

// ============================================================================
// HANDLER
// ============================================================================

async function handlePost(
  request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<ClassifyResponse>> {
  try {
    const body = (await request.json()) as ClassifyRequest;

    if (!body.fileId || typeof body.fileId !== 'string') {
      return NextResponse.json(
        { success: false, fileId: '', error: 'fileId is required' },
        { status: 400 },
      );
    }

    const { fileId } = body;

    // 1. Read FileRecord from Firestore
    const fileDoc = await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).get();
    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, fileId, error: 'File not found' },
        { status: 404 },
      );
    }

    const fileData = fileDoc.data();
    if (!fileData) {
      return NextResponse.json(
        { success: false, fileId, error: 'File data is empty' },
        { status: 404 },
      );
    }

    const downloadUrl = fileData.downloadUrl as string | undefined;
    const contentType = fileData.contentType as string | undefined;
    const originalFilename = fileData.originalFilename as string | undefined;
    const sizeBytes = fileData.sizeBytes as number | undefined;

    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, fileId, error: 'File has no download URL (not yet finalized)' },
        { status: 400 },
      );
    }

    if (!contentType || !isClassifiable(contentType)) {
      return NextResponse.json(
        { success: false, fileId, error: `Content type not classifiable: ${contentType ?? 'unknown'}` },
        { status: 400 },
      );
    }

    // 2. Fetch file content from Firebase Storage
    if (!isFirebaseStorageUrl(downloadUrl)) {
      return NextResponse.json(
        { success: false, fileId, error: 'Invalid storage URL' },
        { status: 400 },
      );
    }

    logger.info(`Classifying file ${fileId} (${contentType})`);

    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { success: false, fileId, error: `Failed to fetch file: HTTP ${fileResponse.status}` },
        { status: 502 },
      );
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    // 3. Call AI provider
    const provider = createAIAnalysisProvider();
    const result = await provider.analyze({
      kind: 'document_classify',
      content: fileBuffer,
      filename: originalFilename ?? 'document',
      mimeType: contentType,
      sizeBytes: sizeBytes ?? fileBuffer.length,
    });

    if (!isDocumentClassifyAnalysis(result)) {
      logger.warn(`AI returned unexpected result kind: ${result.kind}`);
      return NextResponse.json(
        { success: false, fileId, error: 'AI returned unexpected result type' },
        { status: 500 },
      );
    }

    // 4. Update FileRecord in Firestore
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
        analysisTimestamp: result.analysisTimestamp ?? new Date().toISOString(),
        description: aiDescription,
      },
      'ingestion.state': 'classified',
      updatedAt: new Date().toISOString(),
    };

    // 🏢 ADR-191: Write AI description to FileRecord.description (only if empty)
    const currentDescription = fileData.description as string | undefined;
    if (aiDescription && !currentDescription) {
      updateData.description = aiDescription;
    }

    await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).update(updateData);

    // Audit: record AI classification (fire-and-forget, never blocks main operation)
    try {
      const { generateAuditId } = await import('@/services/enterprise-id.service');
      await getAdminFirestore().collection(COLLECTIONS.FILE_AUDIT_LOG).doc(generateAuditId()).set({
        fileId,
        action: 'ai_classify',
        performedBy: _ctx.uid,
        timestamp: new Date().toISOString(),
        metadata: {
          documentType: result.documentType,
          confidence: result.confidence,
          aiModel: result.aiModel ?? null,
        },
      });
    } catch (auditErr) {
      logger.warn('Audit log failed (non-blocking)', { error: auditErr });
    }

    logger.info(`Classified file ${fileId}: ${result.documentType} (${result.confidence})`);

    return NextResponse.json({
      success: true,
      fileId,
      documentType: result.documentType,
      confidence: result.confidence,
      signals: result.signals,
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Classification failed');
    logger.error(`Classification error: ${message}`);
    return NextResponse.json(
      { success: false, fileId: '', error: message },
      { status: 500 },
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

const authedHandler = withAuth(handlePost);
export const POST = withHeavyRateLimit(authedHandler);
