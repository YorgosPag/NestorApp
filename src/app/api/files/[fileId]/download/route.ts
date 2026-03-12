/**
 * =============================================================================
 * FILE DOWNLOAD PROXY — Server-side Storage access
 * =============================================================================
 *
 * Downloads a file from Firebase Storage using Admin SDK.
 * Bypasses client-side CORS and Storage security rules.
 *
 * @module api/files/[fileId]/download
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * 🔒 SECURITY: Protected with RBAC — requires authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getAdminStorage } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';

interface FileRecordData {
  storagePath?: string;
  contentType?: string;
  companyId?: string;
  isDeleted?: boolean;
  status?: string;
}

export const GET = withStandardRateLimit(
  async (request: NextRequest, segmentData?: { params: Promise<{ fileId: string }> }) => {
    const handler = withAuth<ArrayBuffer | { error: string }>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
        const params = await segmentData?.params;
        const fileId = params?.fileId;

        if (!fileId) {
          return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        }

        try {
          // Load FileRecord from Firestore
          const adminDb = getAdminFirestore();
          const fileDoc = await adminDb.collection(COLLECTIONS.FILES).doc(fileId).get();

          if (!fileDoc.exists) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
          }

          const fileData = fileDoc.data() as FileRecordData;

          if (fileData.isDeleted) {
            return NextResponse.json({ error: 'File has been deleted' }, { status: 404 });
          }

          if (!fileData.storagePath) {
            return NextResponse.json({ error: 'No storage path' }, { status: 404 });
          }

          // Download from Firebase Storage via Admin SDK (no CORS/rules issues)
          // Must specify bucket name — default bucket differs from actual storage bucket
          const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'pagonis-87766.firebasestorage.app';
          const bucket = getAdminStorage().bucket(bucketName);
          const file = bucket.file(fileData.storagePath);

          const [fileBuffer] = await file.download();

          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              'Content-Type': fileData.contentType || 'application/octet-stream',
              'Cache-Control': 'private, max-age=3600',
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      },
      { permissions: 'files:files:view' }
    );

    return handler(request);
  }
);
