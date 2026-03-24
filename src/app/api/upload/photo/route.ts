import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminStorage } from '@/lib/firebaseAdmin';
import { FileNamingService } from '@/services/FileNamingService';
import { generateTempId, generateFileId } from '@/services/enterprise-id.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { LEGACY_STORAGE_PATHS, type EntityType, type FileDomain, type FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { sanitizeStoragePath } from '@/lib/security/path-sanitizer';

const logger = createModuleLogger('UploadPhotoRoute');

// 🏢 ENTERPRISE: Type-safe error interface for Firebase Admin errors
interface FirebaseAdminError {
  message?: string;
  code?: string;
  details?: string;
  stack?: string;
}

/** 🏢 ENTERPRISE: Discriminated union response types */
interface PhotoUploadSuccessResponse {
  success: true;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface PhotoUploadErrorResponse {
  error: string;
  details?: string;
  errorCode?: string;
}

type PhotoUploadResponse = PhotoUploadSuccessResponse | PhotoUploadErrorResponse;

// ============================================================================
// PHOTO UPLOAD ENDPOINT
// ============================================================================

/**
 * POST /api/upload/photo
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: photos:photos:upload
 * - Only authenticated users can upload files
 * - Firebase Storage Security Rules provide additional file-level access control
 *
 * @rateLimit STANDARD (60 req/min) - Photo upload
 */
const postHandler = async (request: NextRequest) => {
  const handler = withAuth<unknown>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleUploadPhoto(req, ctx);
    },
    { permissions: 'photos:photos:upload' }
  );

  return handler(request);
};

export const POST = withStandardRateLimit(postHandler);

async function handleUploadPhoto(request: NextRequest, ctx: AuthContext) {
  logger.info('[Upload/Photo] Photo upload request', { email: ctx.email, companyId: ctx.companyId });

  try {
    logger.info('[Upload/Photo] Starting Firebase Admin server-side upload');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawFolderPath = formData.get('folderPath') as string || LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS;

    // 🔒 SECURITY (ADR-252 SV-C1): Sanitize folder path to prevent path traversal
    const pathCheck = sanitizeStoragePath(rawFolderPath);
    if (!pathCheck.valid) {
      logger.warn('[Upload/Photo] Path traversal attempt blocked', {
        rawPath: rawFolderPath,
        reason: pathCheck.reason,
        userId: ctx.uid,
      });
      return NextResponse.json(
        { error: 'Invalid folder path', details: pathCheck.reason },
        { status: 400 }
      );
    }
    const folderPath = pathCheck.sanitizedPath;

    // 🏢 ENTERPRISE: Get contact data for proper filename generation
    const contactDataJson = formData.get('contactData') as string;
    const purpose = formData.get('purpose') as string || 'photo';
    const photoIndex = formData.get('photoIndex') as string;

    // 🏢 ENTERPRISE: Optional canonical storage params (preferred over legacy folderPath)
    const canonicalEntityType = formData.get('entityType') as string | null;
    const canonicalEntityId = formData.get('entityId') as string | null;
    const canonicalDomain = formData.get('domain') as string | null;
    const canonicalCategory = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    logger.info('[Upload/Photo] File received', {
      userId: ctx.uid,
      userEmail: ctx.email,
      companyId: ctx.companyId,
      name: file.name,
      size: file.size,
      type: file.type,
      hasContactData: !!contactDataJson,
      purpose,
      photoIndex
    });

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🏢 ENTERPRISE FILENAME GENERATION: Use FileNamingService for professional names
    let fileName: string;

    if (contactDataJson) {
      try {
        const contactData = JSON.parse(contactDataJson);

        // Map purpose string to FileNamingService purpose type
        let servicePurpose: 'logo' | 'photo' | 'representative' = 'photo';
        if (purpose === 'logo') {
          servicePurpose = 'logo';
        } else if (purpose === 'representative' || purpose === 'avatar') {
          servicePurpose = 'representative';
        } else {
          servicePurpose = 'photo';
        }

        // Generate professional filename using FileNamingService
        const renamedFile = FileNamingService.generateProperFilename(
          file,
          contactData,
          servicePurpose,
          photoIndex ? parseInt(photoIndex) : undefined
        );

        fileName = renamedFile.name;

        logger.info('[Upload/Photo] FileNamingService applied', {
          original: file.name,
          renamed: fileName,
          purpose: servicePurpose,
          contactType: contactData.type
        });

      } catch (error) {
        logger.error('[Upload/Photo] FileNamingService failed, using fallback', { error: getErrorMessage(error) });

        // 🏢 ENTERPRISE: Fallback with crypto-secure ID generation
        const timestamp = Date.now();
        const uniqueId = generateTempId(); // Crypto-secure temp ID
        const extension = file.name.split('.').pop();
        fileName = `${timestamp}_${uniqueId}.${extension}`;
      }
    } else {
      // 🏢 ENTERPRISE: No contact data - use crypto-secure fallback naming
      const timestamp = Date.now();
      const uniqueId = generateTempId(); // Crypto-secure temp ID
      const extension = file.name.split('.').pop();
      fileName = `${timestamp}_${uniqueId}.${extension}`;

      logger.warn('[Upload/Photo] No contact data provided, using fallback naming');
    }

    // 🏢 ENTERPRISE: Prefer canonical path when full params provided
    let storagePath: string;
    if (ctx.companyId && canonicalEntityType && canonicalEntityId) {
      const fileId = generateFileId();
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const { path } = buildStoragePath({
        companyId: ctx.companyId,
        entityType: canonicalEntityType as EntityType,
        entityId: canonicalEntityId,
        domain: (canonicalDomain || 'admin') as FileDomain,
        category: (canonicalCategory || 'photos') as FileCategory,
        fileId,
        ext,
      });
      storagePath = path;
      // Update fileName to use fileId for consistency
      fileName = `${fileId}.${ext}`;
    } else {
      // Legacy path — maintained for backward compatibility
      storagePath = `${folderPath}/${fileName}`;
    }
    logger.info('[Upload/Photo] Upload path', { storagePath, canonical: !!(ctx.companyId && canonicalEntityType && canonicalEntityId) });

    // 🏢 ENTERPRISE: Upload using Firebase Admin Storage (ADR-077: Centralized)
    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    logger.info('[Upload/Photo] Uploading to bucket', { bucketName: bucket.name });

    // Upload buffer to Firebase Admin Storage
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      }
    });

    logger.info('[Upload/Photo] Upload completed', { storagePath });

    // Make the file publicly readable and get download URL
    await fileRef.makePublic();
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    logger.info('[Upload/Photo] Upload success', {
      userId: ctx.uid,
      userEmail: ctx.email,
      companyId: ctx.companyId,
      fileName,
      fileSize: file.size,
      storagePath,
      url: downloadURL
    });

    return NextResponse.json({
      success: true,
      url: downloadURL,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: storagePath,
      uploadedBy: ctx.email,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Upload/Photo] Upload failed', { error: getErrorMessage(error) });

    // DETAILED ERROR LOGGING for Firebase Admin Storage debugging
    // ENTERPRISE: Type-safe error handling
    const firebaseError = error as FirebaseAdminError | null;
    if (firebaseError && typeof firebaseError === 'object') {
      logger.error('[Upload/Photo] Admin error details', {
        message: firebaseError.message,
        code: firebaseError.code,
        details: firebaseError.details,
        stack: firebaseError.stack?.substring(0, 200)
      });
    }

    return NextResponse.json({
      error: 'Firebase Admin Storage upload failed',
      details: getErrorMessage(error),
      errorCode: firebaseError?.code
    }, { status: 500 });
  }
}