import 'server-only';

/**
 * =============================================================================
 * Η ΑΠΟΘΗΚΗ ΤΩΝ ΔΗΜΟΣΙΕΥΜΕΝΩΝ ΕΚΔΟΣΕΩΝ (ADR-923 §5.15) — διευθύνσεις και ερωτήματα, χωρίς κρίση
 * =============================================================================
 *
 * Ο **ένας** τόπος που ξέρει τη συλλογή `catalog_editions`: πώς λέγεται, πώς διαβάζεται ένα έγγραφο, ποια ερωτήματα υπάρχουν
 * (καθένα με τον δείκτη του στο `firestore.indexes.json`). Ο γραφέας (`catalog-edition-writer.server.ts`) και το σύνορο
 * ανάγνωσης (`catalog-edition-reads.server.ts`) τα ζητούν από εδώ· κανείς άλλος δεν αγγίζει τη συλλογή (CHECK 3.112).
 *
 * 🔑 Κάθε ερώτημα έχει `companyId` (CHECK 3.10 · 3.35): ο χώρος του προμηθευτή είναι πάντα ρητός.
 * 🔑 Όριο σε κάθε λίστα: ένα αρχείο εκδόσεων μεγαλώνει με τα χρόνια, η απάντηση όχι.
 * @module server/catalog/editions/catalog-edition-store.server
 */

import type { CollectionReference, DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { CatalogEditionDefinition, CatalogEditionStatus } from '@/subapps/catalog/types/catalog-edition';

export type StoredCatalogEdition = CatalogEditionDefinition & {
  readonly id: string;
  readonly companyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Όσες εκδόσεις φτάνουν σε μία απάντηση (ιδιοκτήτης ή θεατής). Μια βιτρίνα με περισσότερες ισχύουσες είναι λάθος δεδομένων. */
export const CATALOG_EDITION_LIST_LIMIT = 200;

/** Όσες ισχύουσες εκδόσεις μπορεί να έχει ένα ράφι (μία ανά κοινό)· το δίχτυ του `supersededBy` τις πιάνει όλες. */
const SHELF_LIMIT = 50;

/** Οι καταστάσεις που βλέπει θεατής: η αποσυρμένη δεν υπάρχει γι' αυτόν (Η3). */
const VIEWABLE_STATUSES: readonly CatalogEditionStatus[] = ['published', 'superseded'];

const editions = (db: Firestore): CollectionReference => db.collection(COLLECTIONS.CATALOG_EDITIONS);

export const catalogEditionRef = (db: Firestore, id: string): DocumentReference => editions(db).doc(id);

/** Ένα έγγραφο όπως διαβάστηκε· `undefined` ⇒ δεν υπάρχει. */
export function storedCatalogEditionOf(data: unknown): StoredCatalogEdition | undefined {
  return data ? (data as StoredCatalogEdition) : undefined;
}

const editionsOf = (docs: readonly { data(): unknown }[]): StoredCatalogEdition[] =>
  docs.flatMap((doc) => {
    const edition = storedCatalogEditionOf(doc.data());
    return edition ? [edition] : [];
  });

async function readQuery(tx: Transaction | null, query: Query): Promise<StoredCatalogEdition[]> {
  return editionsOf((tx ? await tx.get(query) : await query.get()).docs);
}

/**
 * Οι εκδόσεις ενός ραφιού σε μία κατάσταση, οι νεότερες πρώτες, μέσα σε συναλλαγή (δείκτης: companyId · shelfKey · status ·
 * publishedAt). `published` ⇒ οι ισχύουσες· `superseded` ⇒ οι προκάτοχοι που ξαναγίνονται ισχύουσες όταν αποσυρθεί η διάδοχος.
 */
export async function readShelfInTx(
  tx: Transaction,
  db: Firestore,
  shelf: { readonly companyId: string; readonly shelfKey: string; readonly status: Exclude<CatalogEditionStatus, 'withdrawn'> },
): Promise<StoredCatalogEdition[]> {
  const query = editions(db)
    .where('companyId', '==', shelf.companyId)
    .where('shelfKey', '==', shelf.shelfKey)
    .where('status', '==', shelf.status)
    .orderBy('publishedAt', 'desc')
    .limit(SHELF_LIMIT);
  return readQuery(tx, query);
}

/** Η εγγραφή μιας έκδοσης μέσα σε συναλλαγή. */
export async function readCatalogEditionInTx(tx: Transaction, db: Firestore, id: string): Promise<StoredCatalogEdition | null> {
  return storedCatalogEditionOf((await tx.get(catalogEditionRef(db, id))).data()) ?? null;
}

/** Όλες οι εκδόσεις του χώρου, οι νεότερες πρώτες — ό,τι βλέπει ο ιδιοκτήτης (δείκτης: companyId · publishedAt). */
export function readCompanyEditions(db: Firestore, companyId: string): Promise<StoredCatalogEdition[]> {
  const query = editions(db).where('companyId', '==', companyId).orderBy('publishedAt', 'desc').limit(CATALOG_EDITION_LIST_LIMIT);
  return readQuery(null, query);
}

/** Οι εκδόσεις που **μπορεί** να δει θεατής, μέσα στη συναλλαγή της κρίσης (δείκτης: companyId · status · publishedAt). */
export function readViewableEditionsInTx(tx: Transaction, db: Firestore, companyId: string): Promise<StoredCatalogEdition[]> {
  const query = editions(db)
    .where('companyId', '==', companyId)
    .where('status', 'in', VIEWABLE_STATUSES)
    .orderBy('publishedAt', 'desc')
    .limit(CATALOG_EDITION_LIST_LIMIT);
  return readQuery(tx, query);
}
