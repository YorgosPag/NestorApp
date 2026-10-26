import 'server-only';

/**
 * @fileoverview **ΟΙ ΦΑΚΕΛΟΙ-ΠΡΟΟΡΙΣΜΟΙ ΤΗΣ ΠΑΡΑΔΟΣΗΣ** — ο κύριος (γεννήθηκε στην αποδοχή) και ένας ανά παρακολούθημα
 * (ADR-916 Φ-Γ1 · Δ4).
 * @related lib/property-handover/property-handover-id.ts (`handoverDossierIdOf`) ·
 *          services/property-dossier/property-dossier-write.service.ts (η ΜΙΑ γέννηση φακέλου)
 * @module server/property-handover-delivery/handover-delivery-dossiers.server
 *
 * 🔑 **Γιατί χωριστός φάκελος ανά παρακολούθημα** (Δ4): η θέση στάθμευσης και η αποθήκη έχουν **δικό** τους ΚΑΕΚ και
 *    μεταπωλούνται **χωριστά** — ο αγοραστής που πουλά αργότερα μόνο την αποθήκη παραδίδει μόνο τον φάκελό της (Φ4).
 * 🔑 **Ντετερμινιστική ταυτότητα** ⇒ δύο εκτελέσεις (cron + αίτημα) βρίσκουν τον **ίδιο** φάκελο· η γέννηση περνά από
 *    το `stagePropertyDossierForListing` (ίδιος κώδικας με την αποδοχή — καμία δεύτερη γέννηση φακέλου).
 * ⛔ Φάκελος που **δεν** ανήκει πια στον αγοραστή (άλλαξε χέρια — Φ4) ⇒ **κανένα** αρχείο εκεί: η θεματοφυλακή κρίνει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PropertyTypeCanonical } from '@/constants/property-types';
import { spaceDisplayNameOf } from '@/lib/building-spaces/building-space-membership';
import { nowISO } from '@/lib/date-local';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import { handoverDossierIdOf } from '@/lib/property-handover/property-handover-id';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import { SPACE_COLLECTION_OF } from '@/services/building-spaces/building-space-admin-reader';
import { recordPropertyDossierWrite } from '@/services/property-dossier/property-dossier-audit';
import { stagePropertyDossierForListing } from '@/services/property-dossier/property-dossier-write.service';
import type { ConveyanceAppurtenanceRef, ConveyanceCaseSubject } from '@/types/conveyance-case';
import { propertyDossierLabelFrom, type PropertyDossier } from '@/types/property-dossier';
import type { PropertyHandover, PropertyHandoverRecipient } from '@/types/property-handover';

/** Το «ποιανού είναι το αρχείο» → ο φάκελος όπου πάει το αντίγραφο. */
export const handoverEntityKey = (entityType: string, entityId: string): string => `${entityType}:${entityId}`;

export interface HandoverDossierTargets {
  /** `entityType:entityId` → φάκελος. Οντότητα **χωρίς** γραμμή ⇒ τα αρχεία της περιμένουν (ξένος φάκελος). */
  readonly byEntity: ReadonlyMap<string, string>;
  /** Ο κύριος φάκελος, όπως είναι — η προέλευσή του (εκδότης) σφραγίζει και τα αντίγραφα. */
  readonly main: PropertyDossier;
}

/** Το είδος χώρου του παρακολουθήματος — η μία αντιστοίχιση προς το λεξιλόγιο των χώρων κτιρίου. */
const SPACE_KIND_OF: Readonly<Record<ConveyanceAppurtenanceRef['entityType'], 'parking' | 'storage'>> = {
  parking_spot: 'parking',
  storage: 'storage',
};

/** Ο τύπος του φακέλου — η αποθήκη **έχει** δικό της τύπο ακινήτου· η θέση στάθμευσης όχι (καμία εφεύρεση). */
const DOSSIER_TYPE_OF: Readonly<Record<ConveyanceAppurtenanceRef['entityType'], PropertyTypeCanonical | null>> = {
  parking_spot: null,
  storage: 'storage',
};

async function readMainDossier(adminDb: AdminFirestore, recipient: PropertyHandoverRecipient): Promise<PropertyDossier> {
  const data = (await adminDb.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(recipient.dossierId).get()).data();
  const dossier = isOwnedByCustody(data, { userId: recipient.userId }) ? propertyDossierFromDocument(data, recipient.dossierId) : null;
  if (dossier === null) throw new Error(`Dossier ${recipient.dossierId} no longer belongs to the recipient`);
  return dossier;
}

/** Το όνομα του χώρου (αριθμός θέσης · όνομα αποθήκης) — δεδομένα, ποτέ κείμενο του κώδικα· εφεδρεία ο κωδικός του. */
export async function appurtenanceLabelOf(adminDb: AdminFirestore, appurtenance: ConveyanceAppurtenanceRef): Promise<string> {
  const kind = SPACE_KIND_OF[appurtenance.entityType];
  const data = (await adminDb.collection(SPACE_COLLECTION_OF[kind]).doc(appurtenance.entityId).get()).data() ?? {};
  return propertyDossierLabelFrom(spaceDisplayNameOf({ id: appurtenance.entityId, kind, data }) ?? '') || appurtenance.entityId;
}

/** Ο φάκελος ενός παρακολουθήματος — γέννηση (με ίχνος) ή ο υπάρχων· `null` ⇒ ξένος. */
async function ensureAppurtenanceDossier(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  main: PropertyDossier,
  appurtenance: ConveyanceAppurtenanceRef,
): Promise<string | null> {
  const id = handoverDossierIdOf(handover.id, appurtenance);
  const label = await appurtenanceLabelOf(adminDb, appurtenance);
  const origin = main.origin === null ? null : { ...main.origin, fileDelivery: null, protocol: null, appurtenanceOf: main.id };
  const staged = await adminDb.runTransaction((tx) => stagePropertyDossierForListing(
    tx, adminDb, { id, userId: main.userId }, { label, type: DOSSIER_TYPE_OF[appurtenance.entityType] }, nowISO(), origin,
  ));
  if (staged.kind === 'foreign') return null;
  if (staged.kind === 'born') await recordPropertyDossierWrite(staged.dossier, { performedBy: 'system', before: null });
  return staged.dossier.id;
}

/** **Οι προορισμοί** — ο κύριος φάκελος για το ακίνητο, ένας ανά παρακολούθημα. Πετά μόνο αν ο κύριος δεν είναι πια του αγοραστή. */
export async function ensureHandoverDossiers(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  recipient: PropertyHandoverRecipient,
  subject: ConveyanceCaseSubject,
): Promise<HandoverDossierTargets> {
  const main = await readMainDossier(adminDb, recipient);
  const byEntity = new Map([[handoverEntityKey(ENTITY_TYPES.PROPERTY, subject.propertyId), main.id]]);
  // Φ-Γ3 (Ο2) — τα κοινά του κτιρίου/έργου πάνε στον **κύριο** φάκελο: το κτίριο δεν έχει δικό του ΚΑΕΚ, ο αγοραστής
  // κατέχει ιδανικά μερίδια μέσω της μονάδας του (το `sourceScope` του αντιγράφου λέει από πού ήρθε).
  if (subject.buildingId) byEntity.set(handoverEntityKey(ENTITY_TYPES.BUILDING, subject.buildingId), main.id);
  if (subject.projectId) byEntity.set(handoverEntityKey(ENTITY_TYPES.PROJECT, subject.projectId), main.id);
  for (const appurtenance of subject.appurtenances) {
    const dossierId = await ensureAppurtenanceDossier(adminDb, handover, main, appurtenance);
    if (dossierId !== null) byEntity.set(handoverEntityKey(appurtenance.entityType, appurtenance.entityId), dossierId);
  }
  return { byEntity, main };
}
