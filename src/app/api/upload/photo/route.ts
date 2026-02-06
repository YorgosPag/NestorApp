import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminStorage } from '@/lib/firebaseAdmin';
import { FileNamingService } from '@/services/FileNamingService';
import { generateTempId } from '@/services/enterprise-id.service';

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
  console.log(`📁 API: Photo upload request from user ${ctx.email} (company: ${ctx.companyId})`);

  try {
    console.log('🚀 SERVER: Starting Firebase Admin server-side upload...');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderPath = formData.get('folderPath') as string || 'contacts/photos';

    // 🏢 ENTERPRISE: Get contact data for proper filename generation
    const contactDataJson = formData.get('contactData') as string;
    const purpose = formData.get('purpose') as string || 'photo';
    const photoIndex = formData.get('photoIndex') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📁 SERVER: File received:', {
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

        console.log('🏷️ SERVER: FileNamingService applied:', {
          original: file.name,
          renamed: fileName,
          purpose: servicePurpose,
          contactType: contactData.type
        });

      } catch (error) {
        console.error('❌ SERVER: FileNamingService failed, using fallback:', error);

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

      console.log('⚠️ SERVER: No contact data provided, using fallback naming');
    }

    const storagePath = `${folderPath}/${fileName}`;
    console.log('📍 SERVER: Upload path:', storagePath);

    // 🏢 ENTERPRISE: Upload using Firebase Admin Storage (ADR-077: Centralized)
    const adminStorage = getAdminStorage();
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    console.log('🔧 ADMIN STORAGE: Uploading to bucket:', bucket.name);

    // Upload buffer to Firebase Admin Storage
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      }
    });

    console.log('✅ ADMIN STORAGE: Upload completed:', storagePath);

    // Make the file publicly readable and get download URL
    await fileRef.makePublic();
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    console.log('✅ UPLOAD SUCCESS:', {
      userId: ctx.uid,
      userEmail: ctx.email,
      companyId: ctx.companyId,
      fileName: fileName,
      fileSize: file.size,
      storagePath: storagePath,
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
    console.error('❌ ADMIN STORAGE: Upload failed:', error);

    // 🔍 DETAILED ERROR LOGGING for Firebase Admin Storage debugging
    // 🏢 ENTERPRISE: Type-safe error handling
    const firebaseError = error as FirebaseAdminError | null;
    if (firebaseError && typeof firebaseError === 'object') {
      console.error('📋 ADMIN ERROR DETAILS:', {
        message: firebaseError.message,
        code: firebaseError.code,
        details: firebaseError.details,
        stack: firebaseError.stack?.substring(0, 200)
      });
    }

    return NextResponse.json({
      error: 'Firebase Admin Storage upload failed',
      details: error instanceof Error ? error.message : String(error),
      errorCode: firebaseError?.code
    }, { status: 500 });
  }
}