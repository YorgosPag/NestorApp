import 'server-only';

/**
 * Οι αναγνώσεις εκδόσεων και γραμμών τιμοκαταλόγου (ADR-923 §5.11 «3β») — **ένα** σημείο για γραφείς, δημοσίευση και
 * επιλυτή, ώστε όλοι να ρωτούν **το ίδιο** ερώτημα με **τον ίδιο** δείκτη.
 *
 * - Οι εκδόσεις μιας λίστας είναι λίγες (δεκάδες): διαβάζονται όλες, μέσα στη συναλλαγή όταν κρίνουν
 *   (αριθμός νέας έκδοσης · σειρά δημοσίευσης), ώστε η απόφαση να μην αλλάζει ανάμεσα στον έλεγχο και στην εγγραφή.
 * - Οι γραμμές μιας έκδοσης μπορεί να είναι χιλιάδες: διαβάζονται **σε σελίδες** με δρομέα το id εγγράφου.
 *
 * ⚠️ Ρητό `COLLECTIONS.X` σε κάθε ερώτημα (CHECK 3.91)· οι δείκτες στο `firestore.indexes.json`.
 * @module server/catalog/price-version-reads.server
 */

import { FieldPath, type Firestore, type Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PriceVersionRef } from '@/subapps/catalog/pricing/version-timeline';
import { PRICE_LINES_PER_TRANSACTION } from '@/subapps/catalog/vocabulary/pricing';
import type { CatalogTx } from './catalog-store.server';
import type { StoredPriceLine, StoredPriceVersion } from './price-version-aggregate.server';

/** Ανώτατο πλήθος εκδόσεων ανά λίστα που διαβάζει μια κρίση — πολύ πάνω από κάθε ρεαλιστικό ιστορικό. */
const VERSIONS_PER_LIST_LIMIT = 500;

function versionsQuery(db: Firestore, companyId: string, priceListId: string): Query {
  return db
    .collection(COLLECTIONS.CATALOG_PRICE_LIST_VERSIONS)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('priceListId', '==', priceListId)
    .orderBy('number')
    .limit(VERSIONS_PER_LIST_LIMIT);
}

/** Όλες οι ενεργές εκδόσεις της λίστας, **μέσα** στη συναλλαγή. */
export async function readListVersions(scope: CatalogTx, priceListId: string): Promise<StoredPriceVersion[]> {
  const snap = await scope.tx.get(versionsQuery(scope.db, scope.ctx.companyId, priceListId));
  return snap.docs.map((doc) => doc.data() as StoredPriceVersion);
}

/** Οι ίδιες, **εκτός** συναλλαγής (επιλυτής · προεπισκόπηση). */
export async function readListVersionsSnapshot(db: Firestore, companyId: string, priceListId: string): Promise<StoredPriceVersion[]> {
  const snap = await versionsQuery(db, companyId, priceListId).get();
  return snap.docs.map((doc) => doc.data() as StoredPriceVersion);
}

/** Η μορφή που ζητούν χρονογραμμή και κρίση δημοσίευσης. */
export function versionRefOf(version: StoredPriceVersion): PriceVersionRef {
  return { id: version.id, number: version.number, status: version.status, validFrom: version.validFrom };
}

/**
 * **Μία** σελίδα ενεργών γραμμών μιας έκδοσης μετά τον δρομέα — το ένα ερώτημα για ανάγνωση **και** σπορά.
 * 🔑 Ταξινόμηση **κατά id εγγράφου** (ιδίωμα του `completeness-recompute`): ο δρομέας είναι **θέση** (id), όχι τιμή
 * πεδίου — σταθερός ακόμη κι αν σβηστεί η γραμμή στην οποία δείχνει, και χωρίς δεύτερο πεδίο ταξινόμησης στον δείκτη.
 * Η **σειρά περιεχομένου** (για το hash) δεν εξαρτάται από εδώ: την ορίζει ρητά ο σφραγιστής (κλειδί υποκειμένου).
 */
export function versionLinesPage(db: Firestore, companyId: string, versionId: string, cursor: string | null): Query {
  const query = db
    .collection(COLLECTIONS.CATALOG_PRICE_LIST_LINES)
    .where('companyId', '==', companyId)
    .where('isDeleted', '==', false)
    .where('versionId', '==', versionId)
    .orderBy(FieldPath.documentId());
  return (cursor === null ? query : query.startAfter(cursor)).limit(PRICE_LINES_PER_TRANSACTION);
}

/**
 * **Όλες** οι ενεργές γραμμές μιας έκδοσης, σε σελίδες (σειρά: id εγγράφου) — εκτός συναλλαγής. Για
 * δημοσιευμένη έκδοση το αποτέλεσμα είναι σταθερό (αμετάβλητη)· για πρόχειρη το φρουρεί το CAS του `linesRevision`.
 */
export async function readVersionLines(db: Firestore, companyId: string, versionId: string): Promise<StoredPriceLine[]> {
  const lines: StoredPriceLine[] = [];
  let cursor: string | null = null;
  for (;;) {
    const snap = await versionLinesPage(db, companyId, versionId, cursor).get();
    const page = snap.docs.map((doc) => doc.data() as StoredPriceLine);
    lines.push(...page);
    if (page.length < PRICE_LINES_PER_TRANSACTION) return lines;
    cursor = page[page.length - 1].id;
  }
}
