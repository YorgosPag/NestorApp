/**
 * @fileoverview **Το έγγραφο ενός ελέγχου προμηθευτή, για τον άνθρωπο της ουράς** — υπογεγραμμένος σύνδεσμος.
 * @related ADR-923 §5.13 Ε1α · server/files/file-record-signed-url · ADR-864 §20 (ίχνος πρόσβασης)
 *
 * 🔒 **ΜΟΝΟ `super_admin`**, και κάθε άνοιγμα γράφεται (`document_accessed`) στο βιβλίο του χώρου που υπέβαλε το έγγραφο.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { signedUrlOfFileRecord, type FileRecordSignedUrl } from '@/server/files/file-record-signed-url';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { SupplierReviewRecord } from '@/subapps/catalog/types/supplier-verification';

const logger = createModuleLogger('api/admin/supplier-verifications/evidence');

type RouteContext = { params: Promise<{ companyId: string }> };

async function evidenceUrl(companyId: string, reviewerUid: string): Promise<FileRecordSignedUrl> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.SUPPLIER_VERIFICATIONS).doc(companyId).get();
  if (!snap.exists) return { error: 'NOT_FOUND' };
  const record = snap.data() as SupplierReviewRecord;

  const fileSnap = await db.collection(COLLECTIONS.FILES).doc(record.evidenceFileId).get();
  const signed = await signedUrlOfFileRecord(fileSnap);
  if ('error' in signed) return signed;

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
    entityId: companyId,
    entityName: record.submitted.legalName,
    action: 'document_accessed',
    changes: [{ field: 'evidenceFileId', oldValue: null, newValue: record.evidenceFileId }],
    performedBy: reviewerUid,
    performedByName: null,
    companyId,
  });
  return signed;
}

async function handler(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse<FileRecordSignedUrl>> {
  const companyId = (await routeContext?.params)?.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const body = await evidenceUrl(companyId, ctx.uid);
    const status = 'url' in body ? 200 : body.error === 'NOT_FOUND' ? 404 : 503;
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Το έγγραφο ελέγχου δεν άνοιξε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth<FileRecordSignedUrl, RouteContext>(handler, { requiredGlobalRoles: 'super_admin' }),
);
