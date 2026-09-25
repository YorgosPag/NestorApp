/**
 * =============================================================================
 * GET /api/showcase/[token]/pdf (ADR-312 + ADR-321 Phase 4)
 * =============================================================================
 *
 * Thin forward to `createPublicShowcasePdfRoute` (showcase-core). Public
 * (anonymous) — the share gate (ADR-884 Φ0.12) resolves the token over unified
 * `shares` + legacy `file_shares`, the access is recorded transactionally
 * (limit enforced), then the PDF streams.
 *
 * @module app/api/showcase/[token]/pdf/route
 */

import { NextRequest } from 'next/server';
import { createPublicShowcasePdfRoute } from '@/services/showcase-core';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PropertyHeader {
  companyId: string;
  code?: string;
  name?: string;
}

function sanitizeFilenameSegment(input: string | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(/[^\w\-. ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

const route = createPublicShowcasePdfRoute<PropertyHeader>({
  loggerName: 'ShowcasePdfProxy',
  shareNotFoundMessage: 'Showcase link not found or deactivated',
  entityNotFoundMessage: 'Property not found',
  pdfMissingMessage: 'PDF is not available for this showcase',

  // ADR-884 Φ0.12 — the one share gate (unified `shares` + legacy `file_shares`).
  shareEntityType: 'property_showcase',

  loadEntityHeader: async (entityId, adminDb): Promise<PropertyHeader | null> => {
    const snap = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(entityId).get();
    if (!snap.exists) return null;
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const companyId = d.companyId as string | undefined;
    if (!companyId) return null;
    return {
      companyId,
      code: d.code as string | undefined,
      name: d.name as string | undefined,
    };
  },

  // 🔴 ADR-742 §4 — ίδια παγίδα με το `create-unified-public-pdf-route`:
  // ανώνυμος καλών, και το κενό δεν είναι μισθωτής.
  checkTenant: (header, companyId) => isPayloadOwnedByCompany(header, companyId),

  buildFilename: (header) => {
    const code = sanitizeFilenameSegment(header.code);
    const name = sanitizeFilenameSegment(header.name);
    const base = [code, name].filter((s) => s.length > 0).join('-') || 'property-showcase';
    return `${base}.pdf`;
  },
});

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ token: string }> },
) {
  const { token } = await segmentData.params;
  const handler = withStandardRateLimit(async (req: NextRequest) => route.handle(req, token));
  return handler(request);
}
