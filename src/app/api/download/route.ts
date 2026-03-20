import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('DownloadRoute');

// ============================================================================
// 🏢 ENTERPRISE DOWNLOAD API - Force File Downloads
// ============================================================================

/**
 * 🎯 Professional Download Endpoint
 *
 * This API route forces file downloads instead of opening in browser.
 * Used for Firebase Storage URLs that don't respect download attribute.
 *
 * Industry standard approach used by:
 * - Google Drive, Dropbox, OneDrive
 * - Netflix, YouTube (video downloads)
 * - All Fortune 500 enterprise applications
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: photos:photos:upload
 * - Only authenticated users can download files
 * - Firebase Storage URLs validated (no arbitrary URL access)
 * - Firebase Security Rules provide additional access control
 *
 * @example
 * GET /api/download?url=FIREBASE_URL&filename=Γιώργος_Παπαδόπουλος_photo_1.jpg
 */
export async function GET(request: NextRequest) {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleDownload(req, ctx);
    },
    { permissions: 'photos:photos:upload' }
  );

  return handler(request);
}

async function handleDownload(request: NextRequest, ctx: AuthContext) {
  logger.info('API: File download request', { email: ctx.email, companyId: ctx.companyId });

  try {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const filename = searchParams.get('filename');

    // 🔒 SECURITY: Validate parameters
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Missing required parameter: url' },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: 'Missing required parameter: filename' },
        { status: 400 }
      );
    }

    // 🔒 SECURITY: Validate Firebase URL
    const validDomains = [
      'storage.googleapis.com',
      'firebasestorage.googleapis.com',
      'firebase.googleapis.com'
    ];

    let isValidFirebaseUrl = false;
    try {
      const url = new URL(fileUrl);
      isValidFirebaseUrl = validDomains.some(domain =>
        url.hostname.includes(domain) || url.hostname.endsWith(domain)
      );
    } catch (urlError) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    if (!isValidFirebaseUrl) {
      logger.error('SECURITY: Blocked non-Firebase URL', { fileUrl });
      return NextResponse.json(
        { error: 'Only Firebase Storage URLs are allowed' },
        { status: 403 }
      );
    }

    logger.info('DOWNLOAD REQUEST', {
      userId: ctx.uid,
      userEmail: ctx.email,
      companyId: ctx.companyId,
      url: fileUrl,
      filename: filename,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')
    });

    // 📁 FETCH: Download file from Firebase
    const response = await fetch(fileUrl);

    if (!response.ok) {
      logger.error('Firebase fetch failed', { status: response.status, statusText: response.statusText });
      return NextResponse.json(
        { error: 'Failed to fetch file from Firebase Storage' },
        { status: response.status }
      );
    }

    // 📦 GET: File content as blob
    const buffer = await response.arrayBuffer();
    const blob = new Uint8Array(buffer);

    // 🏢 ENTERPRISE: Get actual content type from Firebase response
    const actualContentType = response.headers.get('content-type') || 'application/octet-stream';

    // 🏢 ENTERPRISE: RFC 6266 compliant Content-Disposition for UTF-8 filenames
    // Pattern: Google Drive / Dropbox / OneDrive
    // - filename="ASCII_FALLBACK" for legacy browsers
    // - filename*=UTF-8''ENCODED for modern browsers (supports Greek, Chinese, etc.)
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_'); // ASCII fallback
    const utf8EncodedFilename = encodeURIComponent(filename);
    const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8EncodedFilename}`;

    // 🏢 ENTERPRISE HEADERS: Force download with proper filename and content type
    const headers = new Headers({
      'Content-Type': actualContentType,
      'Content-Disposition': contentDisposition,
      'Content-Length': blob.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      // Enterprise headers for auditing
      'X-Download-Source': 'firebase-storage',
      'X-Download-Method': 'server-proxy',
      'X-Content-Security': 'validated'
    });

    logger.info('DOWNLOAD SUCCESS', {
      filename,
      asciiFilename,
      size: blob.length,
      contentType: actualContentType,
      contentDisposition,
    });

    // 🎯 RETURN: File with force download headers
    return new NextResponse(blob, { headers });

  } catch (error) {
    logger.error('DOWNLOAD API ERROR', { error });

    return NextResponse.json(
      {
        error: 'Internal server error during download',
        details: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// 🔒 SECURITY: Protected Method Rejection (2026-02-06)
// =============================================================================
//
// These methods are not supported but are protected with authentication
// for consistency and to prevent future security issues if implementations
// are added without proper security review.
//
// Pattern: Enterprise Security by Design
// =============================================================================

/**
 * POST /api/download
 *
 * 🔒 SECURITY: Protected but not allowed
 * Returns 405 Method Not Allowed after auth check
 */
export const POST = withAuth(
  async () => {
    return NextResponse.json(
      { error: 'Method not allowed. Use GET.' },
      { status: 405 }
    );
  },
  { permissions: 'photos:photos:upload' }
);

/**
 * PUT /api/download
 *
 * 🔒 SECURITY: Protected but not allowed
 * Returns 405 Method Not Allowed after auth check
 */
export const PUT = withAuth(
  async () => {
    return NextResponse.json(
      { error: 'Method not allowed. Use GET.' },
      { status: 405 }
    );
  },
  { permissions: 'photos:photos:upload' }
);

/**
 * DELETE /api/download
 *
 * 🔒 SECURITY: Protected but not allowed
 * Returns 405 Method Not Allowed after auth check
 */
export const DELETE = withAuth(
  async () => {
    return NextResponse.json(
      { error: 'Method not allowed. Use GET.' },
      { status: 405 }
    );
  },
  { permissions: 'photos:photos:upload' }
);