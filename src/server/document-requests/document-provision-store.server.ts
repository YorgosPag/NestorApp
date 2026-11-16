/**
 * =============================================================================
 * Τα δοσίματα μιας υπόθεσης — η ΜΙΑ συλλογή, ο ΕΝΑΣ αναγνώστης, ο ΕΝΑΣ γραφέας (ADR-942 Φ2)
 * =============================================================================
 *
 * 🔑 **Ιδεμποτικό**: ντετερμινιστική ταυτότητα (υπόθεση, στοιχείο, αρχείο) + συναλλαγή «διάβασε → κρίνε → γράψε». Δεύτερο
 *    δόσιμο του ίδιου αρχείου ⇒ `already-given`, καμία δεύτερη εγγραφή, κανένα δεύτερο ίχνος.
 * 🔑 **Ανάκληση = σημάδι**, ποτέ διαγραφή (ADR-787 Ε-2 §4). Ξένος μισθωτής ή άλλη υπόθεση ⇒ `not-found`.
 * 🔑 Ερώτημα **μόνο ισότητες** με `companyId` πρώτο (CHECK 3.35) ⇒ κανένας σύνθετος δείκτης (CHECK 3.91).
 * ⛔ Ο γραφέας **δεν** κρίνει αν το αρχείο επιτρέπεται να δοθεί: αυτό το κάνει ο προσαρμογέας του είδους **πριν** τον καλέσει.
 *
 * @module server/document-requests/document-provision-store.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { documentProvisionSeed, isLiveProvision, parseDocumentProvision } from '@/lib/document-requests/document-provision-schema';
import { createModuleLogger } from '@/lib/telemetry';
import { generateDeterministicDocumentRequestProvisionId } from '@/services/enterprise-id.service';
import type { DocumentProvisionRoute, DocumentRequestSubject, StoredDocumentProvision } from '@/types/document-request';

const logger = createModuleLogger('document-provision-store');

function provisionsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.DOCUMENT_REQUEST_PROVISIONS);
}

/** Ποια υπόθεση, σε ποιον μισθωτή. */
export interface ProvisionScope {
  readonly companyId: string;
  readonly subject: DocumentRequestSubject;
}

function sameScope(provision: StoredDocumentProvision, scope: ProvisionScope): boolean {
  return provision.companyId === scope.companyId
    && provision.subject.kind === scope.subject.kind
    && provision.subject.id === scope.subject.id;
}

/** Όλα τα δοσίματα της υπόθεσης (και τα ανακλημένα), ή `null` αν η ανάγνωση απέτυχε («δεν ξέρω» ≠ «κανένα»). */
export async function readSubjectProvisions(db: Firestore, scope: ProvisionScope): Promise<StoredDocumentProvision[] | null> {
  try {
    const snapshot = await provisionsCollection(db)
      .where('companyId', '==', scope.companyId)
      .where('subject.kind', '==', scope.subject.kind)
      .where('subject.id', '==', scope.subject.id)
      .get();
    return snapshot.docs.flatMap((doc) => {
      const parsed = parseDocumentProvision(doc.data());
      if (!parsed) logger.warn('Μη αναγνώσιμο δόσιμο — παραλείφθηκε (καμία πρόσβαση)', { provisionId: doc.id });
      return parsed && sameScope(parsed, scope) ? [parsed] : [];
    });
  } catch (error) {
    logger.error('Τα δοσίματα δεν διαβάστηκαν', {
      subjectKind: scope.subject.kind,
      subjectId: scope.subject.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface GiveDocumentInput extends ProvisionScope {
  readonly itemId: string;
  readonly fileId: string;
  readonly via: DocumentProvisionRoute;
  readonly byUid: string;
  readonly nowIso: string;
}

export type GiveDocumentOutcome = { readonly outcome: 'given' | 'already-given'; readonly provision: StoredDocumentProvision };

/** Δώσε το αρχείο για το στοιχείο — ή επιβεβαίωσε ότι **ήδη** δόθηκε. Μετά από ανάκληση, ξαναδίνεται στο ίδιο έγγραφο. */
export function giveDocument(db: Firestore, input: GiveDocumentInput): Promise<GiveDocumentOutcome> {
  const id = generateDeterministicDocumentRequestProvisionId(documentProvisionSeed(input.subject, input.itemId, input.fileId));
  const ref = provisionsCollection(db).doc(id);
  return db.runTransaction(async (tx) => {
    const known = parseDocumentProvision((await tx.get(ref)).data());
    if (known && sameScope(known, input) && isLiveProvision(known)) return { outcome: 'already-given' as const, provision: known };
    const provision: StoredDocumentProvision = {
      id,
      companyId: input.companyId,
      subject: { kind: input.subject.kind, id: input.subject.id },
      itemId: input.itemId,
      fileId: input.fileId,
      via: input.via,
      givenBy: input.byUid,
      givenAt: input.nowIso,
      revokedAt: null,
      revokedBy: null,
    };
    tx.set(ref, provision);
    return { outcome: 'given' as const, provision };
  });
}

export interface RevokeProvisionInput extends ProvisionScope {
  readonly provisionId: string;
  readonly byUid: string;
  readonly nowIso: string;
}

export type RevokeProvisionOutcome =
  | { readonly outcome: 'revoked' | 'already-revoked'; readonly provision: StoredDocumentProvision }
  | { readonly outcome: 'not-found' };

/** Ανάκληση από τον κάτοχο — σημάδι με ποιος/πότε· από εκείνη τη στιγμή το αρχείο **δεν** ανοίγει. */
export function revokeProvision(db: Firestore, input: RevokeProvisionInput): Promise<RevokeProvisionOutcome> {
  const ref = provisionsCollection(db).doc(input.provisionId);
  return db.runTransaction(async (tx) => {
    const known = parseDocumentProvision((await tx.get(ref)).data());
    if (!known || !sameScope(known, input)) return { outcome: 'not-found' as const };
    if (!isLiveProvision(known)) return { outcome: 'already-revoked' as const, provision: known };
    const provision: StoredDocumentProvision = { ...known, revokedAt: input.nowIso, revokedBy: input.byUid };
    tx.update(ref, { revokedAt: input.nowIso, revokedBy: input.byUid });
    return { outcome: 'revoked' as const, provision };
  });
}
