import 'server-only';

/**
 * **Ο ΕΝΑΣ γραφέας των σημάτων όψεων τιμών** (ADR-923 §5.11 «3δ» Ζ · ADR-905 §4.2).
 *
 * Οι τιμές διαβάζονται **μόνο** από τον διακομιστή· η οθόνη ακούει **ένα** έγγραφο-αριθμό ανά όψη και ξαναρωτά όταν
 * ο αριθμός ξεπεράσει την αναθεώρηση που ήδη έχει. Ο αριθμός γράφεται **μέσα στη συναλλαγή** της αλλαγής (transactional
 * outbox): αλλαγή χωρίς σήμα ή σήμα χωρίς αλλαγή είναι δομικά αδύνατα.
 *
 * 🔑 Ο **μόνος** καλών είναι η μηχανή (`runCatalogTransaction`): κάθε γραφή τιμολόγησης περνά από εκεί (CHECK 3.106),
 *    άρα κανένας γραφέας δεν μπορεί να «ξεχάσει» το σήμα.
 * 🔒 Το έγγραφο κουβαλά **μόνο** `{ companyId, view, revision, changedAt }` — ποτέ τιμή.
 *
 * @module server/catalog/pricing-view-signal.server
 */

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogPricingViewSignalId } from '@/services/enterprise-id.service';
import { pricingViewKey, type PricingView } from '@/subapps/catalog/pricing/pricing-view-key';

export function pricingViewSignalRef(db: Firestore, companyId: string, view: PricingView): DocumentReference {
  const id = generateDeterministicCatalogPricingViewSignalId(companyId, pricingViewKey(view));
  return db.collection(COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS).doc(id);
}

/** Μία αύξηση ανά όψη — **μετά** από όλες τις αναγνώσεις της συναλλαγής (κανόνας Firestore). */
export function signalPricingViewsInTx(tx: Transaction, db: Firestore, companyId: string, views: readonly PricingView[]): void {
  for (const view of views) {
    tx.set(
      pricingViewSignalRef(db, companyId, view),
      { companyId, view: pricingViewKey(view), revision: FieldValue.increment(1), changedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}

/**
 * Η αναθεώρηση της όψης, διαβασμένη **μέσα** στη συναλλαγή ανάγνωσης της όψης: αριθμός και δεδομένα είναι το **ίδιο**
 * στιγμιότυπο, άρα η όψη είναι ακριβώς τόσο φρέσκια όσο ο αριθμός της (§4.3). Ανύπαρκτο σήμα ⇒ 0.
 */
export async function readPricingViewRevisionInTx(tx: Transaction, db: Firestore, companyId: string, view: PricingView): Promise<number> {
  const revision = (await tx.get(pricingViewSignalRef(db, companyId, view))).get('revision');
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : 0;
}
