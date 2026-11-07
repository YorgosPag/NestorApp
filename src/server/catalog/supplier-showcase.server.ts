/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΒΙΤΡΙΝΑΣ ΠΡΟΜΗΘΕΥΤΗ** (ADR-923 §5.13 Δ6).
 * @related server/catalog/supplier-review.server.ts (ο αναγνώστης της επιβεβαίωσης) ·
 *   services/company/company-rename.service.ts (οι δύο καλούντες της ανανέωσης)
 * @module server/catalog/supplier-showcase.server
 *
 * 🔑 **Η ανανέωση δεν δημιουργεί ποτέ βιτρίνα.** Αλλιώς κάθε εταιρεία με επαληθευμένο ΓΕΜΗ θα έβγαινε δημόσια χωρίς να
 * το ζητήσει. Δημιουργία μόνο με ρητή πράξη ({@link publishSupplierShowcase}).
 *
 * 🔑 **Βλάβη δεν αποσύρει.** Σε `unknown` η ανανέωση δεν αγγίζει τίποτα: ένα 5xx ή λείπον μυστικό δεν σβήνει βιτρίνα.
 * Απόσυρση μόνο σε βέβαιη απώλεια επιβεβαίωσης (§16: εξαφάνιση, όχι ένδειξη).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { supplierShowcaseFromDocument } from '@/subapps/catalog/public/supplier-showcase-from-document';
import type { SupplierShowcaseRecord } from '@/subapps/catalog/types/supplier-verification';
import { revalidatePublicCompany } from './public/public-model-revalidate.server';
import { PUBLIC_CATALOG_SCOPE, signalPublicScopesInTx } from './public/public-outbox.server';
import { LIVE_DEPS, readSupplierStandingOutcome, type SupplierReviewDeps } from './supplier-review.server';

const logger = createModuleLogger('server/catalog/supplier-showcase');

const showcaseRef = (db: AdminFirestore, companyId: string) => db.collection(COLLECTIONS.SUPPLIER_SHOWCASES).doc(companyId);

async function legalNameOf(companyId: string, deps: SupplierReviewDeps): Promise<string | null> {
  const profile = await deps.readProfile(companyId);
  return profile.kind === 'present' ? profile.declaration.businessName : null;
}

async function recordShowcaseChange(companyId: string, legalName: string | null, actorUid: string, published: boolean): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.SUPPLIER_VERIFICATION,
    entityId: companyId,
    entityName: legalName,
    action: 'status_changed',
    changes: [{ field: 'showcase', oldValue: !published, newValue: published }],
    performedBy: actorUid,
    performedByName: null,
    companyId,
  });
}

export type SupplierShowcasePublication =
  | { readonly kind: 'published' }
  | { readonly kind: 'refused'; readonly reason: 'unavailable' | 'not-verified' | 'no-legal-name' };

export async function publishSupplierShowcase(
  db: AdminFirestore,
  companyId: string,
  actorUid: string,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierShowcasePublication> {
  const read = await readSupplierStandingOutcome(db, companyId, deps);
  if (read.kind === 'unknown') return { kind: 'refused', reason: 'unavailable' };
  if (read.standing.kind !== 'verified') return { kind: 'refused', reason: 'not-verified' };
  const legalName = await legalNameOf(companyId, deps);
  if (legalName === null) return { kind: 'refused', reason: 'no-legal-name' };

  const nowIso = nowISO();
  const ref = showcaseRef(db, companyId);
  const { basis } = read.standing;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const publishedAt = supplierShowcaseFromDocument(snap.data(), companyId)?.publishedAt ?? nowIso;
    const record: SupplierShowcaseRecord = { companyId, legalName, basis, publishedAt, updatedAt: nowIso };
    tx.set(ref, record);
    // 🔑 Η δημοσίευση είναι η στιγμή που ανοίγει η βιτρίνα: εδώ ο χώρος μπαίνει στη σάρωση και ζητά πλήρες πέρασμα καταλόγου.
    //    Χωρίς αυτό, κατάλογος γραμμένος πριν από το outbox δεν προβαλλόταν ποτέ (μετρημένο ζωντανά 2026-11-07: outbox άδειο,
    //    σάρωση πράσινη χωρίς δουλειά). Το id είναι ντετερμινιστικό και η γραφή merge: ξαναδημοσίευση = ένα ακόμη πέρασμα.
    signalPublicScopesInTx(tx, db, companyId, [PUBLIC_CATALOG_SCOPE]);
  });
  revalidatePublicCompany(companyId);
  await recordShowcaseChange(companyId, legalName, actorUid, true);
  return { kind: 'published' };
}

export type SupplierShowcaseRefresh = 'not-published' | 'unknown' | 'current' | 'updated' | 'withdrawn' | 'failed';

async function applyRefresh(db: AdminFirestore, companyId: string, actorUid: string, deps: SupplierReviewDeps): Promise<SupplierShowcaseRefresh> {
  const ref = showcaseRef(db, companyId);
  const snap = await ref.get();
  if (!snap.exists) return 'not-published';
  const read = await readSupplierStandingOutcome(db, companyId, deps);
  if (read.kind === 'unknown') return 'unknown';
  const current = supplierShowcaseFromDocument(snap.data(), companyId);
  if (read.standing.kind !== 'verified') {
    await ref.delete();
    revalidatePublicCompany(companyId);
    await recordShowcaseChange(companyId, current?.legalName ?? null, actorUid, false);
    return 'withdrawn';
  }
  // Χαλασμένο έγγραφο κλείνει ήδη τη σελίδα. Το ξαναγράφει μόνο η ρητή δημοσίευση.
  if (current === null) return 'failed';
  const legalName = (await legalNameOf(companyId, deps)) ?? current.legalName;
  const { basis } = read.standing;
  if (legalName === current.legalName && basis === current.basis) return 'current';
  await ref.set({ ...current, legalName, basis, updatedAt: nowISO() });
  revalidatePublicCompany(companyId);
  return 'updated';
}

/**
 * Ξανακρίνει **υπάρχουσα** βιτρίνα. Δεν ρίχνει: τρέχει μέσα στη μετονομασία, που δεν πρέπει να αποτύχει εξαιτίας της.
 * Αν αποτύχει, τη διορθώνει η σάρωση του Σ3.
 */
export async function refreshSupplierShowcaseStanding(
  db: AdminFirestore,
  companyId: string,
  actorUid: string,
  deps: SupplierReviewDeps = LIVE_DEPS,
): Promise<SupplierShowcaseRefresh> {
  try {
    return await applyRefresh(db, companyId, actorUid, deps);
  } catch (error) {
    logger.warn('Η βιτρίνα προμηθευτή δεν ανανεώθηκε', { companyId, error: getErrorMessage(error) });
    return 'failed';
  }
}
