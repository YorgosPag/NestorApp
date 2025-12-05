import { NextRequest, NextResponse } from 'next/server';

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
 * @example
 * GET /api/download?url=FIREBASE_URL&filename=Γιώργος_Παπαδόπουλος_photo_1.jpg
 */
export async function GET(request: NextRequest) {
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
      console.error('🚨 SECURITY: Blocked non-Firebase URL:', fileUrl);
      return NextResponse.json(
        { error: 'Only Firebase Storage URLs are allowed' },
        { status: 403 }
      );
    }

    console.log('🔗 DOWNLOAD REQUEST:', {
      url: fileUrl,
      filename: filename,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')
    });

    // 📁 FETCH: Download file from Firebase
    const response = await fetch(fileUrl);

    if (!response.ok) {
      console.error('❌ Firebase fetch failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch file from Firebase Storage' },
        { status: response.status }
      );
    }

    // 📦 GET: File content as blob
    const buffer = await response.arrayBuffer();
    const blob = new Uint8Array(buffer);

    // 🏢 ENTERPRISE HEADERS: Force download with proper filename
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': blob.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Enterprise headers for auditing
      'X-Download-Source': 'firebase-storage',
      'X-Download-Method': 'server-proxy',
      'X-Content-Security': 'validated'
    });

    console.log('✅ DOWNLOAD SUCCESS:', {
      filename: filename,
      size: blob.length,
      contentType: response.headers.get('content-type')
    });

    // 🎯 RETURN: File with force download headers
    return new NextResponse(blob, { headers });

  } catch (error) {
    console.error('❌ DOWNLOAD API ERROR:', error);

    return NextResponse.json(
      {
        error: 'Internal server error during download',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 🔒 SECURITY: Only allow GET method
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET.' },
    { status: 405 }
  );
}