/**
 * Vendor portal file upload helper — Admin SDK Storage write.
 * Extracted from the route file per CLAUDE.md SOS N.7.1 (max 500 LOC).
 *
 * @module api/vendor/quote/[token]/upload
 * @enterprise ADR-327 §7 + §11
 */

import 'server-only';

import { getAdminStorage } from '@/lib/firebaseAdmin';
import { generateFileId } from '@/services/enterprise-id.service';
import { adminTimestampAsClient } from '@/services/vendor-portal/vendor-portal-token-service';
import type { QuoteAttachment } from '@/subapps/procurement/types/quote';

function inferExtension(mimeType: string, fallbackName: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'application/pdf') return 'pdf';
  const m = fallbackName.match(/\.([a-zA-Z0-9]+)$/);
  return m?.[1]?.toLowerCase() ?? 'bin';
}

export async function uploadVendorFiles(
  companyId: string,
  quoteId: string,
  inviteId: string,
  vendorContactId: string,
  files: File[],
): Promise<QuoteAttachment[]> {
  if (files.length === 0) return [];
  const bucket = getAdminStorage().bucket();
  const out: QuoteAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = generateFileId();
    const ext = inferExtension(file.type, file.name);
    const storagePath = `companies/${companyId}/quotes/${quoteId}/portal-${fileId}.${ext}`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: 'private, max-age=86400',
        metadata: { source: 'vendor_portal', inviteId, vendorContactId },
      },
    });
    await fileRef.makePublic();
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    out.push({
      id: fileId,
      fileUrl,
      storagePath,
      fileType: file.type === 'application/pdf' ? 'pdf' : 'image',
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: adminTimestampAsClient(),
      uploadedBy: `vendor:${vendorContactId}`,
    });
  }
  return out;
}
