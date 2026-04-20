/**
 * =============================================================================
 * File Classification API — AI Auto-Classification (Background Processing)
 * =============================================================================
 *
 * POST /api/files/classify
 * Body: { fileId: string }
 *
 * Google Drive Pattern: validates + returns 200 immediately (~300ms),
 * then classifies in background via Next.js 15 after().
 * UI updates via Firestore onSnapshot when classification completes.
 *
 * @module api/files/classify
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 2.2)
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { classifyInBackground } from './classify-background';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('FileClassifyRoute');

export const maxDuration = 60;

// ============================================================================
// SUPPORTED MIME TYPES FOR AI CLASSIFICATION
// ============================================================================

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const TEXT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/xml',
  'application/xml',
  'text/html',
  'image/vnd.dxf',
  'application/dxf',
]);

const DXF_EXTENSIONS = new Set(['.dxf']);

function isClassifiable(mimeType: string, filename?: string): boolean {
  if (IMAGE_MIME_TYPES.has(mimeType) || TEXT_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return true;
  if (mimeType === 'application/octet-stream' && filename) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return DXF_EXTENSIONS.has(ext);
  }
  return false;
}

function getMediaDocumentType(mimeType: string): 'video' | 'audio' | null {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

// ============================================================================
// TYPES
// ============================================================================

interface ClassifyRequest {
  fileId: string;
}

interface ClassifyResponse {
  success: boolean;
  fileId: string;
  status?: 'classifying' | 'already_classified';
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
// HANDLER — Validate fast, return 200, classify in background
// ============================================================================

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
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

    // 2. Skip if already classified or classifying
    const currentState = fileData.ingestion?.state as string | undefined;
    if (currentState === 'classified') {
      return NextResponse.json({
        success: true,
        fileId,
        status: 'already_classified',
        documentType: fileData.ingestion?.analysis?.documentType,
        confidence: fileData.ingestion?.analysis?.confidence,
      });
    }
    if (currentState === 'classifying') {
      return NextResponse.json({
        success: true,
        fileId,
        status: 'classifying',
      });
    }

    // 3. Validate
    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, fileId, error: 'File has no download URL (not yet finalized)' },
        { status: 400 },
      );
    }

    if (!contentType || !isClassifiable(contentType, originalFilename)) {
      return NextResponse.json(
        { success: false, fileId, error: `Content type not classifiable: ${contentType ?? 'unknown'}` },
        { status: 400 },
      );
    }

    if (!isFirebaseStorageUrl(downloadUrl)) {
      return NextResponse.json(
        { success: false, fileId, error: 'Invalid storage URL' },
        { status: 400 },
      );
    }

    // 4. Deterministic classification for video/audio (no AI needed)
    const mediaDocumentType = getMediaDocumentType(contentType);
    if (mediaDocumentType) {
      const now = nowISO();
      await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).update({
        'ingestion.analysis': {
          kind: 'document_classify',
          documentType: mediaDocumentType,
          confidence: 1,
          signals: ['mime-type'],
          aiModel: null,
          analysisTimestamp: now,
          description: null,
        },
        'ingestion.state': 'classified',
        'ingestion.stateChangedAt': now,
        updatedAt: now,
      });
      return NextResponse.json({
        success: true,
        fileId,
        status: 'already_classified' as const,
        documentType: mediaDocumentType,
        confidence: 1,
        signals: ['mime-type'],
      });
    }

    // 5. Set state to 'classifying' immediately
    await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).update({
      'ingestion.state': 'classifying',
      'ingestion.stateChangedAt': nowISO(),
      updatedAt: nowISO(),
    });

    // 6. Return 200 immediately — classification happens in background
    const response = NextResponse.json({
      success: true,
      fileId,
      status: 'classifying' as const,
    });

    // 7. Background classification via after()
    after(() => classifyInBackground(
      fileId,
      downloadUrl,
      contentType,
      originalFilename,
      sizeBytes,
      ctx.uid,
    ));

    return response;
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
