import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας του λογοτύπου εταιρείας** — `companies/{companyId}.brandLogo` (ADR-ACC-018 §17).
 * @module server/company/brand-logo-store.server
 * @related types/company-brand · server/company/brand-logo-normalize.server · services/storage-admin/public-upload.service
 *
 * Ροή ορισμού: κανονικοποίηση (bytes μας, όχι του χρήστη) → ίδιο sha256 με το τρέχον ⇒ **καμία** εγγραφή (ιδεμποτία) →
 * **νέο** αντικείμενο Storage (`uploadPublicFile`: claim πριν το ανέβασμα, κατά της orphan-cleanup) → γενιά GCS →
 * συναλλαγή στο έγγραφο του χώρου (`brandLogo` + παράγωγο `logoURL` + σφραγίδα φορέα) → γραμμή Ιστορικού.
 *
 * ⛔ **ΠΟΤΕ διαγραφή bytes**: το παλιό λογότυπο το δείχνουν παγωμένα στιγμιότυπα εκδομένων παραστατικών
 *    (`InvoiceIssuer.logo`). Η «αφαίρεση» καθαρίζει μόνο τον δείκτη.
 * 🔑 Το `logoURL` είναι **παράγωγο** για τους αναγνώστες βιτρινών (ADR-312, `company-branding-resolver`) — δεν το
 *    γράφει κανείς άλλος, και δεν είναι δεύτερη πηγή.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS } from '@/config/domain-constants';
import { performerId, type AuditPerformer } from '@/lib/audit/audit-performer';
import { nowISO } from '@/lib/date-local';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { statStorageObject } from '@/lib/storage/storage-object-stream';
import { createModuleLogger } from '@/lib/telemetry';
import type { BrandLogoRefusal } from '@/lib/company/brand-logo-policy';
import { brandLogoOf } from '@/lib/company/brand-logo-ref';
import { fileStorageBucket, fileStoragePlacementOfBucket } from '@/server/files/file-record-bucket';
import { auditActorOf, performerStamp, resolvePerformer, type ResolvedPerformer } from '@/server/lib/performer-stamp';
import { generateFileId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { buildProxyUrl, uploadPublicFile } from '@/services/storage-admin/public-upload.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import type { CompanyBrandLogo } from '@/types/company-brand';
import { normalizeBrandLogo, type NormalizedBrandLogo } from './brand-logo-normalize.server';

const logger = createModuleLogger('BrandLogoStore');

/** Τα bytes είναι αμετάβλητα (νέο όνομα σε κάθε ανέβασμα) ⇒ ο browser τα κρατά επ' αόριστον. */
const BRAND_LOGO_CACHE_CONTROL = 'private, max-age=31536000, immutable';

type SetBrandLogoOutcome =
  | { readonly kind: 'set'; readonly brandLogo: CompanyBrandLogo }
  | { readonly kind: 'refused'; readonly refusal: BrandLogoRefusal }
  | { readonly kind: 'absent' };

type ClearBrandLogoOutcome = { readonly kind: 'cleared' } | { readonly kind: 'absent' };

function companyRef(companyId: string) {
  return getAdminFirestore().collection(COLLECTIONS.COMPANIES).doc(companyId);
}

/** Ανεβάζει τα κανονικοποιημένα bytes σε **νέο** αντικείμενο και επιστρέφει την πλήρη εγγραφή. */
async function storeNewBrandLogo(companyId: string, logo: NormalizedBrandLogo, createdBy: string): Promise<CompanyBrandLogo> {
  const fileId = generateFileId();
  const { path: storagePath } = buildStoragePath({
    companyId,
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.PHOTOS,
    fileId,
    ext: logo.contentType === 'image/png' ? 'png' : 'jpg',
  });
  const uploaded = await uploadPublicFile({
    storagePath,
    buffer: logo.bytes,
    contentType: logo.contentType,
    cacheControl: BRAND_LOGO_CACHE_CONTROL,
    customMetadata: { sha256: logo.sha256 },
    createdBy,
  });
  // Ο κάδος από εκεί όπου έγραψε **πράγματι** το ανέβασμα — ποτέ μαντεψιά (ADR-895 Α10).
  const placement = fileStoragePlacementOfBucket(uploaded.bucket);
  if (placement === null) throw new Error(`brand logo written to a foreign bucket: ${uploaded.bucket}`);
  const stat = await statStorageObject(storagePath, { bucket: fileStorageBucket(placement) });
  if (stat.kind !== 'found') throw new Error('brand logo vanished right after upload');
  return {
    fileId,
    storagePath,
    generation: stat.generation,
    sha256: logo.sha256,
    contentType: logo.contentType,
    width: logo.width,
    height: logo.height,
    sizeBytes: logo.bytes.length,
    updatedAt: nowISO(),
  };
}

/** Η γραμμή Ιστορικού — τι άλλαξε, από ποιον. Αποτυχία Ιστορικού δεν ακυρώνει την αλλαγή (ADR-195). */
async function recordBrandLogoChange(
  companyId: string, previous: CompanyBrandLogo | null, next: CompanyBrandLogo | null, actor: ResolvedPerformer,
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: 'brandLogo', oldValue: previous?.fileId ?? null, newValue: next?.fileId ?? null, label: 'brandLogo' }],
    ...auditActorOf(actor),
    companyId,
  });
}

/** Γράφει τον δείκτη (ή τον καθαρίζει) σε συναλλαγή· `false` ⇒ το έγγραφο του χώρου δεν υπάρχει. */
async function writeBrandLogoPointer(
  companyId: string, next: CompanyBrandLogo | null, actor: ResolvedPerformer,
): Promise<{ readonly written: boolean; readonly previous: CompanyBrandLogo | null }> {
  const ref = companyRef(companyId);
  return getAdminFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { written: false, previous: null };
    transaction.update(ref, {
      brandLogo: next,
      logoURL: next === null ? FieldValue.delete() : buildProxyUrl(next.storagePath),
      updatedAt: FieldValue.serverTimestamp(),
      ...performerStamp(actor),
    });
    return { written: true, previous: brandLogoOf(snapshot.data()) };
  });
}

/** **Ορισμός λογοτύπου.** Ίδια bytes με το τρέχον ⇒ το τρέχον, χωρίς νέα εγγραφή. */
export async function setCompanyBrandLogo(
  companyId: string, input: Buffer, performer: AuditPerformer,
): Promise<SetBrandLogoOutcome> {
  const normalized = await normalizeBrandLogo(input);
  if (normalized.kind === 'refused') return normalized;

  const current = await companyRef(companyId).get();
  if (!current.exists) return { kind: 'absent' };
  const existing = brandLogoOf(current.data());
  if (existing !== null && existing.sha256 === normalized.logo.sha256) return { kind: 'set', brandLogo: existing };

  const actor = await resolvePerformer(performer);
  const brandLogo = await storeNewBrandLogo(companyId, normalized.logo, performerId(performer));
  const { written, previous } = await writeBrandLogoPointer(companyId, brandLogo, actor);
  if (!written) return { kind: 'absent' };
  await recordBrandLogoChange(companyId, previous, brandLogo, actor);
  logger.info('Brand logo set', { companyId, fileId: brandLogo.fileId, contentType: brandLogo.contentType });
  return { kind: 'set', brandLogo };
}

/** **Αφαίρεση λογοτύπου** — μόνο ο δείκτης· τα bytes μένουν για τα παγωμένα παραστατικά. */
export async function clearCompanyBrandLogo(companyId: string, performer: AuditPerformer): Promise<ClearBrandLogoOutcome> {
  const actor = await resolvePerformer(performer);
  const { written, previous } = await writeBrandLogoPointer(companyId, null, actor);
  if (!written) return { kind: 'absent' };
  if (previous !== null) await recordBrandLogoChange(companyId, previous, null, actor);
  return { kind: 'cleared' };
}
