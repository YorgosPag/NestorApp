/**
 * =============================================================================
 * Batch Download API — Server-side ZIP creation
 * =============================================================================
 *
 * Creates a ZIP file from multiple Firebase Storage URLs.
 * Uses Node.js built-in zlib (no external packages needed).
 *
 * POST /api/files/batch-download
 * Body: { files: [{ url: string, filename: string }] }
 * Returns: application/zip binary stream
 *
 * @module api/files/batch-download
 * @enterprise ADR-031 - Canonical File Storage System
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { deflateRawSync } from 'zlib';

const logger = createModuleLogger('BatchDownloadRoute');

// ============================================================================
// ZIP BUILDER (minimal, spec-compliant, no external deps)
// ============================================================================

interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

/**
 * Build a ZIP file from entries using deflate compression.
 * Implements ZIP format (PKZIP APPNOTE 6.3.3) with:
 * - Local file headers
 * - Compressed data (deflate)
 * - Central directory
 * - End of central directory record
 */
function buildZip(entries: ZipEntry[]): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.filename);
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    // Local file header (30 bytes + filename + compressed data)
    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);   // Signature
    lv.setUint16(4, 20, true);            // Version needed (2.0)
    lv.setUint16(6, 0, true);             // Flags
    lv.setUint16(8, 8, true);             // Compression: deflate
    lv.setUint16(10, 0, true);            // Mod time
    lv.setUint16(12, 0, true);            // Mod date
    lv.setUint32(14, crc, true);          // CRC-32
    lv.setUint32(18, compressed.length, true);  // Compressed size
    lv.setUint32(22, entry.data.length, true);  // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);   // Filename length
    lv.setUint16(28, 0, true);            // Extra field length
    new Uint8Array(local).set(nameBytes, 30);

    // Central directory header (46 bytes + filename)
    const central = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);    // Signature
    cv.setUint16(4, 20, true);            // Version made by
    cv.setUint16(6, 20, true);            // Version needed
    cv.setUint16(8, 0, true);             // Flags
    cv.setUint16(10, 8, true);            // Compression: deflate
    cv.setUint16(12, 0, true);            // Mod time
    cv.setUint16(14, 0, true);            // Mod date
    cv.setUint32(16, crc, true);          // CRC-32
    cv.setUint32(20, compressed.length, true);  // Compressed size
    cv.setUint32(24, entry.data.length, true);  // Uncompressed size
    cv.setUint16(28, nameBytes.length, true);   // Filename length
    cv.setUint16(30, 0, true);            // Extra field length
    cv.setUint16(32, 0, true);            // Comment length
    cv.setUint16(34, 0, true);            // Disk number
    cv.setUint16(36, 0, true);            // Internal attributes
    cv.setUint32(38, 0, true);            // External attributes
    cv.setUint32(42, offset, true);       // Offset of local header
    new Uint8Array(central).set(nameBytes, 46);

    localHeaders.push(new Uint8Array(local));
    localHeaders.push(new Uint8Array(compressed));
    centralHeaders.push(new Uint8Array(central));

    offset += 30 + nameBytes.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const h of centralHeaders) centralDirSize += h.length;

  // End of central directory (22 bytes)
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);      // Signature
  ev.setUint16(4, 0, true);               // Disk number
  ev.setUint16(6, 0, true);               // Central dir disk
  ev.setUint16(8, entries.length, true);   // Entries on disk
  ev.setUint16(10, entries.length, true);  // Total entries
  ev.setUint32(12, centralDirSize, true);  // Central dir size
  ev.setUint32(16, centralDirOffset, true); // Central dir offset
  ev.setUint16(20, 0, true);              // Comment length

  // Concatenate all parts
  const totalSize = offset + centralDirSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localHeaders) { result.set(part, pos); pos += part.length; }
  for (const part of centralHeaders) { result.set(part, pos); pos += part.length; }
  result.set(new Uint8Array(eocd), pos);

  return result;
}

/**
 * CRC-32 calculation (standard polynomial 0xEDB88320)
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================================
// FIREBASE URL VALIDATION
// ============================================================================

const VALID_DOMAINS = [
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'firebase.googleapis.com',
];

function isFirebaseUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return VALID_DOMAINS.some(d => url.hostname.includes(d));
  } catch {
    return false;
  }
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

interface BatchFile {
  url: string;
  filename: string;
}

interface BatchRequestBody {
  files: BatchFile[];
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export const maxDuration = 60; // Allow up to 60s for large batches

export async function POST(request: NextRequest) {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleBatchDownload(req, ctx);
    },
    { permissions: 'photos:photos:upload' }
  );

  return handler(request);
}

async function handleBatchDownload(request: NextRequest, ctx: AuthContext) {
  logger.info('Batch download request', { email: ctx.email });

  try {
    const body = (await request.json()) as BatchRequestBody;

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (body.files.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 files per batch' }, { status: 400 });
    }

    // Validate all URLs are Firebase URLs
    for (const file of body.files) {
      if (!file.url || !file.filename) {
        return NextResponse.json({ error: 'Each file needs url and filename' }, { status: 400 });
      }
      if (!isFirebaseUrl(file.url)) {
        logger.error('SECURITY: Non-Firebase URL in batch', { url: file.url });
        return NextResponse.json({ error: 'Only Firebase Storage URLs allowed' }, { status: 403 });
      }
    }

    // Fetch all files in parallel
    const entries: ZipEntry[] = [];
    const fetchResults = await Promise.allSettled(
      body.files.map(async (file): Promise<ZipEntry> => {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${file.filename}`);
        const buffer = await response.arrayBuffer();
        return { filename: file.filename, data: new Uint8Array(buffer) };
      })
    );

    for (const result of fetchResults) {
      if (result.status === 'fulfilled') {
        entries.push(result.value);
      } else {
        logger.error('Failed to fetch file for batch', { error: result.reason });
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch any files' }, { status: 502 });
    }

    // Build ZIP
    const zipData = buildZip(entries);

    logger.info('Batch download complete', {
      userId: ctx.uid,
      filesRequested: body.files.length,
      filesIncluded: entries.length,
      zipSize: zipData.length,
    });

    // Return ZIP
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipFilename = `files_${timestamp}.zip`;

    return new NextResponse(zipData, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipData.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.error('Batch download error', { error });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
