/**
 * @fileoverview **Το ΠΚΑ μιας επαλήθευσης, για τον άνθρωπο της ουράς** — υπογεγραμμένος σύνδεσμος 15′.
 * @related ADR-900 §3.8 · lib/storage/signed-download-url (ο ΕΝΑΣ γεννήτορας) · ADR-864 §20 (ίχνος πρόσβασης)
 *
 * 🔒 **ΜΟΝΟ `super_admin`**, και **κάθε** άνοιγμα γράφεται (`document_accessed`) στο **προσωπικό** βιβλίο του
 * ιδιοκτήτη: το ΠΚΑ περιέχει ονόματα και ΑΦΜ τρίτων (συνιδιοκτήτες). Ο κανόνας `files_personal` δεν δίνει
 * πρόσβαση ούτε στον super admin — η πόρτα είναι **αυτή**, με λόγο και ίχνος, ποτέ ο πελάτης.
 *
 * ⚠️ Το αρχείο κρίνεται ξανά ότι **είναι** αυτό που επαληθεύτηκε: ίδιο `fileId` με την εγγραφή. Αν ο
 * ιδιοκτήτης το αντικατέστησε στον φάκελο, το αποτύπωμα (`evidence.digest`) μένει η απόδειξη.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { createModuleLogger } from '@/lib/telemetry';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { OwnershipVerification } from '@/types/ownership-verification';

const logger = createModuleLogger('api/admin/ownership-verifications/evidence');

type RouteContext = { params: Promise<{ verificationId: string }> };
type Body = { readonly url: string } | { readonly error: 'NOT_FOUND' | 'UNAVAILABLE' };

async function evidenceUrl(verificationId: string, reviewerUid: string): Promise<Body> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(verificationId).get();
  if (!snap.exists) return { error: 'NOT_FOUND' };
  const verification = snap.data() as OwnershipVerification;

  const fileSnap = await db.collection(COLLECTIONS.FILES_PERSONAL).doc(verification.evidence.fileId).get();
  const storagePath = fileSnap.get('storagePath');
  if (!fileSnap.exists || typeof storagePath !== 'string') return { error: 'NOT_FOUND' };

  const signed = await signedDownloadUrl({
    bucket: fileRecordBucket({ storagePlacement: fileSnap.get('storagePlacement') }),
    storagePath,
  });
  if (signed.outcome !== 'signed') return { error: 'UNAVAILABLE' };

  await EntityAuditService.recordChange({
    entityType: 'owner_property',
    entityId: verification.ownerPropertyId,
    entityName: null,
    action: 'document_accessed',
    changes: [{ field: 'ownershipVerification.evidence', oldValue: null, newValue: verification.id }],
    performedBy: reviewerUid,
    performedByName: null,
    userId: verification.uid,
  });
  return { url: signed.url };
}

async function handler(
  _request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse<Body>> {
  const verificationId = (await routeContext?.params)?.verificationId?.trim() ?? '';
  if (verificationId === '') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const body = await evidenceUrl(verificationId, ctx.uid);
    const status = 'url' in body ? 200 : body.error === 'NOT_FOUND' ? 404 : 503;
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Το ΠΚΑ δεν άνοιξε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth<Body, RouteContext>(handler, { requiredGlobalRoles: 'super_admin' }),
);
