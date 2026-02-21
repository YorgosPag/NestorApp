/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Scene API Route
 * =============================================================================
 *
 * Secure endpoint for serving processed DXF scene data.
 * Uses Firebase Admin SDK to download from Storage with proper auth/tenant isolation.
 *
 * @module api/floorplans/scene
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 * @version 1.0.0
 *
 * Architecture:
 * - Client calls this API instead of fetching Storage URLs directly
 * - Server downloads JSON from Storage using Admin SDK (no CORS, no public access needed)
 * - Proper auth/tenant isolation via withAuth middleware
 * - Caching headers for performance
 *
 * Pattern: Autodesk Forge Viewer, Google Docs (authenticated file serving)
 * @rateLimit STANDARD (60 req/min) - Floorplan scene data retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorplanSceneRoute');

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: FileRecord shape from Firestore (minimal for this endpoint)
 */
interface FileRecordData {
  id: string;
  companyId?: string;
  processedData?: {
    processedDataPath?: string;
    fileType?: string;
  };
}

/**
 * 🏢 ENTERPRISE: Error response
 */
interface SceneErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FILES_COLLECTION = 'files';

/** Cache TTL for scene data - immutable once processed */
const SCENE_CACHE_TTL_SECONDS = 86400; // 24 hours (scene data is immutable)

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * GET /api/floorplans/scene?fileId=...
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: floorplans:floorplans:process (same as process endpoint)
 * - Tenant isolation via companyId validation
 *
 * Returns the processed scene JSON for a floorplan file.
 */
const getHandler = async (request: NextRequest) => {
  const handler = withAuth<SceneErrorResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleGetScene(req, ctx);
    },
    { permissions: 'floorplans:floorplans:process' }
  );

  return handler(request);
};

export const GET = withStandardRateLimit(getHandler);

// ============================================================================
// CORE LOGIC
// ============================================================================

async function handleGetScene(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<SceneErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  logger.info('[FloorplanScene] Request', { email: ctx.email, fileId });

  // =========================================================================
  // 1. VALIDATE REQUEST
  // =========================================================================

  if (!fileId || typeof fileId !== 'string') {
    return NextResponse.json(
      {
        success: false,
        error: 'fileId query parameter is required',
        errorCode: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }

  try {
    // =========================================================================
    // 2. FIREBASE ADMIN (ADR-077: Centralized via @/lib/firebaseAdmin)
    // =========================================================================

    const adminDb = getAdminFirestore();
    const adminStorage = getAdminStorage();

    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      logger.error('[FloorplanScene] FIREBASE_STORAGE_BUCKET not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Storage bucket not configured',
          errorCode: 'CONFIG_ERROR',
        },
        { status: 500 }
      );
    }

    const bucket = adminStorage.bucket(storageBucket);

    // =========================================================================
    // 3. FETCH FILE RECORD FROM FIRESTORE
    // =========================================================================

    const fileDoc = await adminDb.collection(FILES_COLLECTION).doc(fileId).get();

    if (!fileDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'File not found',
          errorCode: 'FILE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const fileData = { id: fileDoc.id, ...fileDoc.data() } as FileRecordData;

    // =========================================================================
    // 4. TENANT ISOLATION CHECK
    // =========================================================================

    if (fileData.companyId && fileData.companyId !== ctx.companyId) {
      logger.warn('[FloorplanScene] Tenant mismatch', { fileCompanyId: fileData.companyId, userCompanyId: ctx.companyId });
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          errorCode: 'TENANT_MISMATCH',
        },
        { status: 403 }
      );
    }

    // =========================================================================
    // 5. CHECK IF PROCESSED
    // =========================================================================

    const processedDataPath = fileData.processedData?.processedDataPath;

    if (!processedDataPath) {
      // File exists but not yet processed
      return NextResponse.json(
        {
          success: false,
          error: 'File not yet processed',
          errorCode: 'NOT_PROCESSED',
        },
        { status: 202 } // 202 Accepted - processing in progress or needs processing
      );
    }

    // =========================================================================
    // 6. DOWNLOAD SCENE JSON FROM STORAGE
    // =========================================================================

    logger.info('[FloorplanScene] Downloading from storage', { processedDataPath });

    const fileRef = bucket.file(processedDataPath);

    // Check if file exists
    const [exists] = await fileRef.exists();
    if (!exists) {
      logger.error('[FloorplanScene] Processed file not found in Storage', { processedDataPath });
      return NextResponse.json(
        {
          success: false,
          error: 'Processed scene file not found',
          errorCode: 'SCENE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const [fileBuffer] = await fileRef.download();

    // =========================================================================
    // 7. RETURN JSON WITH CACHING HEADERS
    // =========================================================================

    // Get metadata for ETag + compression flag
    const [metadata] = await fileRef.getMetadata();
    const etag = metadata.etag || metadata.generation || fileId;

    // Check If-None-Match for conditional request
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Decompress if gzip compressed (new processing uses compression)
    const isCompressed = metadata.metadata?.compressed === 'gzip';
    const rawBuffer = isCompressed ? gunzipSync(fileBuffer) : fileBuffer;

    logger.info('[FloorplanScene] Downloaded', {
      bytes: fileBuffer.length,
      ...(isCompressed && { decompressed: rawBuffer.length }),
    });

    // 🏢 ENTERPRISE: Return scene JSON with proper NextResponse
    return new NextResponse(rawBuffer.toString('utf-8'), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `private, max-age=${SCENE_CACHE_TTL_SECONDS}`,
        'ETag': String(etag),
        'X-File-Id': fileId,
      },
    });

  } catch (error) {
    logger.error('[FloorplanScene] Error', { error: error instanceof Error ? error.message : String(error) });

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch scene',
        errorCode: 'FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}
