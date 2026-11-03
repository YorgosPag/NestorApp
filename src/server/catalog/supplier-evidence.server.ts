import 'server-only';

/**
 * **Το άνοιγμα μιας απόδειξης από τον διαχειριστή** (ADR-923 §5.13 Ε1α · §16): υπογεγραμμένος σύνδεσμος με ίχνος ποιος το άνοιξε.
 * Κοινό για την επιβεβαίωση επιχείρησης και την κατοχή μάρκας.
 *
 * @module server/catalog/supplier-evidence.server
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { signedUrlOfFileRecord, type FileRecordSignedUrl } from '@/server/files/file-record-signed-url';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('server/catalog/supplier-evidence');

export interface SupplierEvidenceAccess {
  readonly fileId: string;
  readonly entityType: (typeof ENTITY_TYPES)['SUPPLIER_VERIFICATION' | 'SUPPLIER_BRAND_CLAIM'];
  readonly entityId: string;
  readonly entityName: string | null;
  readonly companyId: string;
  readonly reviewerUid: string;
}

export async function auditedEvidenceUrl(db: AdminFirestore, access: SupplierEvidenceAccess): Promise<FileRecordSignedUrl> {
  const { fileId, entityType, entityId, entityName, companyId, reviewerUid } = access;
  const fileSnap = await db.collection(COLLECTIONS.FILES).doc(fileId).get();
  const signed = await signedUrlOfFileRecord(fileSnap);
  if ('error' in signed) return signed;
  await EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName,
    action: 'document_accessed',
    changes: [{ field: 'evidenceFileId', oldValue: null, newValue: fileId }],
    performedBy: reviewerUid,
    performedByName: null,
    companyId,
  });
  return signed;
}

/** Η μία μετάφραση σε απάντηση. Βλάβη ⇒ 503, ποτέ 404: «δεν μπόρεσα να ρωτήσω» δεν είναι «δεν υπάρχει». */
export async function evidenceResponse(load: () => Promise<FileRecordSignedUrl>): Promise<NextResponse<FileRecordSignedUrl>> {
  try {
    const body = await load();
    const status = 'url' in body ? 200 : body.error === 'NOT_FOUND' ? 404 : 503;
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Το έγγραφο ελέγχου δεν άνοιξε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}
