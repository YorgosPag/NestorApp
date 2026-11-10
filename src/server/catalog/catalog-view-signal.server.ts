import 'server-only';

/**
 * **Ο ΕΝΑΣ γραφέας των σημάτων όψεων καταλόγου** (ADR-923 §5.11 «3δ» Ζ · §5.5.2 · ADR-905 §4.2).
 *
 * Οι όψεις (τιμές · προμήθεια · παρτίδα εισαγωγής) διαβάζονται **μόνο** από τον διακομιστή· η οθόνη ακούει **ένα**
 * έγγραφο-αριθμό ανά όψη και ξαναρωτά όταν ο αριθμός ξεπεράσει την αναθεώρηση που ήδη έχει. Ο αριθμός γράφεται **μέσα
 * στη συναλλαγή** της αλλαγής (transactional outbox): αλλαγή χωρίς σήμα ή σήμα χωρίς αλλαγή είναι δομικά αδύνατα.
 *
 * 🔑 Ο **μόνος** καλών μέσα στον κατάλογο είναι η μηχανή (`runCatalogTransaction`): κάθε γραφή περνά από εκεί (CHECK 3.106),
 *    άρα κανένας γραφέας δεν μπορεί να «ξεχάσει» το σήμα. Εξαίρεση με λόγο: ο γραφέας της σχέσης προμήθειας (`supply`).
 * 🔒 Το έγγραφο κουβαλά **μόνο** `{ companyId, view, revision, changedAt }` — ποτέ τιμή, ποτέ περιεχόμενο.
 * ⚠️ Φυσικό όνομα συλλογής και γεννήτορα αμετάβλητα (`CATALOG_PRICING_VIEW_SIGNALS`): ίδια ids, μηδέν μετάπτωση.
 *
 * @module server/catalog/catalog-view-signal.server
 */

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogPricingViewSignalId } from '@/services/enterprise-id.service';
import { catalogViewKey, type CatalogView } from '@/subapps/catalog/views/catalog-view-key';

export function catalogViewSignalRef(db: Firestore, companyId: string, view: CatalogView): DocumentReference {
  const id = generateDeterministicCatalogPricingViewSignalId(companyId, catalogViewKey(view));
  return db.collection(COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS).doc(id);
}

/** Μία αύξηση ανά όψη — **μετά** από όλες τις αναγνώσεις της συναλλαγής (κανόνας Firestore). */
export function signalCatalogViewsInTx(tx: Transaction, db: Firestore, companyId: string, views: readonly CatalogView[]): void {
  for (const view of views) {
    tx.set(
      catalogViewSignalRef(db, companyId, view),
      { companyId, view: catalogViewKey(view), revision: FieldValue.increment(1), changedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}

/**
 * Η αναθεώρηση της όψης, διαβασμένη **μέσα** στη συναλλαγή ανάγνωσης της όψης: αριθμός και δεδομένα είναι το **ίδιο**
 * στιγμιότυπο, άρα η όψη είναι ακριβώς τόσο φρέσκια όσο ο αριθμός της (§4.3). Ανύπαρκτο σήμα ⇒ 0.
 */
export async function readCatalogViewRevisionInTx(tx: Transaction, db: Firestore, companyId: string, view: CatalogView): Promise<number> {
  const revision = (await tx.get(catalogViewSignalRef(db, companyId, view))).get('revision');
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : 0;
}
