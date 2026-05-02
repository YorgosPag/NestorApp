/**
 * =============================================================================
 * Floorplan Processing API Route
 * =============================================================================
 *
 * Server-side DXF/PDF processing that bypasses CORS restrictions.
 * Uses Firebase Admin SDK for direct Storage access.
 *
 * @module api/floorplans/process
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  ProcessFloorplanRequest,
  ProcessFloorplanResponse,
  ProcessFloorplanInProgressResponse,
  FileRecordData,
  FirebaseAdminError,
} from './floorplan-process.types';
import { getFileType, downloadFile, processDxf, processPdf } from './floorplan-process.service';
import { nowISO } from '@/lib/date-local';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('FloorplanProcessRoute');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/floorplans/process
 * @rateLimit HEAVY (10 req/min)
 */
export const POST = withHeavyRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<ProcessFloorplanResponse>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        return handleProcessFloorplan(req, ctx);
      },
      { permissions: 'floorplans:floorplans:process' }
    );
    return handler(request);
  }
);

async function handleProcessFloorplan(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ProcessFloorplanResponse>> {
  const startTime = Date.now();
  let lockedFileId: string | null = null;

  logger.info('Request', { email: ctx.email, companyId: ctx.companyId });

  try {
    // 1. PARSE & VALIDATE
    const body = (await request.json()) as ProcessFloorplanRequest;
    const { fileId, forceReprocess = false } = body;

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'fileId is required', errorCode: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // 2. FIREBASE ADMIN
    const adminDb = getAdminFirestore();
    const adminStorage = getAdminStorage();
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      return NextResponse.json(
        { success: false, error: 'Storage bucket not configured', errorCode: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const bucket = adminStorage.bucket(storageBucket);

    // 3. FETCH FILE RECORD
    const fileDoc = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();

    if (!fileDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'File not found', errorCode: 'FILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const fileData = { id: fileDoc.id, ...fileDoc.data() } as FileRecordData;

    // 4. TENANT ISOLATION
    if (fileData.companyId && fileData.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied', errorCode: 'TENANT_MISMATCH' },
        { status: 403 }
      );
    }

    // 5. CHECK ALREADY PROCESSED (fast path — no lock needed)
    if (fileData.processedData && !forceReprocess) {
      return NextResponse.json({
        success: true,
        fileId,
        fileType: fileData.processedData.fileType,
        processedAt: new Date(fileData.processedData.processedAt).toISOString(),
        stats: fileData.processedData.scene
          ? {
              entityCount: fileData.processedData.scene.entities.length,
              layerCount: Object.keys(fileData.processedData.scene.layers).length,
              parseTimeMs: 0,
            }
          : undefined,
      });
    }

    // 5b. ATOMIC LOCK — cross-instance safe via Firestore transaction
    // Replaces the in-memory Set which was per-lambda and unreliable on Vercel.
    const fileRef = adminDb.collection(COLLECTIONS.FILES).doc(fileId);
    let isAlreadyProcessing = false;

    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(fileRef);
      const current = snap.data();
      if (current?.processingStatus === 'processing') {
        isAlreadyProcessing = true;
        return;
      }
      txn.update(fileRef, { processingStatus: 'processing' });
    });

    if (isAlreadyProcessing) {
      logger.info('File already being processed (Firestore lock)', { fileId });
      return NextResponse.json<ProcessFloorplanInProgressResponse>({
        success: true,
        status: 'in_progress',
        fileId,
      });
    }

    lockedFileId = fileId;

    // 6. DETERMINE FILE TYPE
    const fileType = getFileType(fileData.ext || '');
    if (!fileType) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${fileData.ext}`, errorCode: 'UNSUPPORTED_TYPE' },
        { status: 400 }
      );
    }

    // 7. DOWNLOAD + PROCESS
    const rawBuffer = await downloadFile(bucket, fileData.storagePath);

    const result = fileType === 'dxf'
      ? await processDxf(rawBuffer, fileData, bucket)
      : processPdf(rawBuffer);

    // 8. SAVE METADATA TO FIRESTORE + release lock
    await adminDb.collection(COLLECTIONS.FILES).doc(fileId).update({
      processedData: result.processedData,
      processingStatus: 'done',
      updatedAt: nowISO(),
    });

    // 9. AUDIT LOG
    const duration = Date.now() - startTime;
    await logAuditEvent(ctx, 'data_accessed', fileId, 'api', {
      metadata: {
        path: '/api/floorplans/process',
        reason: `Floorplan processed: ${fileData.displayName} (${result.processedData.fileType}, ${duration}ms)`,
      },
    });

    return NextResponse.json({
      success: true,
      fileId,
      fileType: result.processedData.fileType,
      processedAt: new Date(result.processedData.processedAt).toISOString(),
      stats: result.stats,
    });
  } catch (error) {
    if (lockedFileId) {
      const adminDb = getAdminFirestore();
      safeFireAndForget(
        adminDb.collection(COLLECTIONS.FILES).doc(lockedFileId).update({ processingStatus: 'error' }),
        'FloorplanProcessRoute.releaseLock',
        { fileId: lockedFileId }
      );
    }

    const firebaseError = error as FirebaseAdminError | null;
    const errorMessage = getErrorMessage(error);

    logger.error('Error', {
      message: errorMessage,
      code: firebaseError?.code,
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Floorplan processing failed',
        errorCode: firebaseError?.code || 'PROCESSING_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
