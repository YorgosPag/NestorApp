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
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
export async function GET(request: NextRequest) {
  const handler = withAuth<SceneErrorResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleGetScene(req, ctx);
    },
    { permissions: 'floorplans:floorplans:process' }
  );

  return handler(request);
}

// ============================================================================
// CORE LOGIC
// ============================================================================

async function handleGetScene(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<SceneErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  console.log(`📡 [FloorplanScene] Request from ${ctx.email} for file: ${fileId}`);

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
    // 2. INITIALIZE FIREBASE ADMIN
    // =========================================================================

    let adminApp;
    if (getApps().length === 0) {
      const projectId =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

      const storageBucket =
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${projectId}.appspot.com`;

      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY
          );
          adminApp = initializeApp({
            credential: cert(serviceAccount),
            storageBucket,
          });
        } catch {
          adminApp = initializeApp({
            projectId,
            storageBucket,
          });
        }
      } else {
        adminApp = initializeApp({
          projectId,
          storageBucket,
        });
      }
    } else {
      adminApp = getApps()[0];
    }

    const adminDb = getFirestore(adminApp);
    const adminStorage = getStorage(adminApp);

    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!storageBucket) {
      console.error('❌ [FloorplanScene] FIREBASE_STORAGE_BUCKET not configured');
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
      console.warn(
        `🚨 [FloorplanScene] Tenant mismatch: ${fileData.companyId} !== ${ctx.companyId}`
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

    console.log(`📥 [FloorplanScene] Downloading from: ${processedDataPath}`);

    const fileRef = bucket.file(processedDataPath);

    // Check if file exists
    const [exists] = await fileRef.exists();
    if (!exists) {
      console.error(`❌ [FloorplanScene] Processed file not found in Storage: ${processedDataPath}`);
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

    console.log(`✅ [FloorplanScene] Downloaded ${fileBuffer.length} bytes`);

    // =========================================================================
    // 7. RETURN JSON WITH CACHING HEADERS
    // =========================================================================

    // Get metadata for ETag
    const [metadata] = await fileRef.getMetadata();
    const etag = metadata.etag || metadata.generation || fileId;

    // Check If-None-Match for conditional request
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // 🏢 ENTERPRISE: Return scene JSON with proper NextResponse
    // Convert Buffer to string for NextResponse body
    return new NextResponse(fileBuffer.toString('utf-8'), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `private, max-age=${SCENE_CACHE_TTL_SECONDS}`,
        'ETag': String(etag),
        'X-File-Id': fileId,
      },
    });

  } catch (error) {
    console.error('❌ [FloorplanScene] Error:', error);

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
