/**
 * @fileoverview **Η ΓΕΝΝΗΣΗ ΑΓΓΕΛΙΑΣ ΜΕ ΦΑΚΕΛΟ** — αγγελία + φάκελος σε **μία** συναλλαγή (ADR-866 Φ1.3 · Ε-Φ1-1).
 * @related ADR-866 §2.7.5 · §2.11 · services/property-dossier/property-dossier-write.service (ο γραφέας του φακέλου)
 * @module services/owner-property/owner-property-dossier-birth
 *
 * 🔑 **Δεν γράφει φάκελο μόνο του**: καλεί το `stagePropertyDossierForListing` του **γραφέα του φακέλου** — ο φάκελος
 * έχει **έναν** γραφέα (ADR-866 §2.8.3 Γ2). Εδώ ζει μόνο η **σειρά**: ανάγνωση φακέλου → (γέννηση) → `create` αγγελίας.
 *
 * ⚠️ **Η ταυτότητα της αγγελίας ΕΙΝΑΙ το κλειδί ιδεμποτίας** (ίδιο με πριν τη Φ1.3): δεύτερη αποστολή ⇒ το `create`
 * πετά ⇒ **ολόκληρη** η συναλλαγή ακυρώνεται ⇒ ούτε δεύτερος φάκελος, ούτε μισή αγγελία.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { recordPropertyDossierWrite } from '@/services/property-dossier/property-dossier-audit';
import {
  stagePropertyDossierForListing,
  type ListingDossierStaging,
} from '@/services/property-dossier/property-dossier-write.service';
import { propertyDossierLabelFrom } from '@/types/property-dossier';
import type { OwnerProperty } from '@/types/owner-property';

/**
 * **Γράφει αγγελία που δηλώνει φάκελο** — `null` = γράφτηκε· `'foreign'` = ο φάκελος ανήκει σε άλλον (ο καλών απαντά
 * `absent`). **Πετά** σε αποτυχία βάσης (ο καλών την ονομάζει, όπως το απλό `create`).
 *
 * 🔑 **Όνομα φακέλου = ο τίτλος της αγγελίας** (μετονομάζεται μετά)· **είδος = το είδος της αγγελίας** — αντιγραφή,
 * όχι μετάφραση (ίδιο λεξιλόγιο, ADR-866 §2.8.5). Φάκελος που **υπήρχε ήδη** κρατά το δικό του όνομα.
 */
export async function createOwnerPropertyWithDossier(
  adminDb: AdminFirestore,
  ref: DocumentReference,
  property: OwnerProperty & { readonly dossierId: string },
): Promise<'foreign' | null> {
  // 🔑 **Η ΙΔΙΑ στιγμή** στα δύο έγγραφα (`types/property-dossier.ts` → `newPropertyDossier`).
  const now = property.createdAt;
  const staging: ListingDossierStaging = await adminDb.runTransaction(async (tx) => {
    const staged = await stagePropertyDossierForListing(
      tx,
      adminDb,
      { id: property.dossierId, userId: property.authorUserId },
      { label: propertyDossierLabelFrom(property.title), type: property.type },
      now,
    );
    if (staged.kind !== 'foreign') tx.create(ref, property);
    return staged;
  });

  if (staging.kind === 'foreign') return 'foreign';
  // ⚠️ Ίχνος **μετά** το commit, ποτέ για γραφή που δεν έγινε (ADR-195) — και **μόνο** για φάκελο που **γεννήθηκε** τώρα.
  if (staging.kind === 'born') {
    await recordPropertyDossierWrite(staging.dossier, { performedBy: property.authorUserId, before: null });
  }
  return null;
}
