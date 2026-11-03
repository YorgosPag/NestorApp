/**
 * @fileoverview **Το έγγραφο ενός ελέγχου προμηθευτή, για τον άνθρωπο της ουράς** — υπογεγραμμένος σύνδεσμος.
 * @related ADR-923 §5.13 Ε1α · server/catalog/supplier-evidence.server.ts · ADR-864 §20 (ίχνος πρόσβασης)
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
import { auditedEvidenceUrl, evidenceResponse } from '@/server/catalog/supplier-evidence.server';
import type { FileRecordSignedUrl } from '@/server/files/file-record-signed-url';
import type { SupplierReviewRecord } from '@/subapps/catalog/types/supplier-verification';

type RouteContext = { params: Promise<{ companyId: string }> };

async function evidenceUrl(companyId: string, reviewerUid: string): Promise<FileRecordSignedUrl> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.SUPPLIER_VERIFICATIONS).doc(companyId).get();
  if (!snap.exists) return { error: 'NOT_FOUND' };
  const record = snap.data() as SupplierReviewRecord;
  return auditedEvidenceUrl(db, {
    fileId: record.evidenceFileId,
    entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
    entityId: companyId,
    entityName: record.submitted.legalName,
    companyId,
    reviewerUid,
  });
}

async function handler(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse<FileRecordSignedUrl>> {
  const companyId = (await routeContext?.params)?.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return evidenceResponse(() => evidenceUrl(companyId, ctx.uid));
}

export const GET = withSensitiveRateLimit(
  withAuth<FileRecordSignedUrl, RouteContext>(handler, { requiredGlobalRoles: 'super_admin' }),
);
