import 'server-only';

/**
 * **Ο ΕΝΑΣ γραφέας της σχέσης προμήθειας** (ADR-923 §5.12 Σ1 · CHECK 3.106).
 *
 * 🔴 **Γιατί δεν είναι είδος της μηχανής καταλόγου.** Η μηχανή δένει κάθε εγγραφή στο `ctx.companyId` του δρώντα, και
 * η αποδοχή την κάνει χρήστης **άλλου** χώρου. Με πλαστό `AuthContext` κάθε έλεγχος ιδιοκτησίας θα έλεγε ψέματα, με
 * δεύτερο «scope» η μηχανή θα αποκτούσε πόρτα γραφής σε ξένο χώρο. Η λύση είναι ο **δρόμος που δεν το χρειάζεται**:
 * - η σχέση είναι έγγραφο **δύο** πλευρών και ζει εδώ, με CAS, ίχνος και σήμα όπως η μηχανή·
 * - ο **κατάλογος γράφεται μόνο από τον ιδιοκτήτη του**: η προέγκριση ομάδας γράφεται στην **έκδοση** της πρόσκλησης
 *   και στην **έγκριση** του αιτήματος, πράξεις του προμηθευτή μέσα σε `runCatalogTransaction`. Η αποδοχή του
 *   αγοραστή δεν αγγίζει καμία συλλογή `catalog_*`.
 *
 * Το έγγραφο είναι **κοινό** στις δύο πλευρές, άρα ίχνος και σήμα γράφονται και στα **δύο** βιβλία.
 * @module server/supply-relationships/supply-relationship-store.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { SUPPLY_RELATIONSHIP_TRACKED_FIELDS } from '@/config/audit-tracked-fields-catalog';
import { COLLECTIONS } from '@/config/firestore-collections';
import { signalPricingViewsInTx } from '@/server/catalog/pricing-view-signal.server';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { generateDeterministicSupplyRelationshipId } from '@/services/enterprise-id.service';
import { revisionAfterWrite } from '@/subapps/catalog/aggregate/aggregate-members';
import type { SupplyRelationshipDraft } from '@/subapps/catalog/pricing/supply-relationship-judge';
import { supplyRelationshipFromDocument } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyRelationship, SupplyRelationshipEnds } from '@/subapps/catalog/types/supply-relationship';

/** Αρκούν δύο: η μοναδικότητα επαφής → σχέση είναι αναλλοίωτη, το δεύτερο έγγραφο υπάρχει μόνο για να τη διαψεύσει. */
const CONTACT_SCAN_LIMIT = 2;

const relationships = (db: Firestore) => db.collection(COLLECTIONS.SUPPLY_RELATIONSHIPS);

export function supplyRelationshipId(ends: SupplyRelationshipEnds): string {
  return generateDeterministicSupplyRelationshipId(ends.supplierCompanyId, ends.buyerCompanyId);
}

/** Η σχέση του ζεύγους, μέσα στη συναλλαγή. Απούσα ή αδιάβαστη ⇒ `null`. */
export async function readSupplyRelationshipInTx(tx: Transaction, db: Firestore, id: string): Promise<SupplyRelationship | null> {
  return supplyRelationshipFromDocument((await tx.get(relationships(db).doc(id))).data());
}

/**
 * Η σχέση **του αγοραστή** με αυτό το id, ή `null` (ξένη ≡ ανύπαρκτη). Εκτός συναλλαγής: μόνο για να μάθουμε **ποιον** κατάλογο
 * θα ανοίξουμε· η ενεργότητα ξαναρωτιέται μέσα στη συναλλαγή της ανάγνωσης (`readActiveSupplyRelationshipInTx`), ώστε η
 * ανάκληση να κερδίζει κάθε αγώνα. Κοινή για κάθε πόρτα αγοραστή (τιμή · αναζήτηση · εκδόσεις καταλόγου).
 */
export async function readBuyerRelationship(db: Firestore, buyerCompanyId: string, relationshipId: string): Promise<SupplyRelationship | null> {
  const relationship = supplyRelationshipFromDocument((await relationships(db).doc(relationshipId).get()).data());
  return relationship?.buyerCompanyId === buyerCompanyId ? relationship : null;
}

/** Σ4 · Σ5: η **μία** ερώτηση «υπάρχει ενεργή σχέση ανάμεσα σε αυτούς τους δύο;». */
export async function readActiveSupplyRelationshipInTx(tx: Transaction, db: Firestore, ends: SupplyRelationshipEnds): Promise<SupplyRelationship | null> {
  const relationship = await readSupplyRelationshipInTx(tx, db, supplyRelationshipId(ends));
  const matches = relationship?.state === 'active'
    && relationship.companyId === ends.supplierCompanyId
    && relationship.buyerCompanyId === ends.buyerCompanyId;
  return matches ? relationship : null;
}

/** Οι ενεργές σχέσεις που κρατούν αυτή την επαφή του προμηθευτή. Μόνο ισότητες ⇒ κανένας σύνθετος δείκτης. */
async function readActiveRelationshipsOfContactInTx(tx: Transaction, db: Firestore, supplierCompanyId: string, contactId: string): Promise<readonly SupplyRelationship[]> {
  const snap = await tx.get(
    relationships(db)
      .where('companyId', '==', supplierCompanyId)
      .where('supplierContactId', '==', contactId)
      .where('state', '==', 'active')
      .limit(CONTACT_SCAN_LIMIT),
  );
  return snap.docs.flatMap((doc) => supplyRelationshipFromDocument(doc.data()) ?? []);
}

/**
 * Η **μία** σχέση πίσω από μια επαφή. ⚠️ Δύο ενεργές για την ίδια επαφή είναι παραβίαση αναλλοίωτης: δεν διαλέγουμε,
 * απαντά σαν να μην υπάρχει καμία, και ο θεατής κρίνεται μόνο με την επαφή.
 */
export async function readActiveRelationshipOfContactInTx(tx: Transaction, db: Firestore, supplierCompanyId: string, contactId: string): Promise<SupplyRelationship | null> {
  const found = await readActiveRelationshipsOfContactInTx(tx, db, supplierCompanyId, contactId);
  return found.length === 1 ? found[0] : null;
}

/**
 * Η αναλλοίωτη «μία επαφή ⇒ το πολύ ένας αγοραστής», μέσα στη συναλλαγή της πράξης. `buyerCompanyId === null` στην
 * έκδοση πρόσκλησης, όπου ο αγοραστής δεν είναι ακόμη γνωστός: οποιαδήποτε ενεργή σχέση κρατά την επαφή.
 * Τον αγώνα δύο αποδοχών τον κλείνει το supersede: για μία επαφή ζει το πολύ μία πρόσκληση.
 */
export async function isContactHeldElsewhereInTx(
  tx: Transaction,
  db: Firestore,
  input: { readonly supplierCompanyId: string; readonly contactId: string; readonly buyerCompanyId: string | null },
): Promise<boolean> {
  const found = await readActiveRelationshipsOfContactInTx(tx, db, input.supplierCompanyId, input.contactId);
  return found.some((relationship) => relationship.buyerCompanyId !== input.buyerCompanyId);
}

/** Μία σκηνοθετημένη αλλαγή: ό,τι χρειάζεται το ίχνος μετά το commit. */
export interface StagedSupplyChange {
  readonly before: SupplyRelationship | null;
  readonly after: SupplyRelationship;
}

/** Γράφει τη σχέση και σηματοδοτεί **και τις δύο** όψεις. Μετά από όλες τις αναγνώσεις της συναλλαγής. */
export function stageSupplyRelationship(
  tx: Transaction,
  db: Firestore,
  input: { readonly before: SupplyRelationship | null; readonly next: SupplyRelationshipDraft; readonly uid: string; readonly now: string },
): StagedSupplyChange {
  const { before, next, uid, now } = input;
  const id = supplyRelationshipId({ supplierCompanyId: next.companyId, buyerCompanyId: next.buyerCompanyId });
  const after: SupplyRelationship = {
    ...next,
    id,
    revision: revisionAfterWrite(before?.revision ?? 0),
    createdAt: before?.createdAt ?? now,
    updatedAt: now,
    updatedBy: uid,
  };
  tx.set(relationships(db).doc(id), after);
  for (const companyId of [after.companyId, after.buyerCompanyId]) signalPricingViewsInTx(tx, db, companyId, [{ kind: 'supply' }]);
  return { before, after };
}

/** Το ίχνος στα **δύο** βιβλία: η σχέση ανήκει και στους δύο. Μετά το commit, δεν ακυρώνει ποτέ την πράξη. */
export async function recordSupplyRelationshipChange(change: StagedSupplyChange, performedBy: string): Promise<void> {
  const { before, after } = change;
  await Promise.all([after.companyId, after.buyerCompanyId].map((companyId) => recordTrackedEntityWrite({
    entityType: 'supply_relationship',
    entityId: after.id,
    entityName: after.customerRef,
    trackedFields: SUPPLY_RELATIONSHIP_TRACKED_FIELDS,
    before: before === null ? null : { ...before },
    after: { ...after },
    performedBy,
    ledger: { companyId },
  })));
}
