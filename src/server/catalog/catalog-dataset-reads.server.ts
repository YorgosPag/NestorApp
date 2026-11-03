import 'server-only';

/**
 * Ο **κατάλογος ενός χώρου ολόκληρος**, σε μία συναλλαγή (ADR-923 §5.6 · §5.14.1): κατηγορίες · οικογένειες · ιδιότητες ·
 * μοντέλα · SKU · μητρώο μονάδων. Ο ένας αναγνώστης για όσους χρειάζονται όλο το σύνολο: τον εκδότη
 * (`publication-snapshot.server.ts`) και την εξαγωγή xChange (`xchange-export.server.ts`). Ως τις 2026-11-03 ήταν δύο
 * δίδυμα με τις ίδιες πέντε ερωτήσεις.
 *
 * ⚠️ Κάθε ερώτημα γράφεται ολόκληρο, με ρητό `COLLECTIONS.X` και τα `where` στην ίδια αλυσίδα: η πύλη δεικτών του Admin SDK
 *    (CHECK 3.91) θεωρεί «μη αναλύσιμη» τη συλλογή που περνά ως μεταβλητή. Όλα είναι ισότητες σε `companyId` + `isDeleted`,
 *    άρα δεν χρειάζονται σύνθετο δείκτη.
 * @module server/catalog/catalog-dataset-reads.server
 */

import type { Query } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { StoredCategory, StoredFamily, StoredModel, StoredProduct } from '@/subapps/catalog/publishing/publication-chapters';
import type { StoredCatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { readMeasurementRegistry } from './catalog-library-reads.server';
import type { CatalogReadScope, StoredCatalogRecord } from './catalog-store.server';

export interface CatalogDataSet {
  readonly categories: readonly StoredCategory[];
  readonly families: readonly StoredFamily[];
  readonly attributes: readonly StoredCatalogRecord<StoredCatalogAttributeDefinition>[];
  readonly models: readonly StoredModel[];
  readonly products: readonly StoredProduct[];
  readonly registry: MeasurementRegistry;
}

async function readAll<T>(scope: CatalogReadScope, query: Query): Promise<T[]> {
  return (await scope.tx.get(query)).docs.map((doc) => doc.data() as T);
}

/** Οι ενεργές εγγραφές του χώρου. Ξένο και διαγραμμένο δεν διαβάζονται καν. */
export async function readCatalogDataSet(scope: CatalogReadScope): Promise<CatalogDataSet> {
  const { db } = scope;
  const { companyId } = scope.ctx;
  const [categories, families, attributes, models, products, registry] = await Promise.all([
    readAll<StoredCategory>(scope, db.collection(COLLECTIONS.CATALOG_CATEGORIES).where('companyId', '==', companyId).where('isDeleted', '==', false)),
    readAll<StoredFamily>(scope, db.collection(COLLECTIONS.CATALOG_FAMILIES).where('companyId', '==', companyId).where('isDeleted', '==', false)),
    readAll<StoredCatalogRecord<StoredCatalogAttributeDefinition>>(scope, db.collection(COLLECTIONS.CATALOG_ATTRIBUTES).where('companyId', '==', companyId).where('isDeleted', '==', false)),
    readAll<StoredModel>(scope, db.collection(COLLECTIONS.CATALOG_PRODUCT_MODELS).where('companyId', '==', companyId).where('isDeleted', '==', false)),
    readAll<StoredProduct>(scope, db.collection(COLLECTIONS.CATALOG_PRODUCTS).where('companyId', '==', companyId).where('isDeleted', '==', false)),
    readMeasurementRegistry(scope),
  ]);
  return { categories, families, attributes, models, products, registry };
}
