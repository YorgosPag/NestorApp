/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Processing API Route
 * =============================================================================
 *
 * Server-side DXF/PDF processing that bypasses CORS restrictions.
 * Uses Firebase Admin SDK for direct Storage access.
 *
 * @module api/floorplans/process
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 * @version 1.0.0
 *
 * Architecture:
 * - Downloads file from Firebase Storage (server-side, no CORS)
 * - Parses DXF using centralized DxfSceneBuilder (NO duplicates)
 * - Saves processedData to FileRecord in Firestore
 *
 * Pattern: Based on /api/upload/photo (enterprise-approved)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  FloorplanProcessedData,
  DxfSceneData,
  DxfSceneEntity,
} from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Request body interface
 */
interface ProcessFloorplanRequest {
  /** FileRecord ID to process */
  fileId: string;
  /** Force reprocessing even if already processed */
  forceReprocess?: boolean;
}

/**
 * 🏢 ENTERPRISE: Success response
 */
interface ProcessFloorplanSuccessResponse {
  success: true;
  fileId: string;
  fileType: 'dxf' | 'pdf';
  processedAt: string;
  stats?: {
    entityCount: number;
    layerCount: number;
    parseTimeMs: number;
  };
}

/**
 * 🏢 ENTERPRISE: Error response
 */
interface ProcessFloorplanErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  details?: string;
}

type ProcessFloorplanResponse =
  | ProcessFloorplanSuccessResponse
  | ProcessFloorplanErrorResponse;

/**
 * 🏢 ENTERPRISE: FileRecord shape from Firestore
 */
interface FileRecordData {
  id: string;
  storagePath: string;
  contentType: string;
  ext: string;
  originalFilename: string;
  displayName: string;
  processedData?: FloorplanProcessedData;
  companyId?: string;
}

/**
 * 🏢 ENTERPRISE: Type-safe error interface
 */
interface FirebaseAdminError {
  message?: string;
  code?: string;
  details?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FILES_COLLECTION = 'files';
const SUPPORTED_DXF_EXTENSIONS = ['dxf'];
const SUPPORTED_PDF_EXTENSIONS = ['pdf'];

// 🏢 ENTERPRISE: In-memory mutex to prevent concurrent processing of same file
// This prevents race conditions when multiple requests arrive for the same fileId
const processingInProgress = new Set<string>();

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * POST /api/floorplans/process
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: floorplans:floorplans:process
 * - Tenant isolation via companyId validation
 * @rateLimit HEAVY (10 req/min) - Resource-intensive operation
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

// ============================================================================
// CORE PROCESSING LOGIC
// ============================================================================

async function handleProcessFloorplan(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ProcessFloorplanResponse>> {
  const startTime = Date.now();
  // 🏢 ENTERPRISE: Track fileId for mutex cleanup
  let currentFileId: string | null = null;

  console.log(
    `🏭 [FloorplanProcess] Request from ${ctx.email} (company: ${ctx.companyId})`
  );

  try {
    // =========================================================================
    // 1. PARSE & VALIDATE REQUEST
    // =========================================================================

    const body = (await request.json()) as ProcessFloorplanRequest;
    const { fileId, forceReprocess = false } = body;

    if (!fileId || typeof fileId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'fileId is required',
          errorCode: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    // Store for cleanup
    currentFileId = fileId;

    // 🏢 ENTERPRISE: Check if this file is already being processed (mutex)
    if (processingInProgress.has(fileId)) {
      console.log(`⏳ [FloorplanProcess] File ${fileId} is already being processed, returning`);
      currentFileId = null; // Don't cleanup - we didn't add it
      return NextResponse.json(
        {
          success: false,
          error: 'File is already being processed',
          errorCode: 'ALREADY_PROCESSING',
        },
        { status: 409 }
      );
    }

    // Add to processing set
    processingInProgress.add(fileId);
    console.log(`🏭 [FloorplanProcess] Processing file: ${fileId}`);

    // =========================================================================
    // 2. FIREBASE ADMIN (ADR-077: Centralized via @/lib/firebaseAdmin)
    // =========================================================================

    const adminDb = getAdminFirestore();
    const adminStorage = getAdminStorage();

    // 🏢 ENTERPRISE: Get bucket with explicit name from env variables
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      console.error('❌ [FloorplanProcess] FIREBASE_STORAGE_BUCKET not configured');
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

    console.log(`🗄️ [FloorplanProcess] Using bucket: ${bucket.name}`);

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
      console.warn(
        `🚨 [FloorplanProcess] Tenant mismatch: ${fileData.companyId} !== ${ctx.companyId}`
      );
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
    // 5. CHECK IF ALREADY PROCESSED
    // =========================================================================

    if (fileData.processedData && !forceReprocess) {
      console.log(`✅ [FloorplanProcess] Already processed, returning cached`);
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

    // =========================================================================
    // 6. DETERMINE FILE TYPE
    // =========================================================================

    const ext = fileData.ext?.toLowerCase().replace('.', '') || '';
    const isDxf = SUPPORTED_DXF_EXTENSIONS.includes(ext);
    const isPdf = SUPPORTED_PDF_EXTENSIONS.includes(ext);

    if (!isDxf && !isPdf) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${ext}`,
          errorCode: 'UNSUPPORTED_TYPE',
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // 7. DOWNLOAD FILE FROM STORAGE (SERVER-SIDE - NO CORS!)
    // =========================================================================

    console.log(`📥 [FloorplanProcess] Downloading from: ${fileData.storagePath}`);

    const fileRef = bucket.file(fileData.storagePath);
    const [fileBuffer] = await fileRef.download();

    console.log(
      `✅ [FloorplanProcess] Downloaded ${fileBuffer.length} bytes`
    );

    // =========================================================================
    // 8. PROCESS BASED ON FILE TYPE
    // =========================================================================

    let processedData: FloorplanProcessedData;
    let stats: { entityCount: number; layerCount: number; parseTimeMs: number } | undefined;

    if (isDxf) {
      // DXF Processing using centralized DxfSceneBuilder
      const parseStart = Date.now();

      // 🏢 ENTERPRISE: Use centralized EncodingService for Greek character support
      const { encodingService } = await import(
        '@/subapps/dxf-viewer/io/encoding-service'
      );
      const { content, encoding } = encodingService.decodeBufferWithAutoDetect(fileBuffer);

      console.log(`📝 [FloorplanProcess] Decoded with encoding: ${encoding}`);

      // 🏢 ENTERPRISE: Use centralized DxfSceneBuilder (NO duplicates!)
      const { DxfSceneBuilder } = await import(
        '@/subapps/dxf-viewer/utils/dxf-scene-builder'
      );

      const scene = DxfSceneBuilder.buildScene(content);

      const parseTimeMs = Date.now() - parseStart;

      // Convert SceneModel to DxfSceneData
      const dxfSceneData: DxfSceneData = {
        entities: scene.entities.map((entity) => {
          const { type, layer, ...rest } = entity;
          return {
            type,
            layer: layer || '0',
            ...rest,
          } as DxfSceneEntity;
        }),
        layers: scene.layers,
        bounds: scene.bounds,
      };

      stats = {
        entityCount: dxfSceneData.entities.length,
        layerCount: Object.keys(dxfSceneData.layers).length,
        parseTimeMs,
      };

      // =====================================================================
      // 🏢 ENTERPRISE: SAVE SCENE TO STORAGE (NOT Firestore!)
      // =====================================================================
      // Pattern: Autodesk, Bentley, Trimble - large data goes to object storage
      // Firestore: metadata only (~1KB), Storage: scene data (~100KB-5MB)
      // =====================================================================

      const processedDataPath = `${fileData.storagePath}.processed.json`;
      const processedJsonBuffer = Buffer.from(JSON.stringify(dxfSceneData), 'utf-8');

      console.log(`📤 [FloorplanProcess] Uploading processed JSON to Storage: ${processedDataPath}`);

      const processedFileRef = bucket.file(processedDataPath);
      await processedFileRef.save(processedJsonBuffer, {
        metadata: {
          contentType: 'application/json',
          // 🏢 ENTERPRISE V3: File is NOT public - served via authenticated API
          cacheControl: 'private, max-age=31536000', // 1 year cache (immutable)
        },
      });

      // 🏢 ENTERPRISE V3: NO makePublic() - scene served via /api/floorplans/scene
      // This is the secure enterprise pattern: all data access through authenticated APIs
      // Client calls GET /api/floorplans/scene?fileId=... which:
      // - Validates auth/permissions via withAuth middleware
      // - Checks tenant isolation (companyId)
      // - Downloads from Storage using Admin SDK
      // - Returns JSON with proper caching headers

      console.log(`✅ [FloorplanProcess] Processed JSON saved (${processedJsonBuffer.length} bytes)`);

      // 🏢 ENTERPRISE: Firestore gets METADATA ONLY (not the huge scene)
      // NOTE: processedDataUrl is NOT stored - client uses /api/floorplans/scene
      processedData = {
        fileType: 'dxf',
        processedDataPath,
        sceneStats: stats,
        bounds: dxfSceneData.bounds,
        processedAt: Date.now(),
        originalSize: fileBuffer.length,
        processedSize: processedJsonBuffer.length,
        encoding,
        // NOTE: scene is NOT stored in Firestore anymore (V3 architecture)
        // NOTE: processedDataUrl removed - client uses authenticated API
      };

      console.log(`✅ [FloorplanProcess] DXF parsed:`, stats);
    } else {
      // PDF Processing - For now, just mark as processed
      // Full PDF rendering would require server-side PDF library
      processedData = {
        fileType: 'pdf',
        processedAt: Date.now(),
        originalSize: fileBuffer.length,
      };

      console.log(`✅ [FloorplanProcess] PDF marked as processed`);
    }

    // =========================================================================
    // 9. SAVE METADATA TO FIRESTORE (small footprint only!)
    // =========================================================================

    await adminDb.collection(FILES_COLLECTION).doc(fileId).update({
      processedData,
      updatedAt: new Date().toISOString(),
    });

    console.log(`💾 [FloorplanProcess] Saved metadata to Firestore (scene in Storage)`);

    // =========================================================================
    // 10. AUDIT LOG
    // =========================================================================

    const duration = Date.now() - startTime;

    await logAuditEvent(ctx, 'data_accessed', fileId, 'api', {
      metadata: {
        path: '/api/floorplans/process',
        reason: `Floorplan processed: ${fileData.displayName} (${processedData.fileType}, ${duration}ms)`,
      },
    });

    console.log(
      `✅ [FloorplanProcess] Complete in ${duration}ms:`,
      fileData.displayName
    );

    // =========================================================================
    // 11. RETURN SUCCESS RESPONSE
    // =========================================================================

    // 🏢 ENTERPRISE: Release mutex
    processingInProgress.delete(fileId);

    return NextResponse.json({
      success: true,
      fileId,
      fileType: processedData.fileType,
      processedAt: new Date(processedData.processedAt).toISOString(),
      stats,
    });
  } catch (error) {
    // 🏢 ENTERPRISE: Release mutex on error
    if (currentFileId) {
      processingInProgress.delete(currentFileId);
    }

    // 🔍 ENTERPRISE: Detailed error logging for debugging
    console.error('❌ [FloorplanProcess] Error:', error);

    const firebaseError = error as FirebaseAdminError | null;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack =
      error instanceof Error ? error.stack : undefined;

    console.error('📋 [FloorplanProcess] Error details:', {
      message: errorMessage,
      code: firebaseError?.code,
      stack: errorStack?.substring(0, 500),
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
