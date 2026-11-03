/**
 * @fileoverview **GET /api/admin/supplier-brand-claims/[claimId]/evidence** — η απόδειξη της μάρκας, με ίχνος ποιος την άνοιξε.
 * @related ADR-923 §16 · server/catalog/supplier-evidence.server.ts
 *
 * 🔒 Μόνο `super_admin`.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { readBrandClaim } from '@/server/catalog/supplier-brand-claim.server';
import { auditedEvidenceUrl, evidenceResponse } from '@/server/catalog/supplier-evidence.server';
import type { FileRecordSignedUrl } from '@/server/files/file-record-signed-url';

type RouteContext = { params: Promise<{ claimId: string }> };

async function evidenceUrl(claimId: string, reviewerUid: string): Promise<FileRecordSignedUrl> {
  const db = getAdminFirestore();
  const claim = await readBrandClaim(db, claimId);
  if (claim === null) return { error: 'NOT_FOUND' };
  return auditedEvidenceUrl(db, {
    fileId: claim.evidenceFileId,
    entityType: ENTITY_TYPES.SUPPLIER_BRAND_CLAIM,
    entityId: claimId,
    entityName: claim.brandName,
    companyId: claim.companyId,
    reviewerUid,
  });
}

async function handler(_request: NextRequest, ctx: AuthContext, _cache: PermissionCache, routeContext?: RouteContext): Promise<NextResponse<FileRecordSignedUrl>> {
  const claimId = (await routeContext?.params)?.claimId?.trim() ?? '';
  if (claimId === '') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return evidenceResponse(() => evidenceUrl(claimId, ctx.uid));
}

export const GET = withSensitiveRateLimit(
  withAuth<FileRecordSignedUrl, RouteContext>(handler, { requiredGlobalRoles: 'super_admin' }),
);
