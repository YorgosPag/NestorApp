import 'server-only';

/**
 * Οι **αναγνώσεις της βιβλιοθήκης** μέσα στη συναλλαγή (ADR-923 §5.9) — «ποιος χρησιμοποιεί τι». Κάθε
 * ερώτημα φέρει `companyId` (CHECK 3.10/3.35) και `isDeleted == false`, και έχει δείκτη στο
 * `firestore.indexes.json` (CHECK 3.91). Διαβάζονται **μέσα** στη συναλλαγή, ώστε η απόφαση «επιτρέπεται;»
 * να μην αλλάξει ανάμεσα στον έλεγχο και την εγγραφή.
 * @module server/catalog/catalog-library-reads.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import {
  createMeasurementRegistryFromRecords,
  type MeasurementRegistry,
} from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import type { StoredCatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { WorkspaceMeasurementFamilyDefinition } from '@/subapps/catalog/types/measurement-family';
import type { CatalogKind } from './catalog-kinds';
import { catalogDocRef, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';

/** Όριο ασφαλείας για ερωτήματα χρήσης· ένα σχήμα με περισσότερες οικογένειες ανά ιδιότητα είναι απίθανο. */
const USAGE_QUERY_LIMIT = 500;

// ⚠️ Κάθε ερώτημα γράφεται με **ρητό** `COLLECTIONS.X` και όχι μέσω κοινού βοηθού που δέχεται τη συλλογή ως
//    μεταβλητή: η πύλη δεικτών του Admin SDK (CHECK 3.91) θεωρεί τη μεταβλητή συλλογή «μη αναλύσιμη» και την
//    προσπερνά σιωπηλά — πράσινο που θα σήμαινε «δεν κοίταξα».

/** Το μητρώο μονάδων του χώρου: πλατφόρμα + οι **ενεργές** οικογένειες μέτρησης του χώρου. */
export async function readMeasurementRegistry(scope: CatalogTx): Promise<MeasurementRegistry> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false),
  );
  return createMeasurementRegistryFromRecords(
    snap.docs.map((doc) => doc.data() as StoredCatalogRecord<WorkspaceMeasurementFamilyDefinition>),
  );
}

/**
 * Ενεργές εγγραφές **αυτού** του χώρου ανά id — οι ξένες/διαγραμμένες/ανύπαρκτες απλώς **λείπουν** από τον χάρτη
 * (ξένο ≡ ανύπαρκτο). **Ένα** `getAll` για όλα — ο ένας δρόμος «διάβασε αυτά τα ids» για κάθε είδος.
 */
export async function readActiveByIds<TDefinition>(
  scope: CatalogTx,
  kind: CatalogKind,
  ids: readonly string[],
): Promise<Map<string, StoredCatalogRecord<TDefinition>>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const snaps = await scope.tx.getAll(...unique.map((id) => catalogDocRef(scope.db, kind, id)));
  const result = new Map<string, StoredCatalogRecord<TDefinition>>();
  for (const snap of snaps) {
    const data = snap.data() as StoredCatalogRecord<TDefinition> | undefined;
    if (data && isPayloadOwnedByCompany(data, scope.ctx.companyId) && !data.isDeleted) result.set(snap.id, data);
  }
  return result;
}

/** Ενεργές ιδιότητες αυτού του χώρου ανά id — οι ξένες/διαγραμμένες/ανύπαρκτες απλώς λείπουν. */
export async function readAttributesByIds(
  scope: CatalogTx,
  ids: readonly string[],
): Promise<Map<string, CatalogAttributeDefinition>> {
  return readActiveByIds<CatalogAttributeDefinition>(scope, 'attribute', ids);
}

/** Οι ενεργές οικογένειες προϊόντων που χρησιμοποιούν μια ιδιότητα. */
export async function readFamiliesUsingAttribute(
  scope: CatalogTx,
  attributeId: string,
): Promise<StoredCatalogRecord<StoredCatalogFamilyDefinition>[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_FAMILIES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false)
      .where('attributeIds', 'array-contains', attributeId)
      .limit(USAGE_QUERY_LIMIT),
  );
  return snap.docs.map((doc) => doc.data() as StoredCatalogRecord<StoredCatalogFamilyDefinition>);
}

/** Οι δύο ερωτήσεις «σε χρήση;» πάνω στις ιδιότητες — κλειστό σύνολο, με δείκτη η καθεμία. */
type AttributeUsage =
  | { readonly field: 'groupId'; readonly op: '=='; readonly value: string }
  | { readonly field: 'measurementFamilyCodes'; readonly op: 'array-contains'; readonly value: string };

/** Υπάρχει **έστω μία** ενεργή ιδιότητα που ταιριάζει; (`limit(1)`: η ερώτηση είναι ναι/όχι.) */
async function hasActiveAttribute(scope: CatalogTx, usage: AttributeUsage): Promise<boolean> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_ATTRIBUTES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false)
      .where(usage.field, usage.op, usage.value)
      .limit(1),
  );
  return snap.size > 0;
}

/** Ανήκει έστω μία ενεργή ιδιότητα στην ομάδα; */
export function groupHasAttributes(scope: CatalogTx, groupId: string): Promise<boolean> {
  return hasActiveAttribute(scope, { field: 'groupId', op: '==', value: groupId });
}

/** Χρησιμοποιεί έστω μία ενεργή ιδιότητα την οικογένεια μέτρησης (η ίδια ή στήλη πίνακα); */
export function measurementFamilyInUse(scope: CatalogTx, familyCode: string): Promise<boolean> {
  return hasActiveAttribute(scope, { field: 'measurementFamilyCodes', op: 'array-contains', value: familyCode });
}

/** Οι ενεργοί απόγονοι μιας κατηγορίας (όλα τα επίπεδα), μέσω του `ancestorIds`. */
export async function readCategoryDescendants(
  scope: CatalogTx,
  categoryId: string,
): Promise<StoredCatalogRecord<CatalogCategoryDefinition>[]> {
  const snap = await scope.tx.get(
    scope.db
      .collection(COLLECTIONS.CATALOG_CATEGORIES)
      .where('companyId', '==', scope.ctx.companyId)
      .where('isDeleted', '==', false)
      .where('ancestorIds', 'array-contains', categoryId),
  );
  return snap.docs.map((doc) => doc.data() as StoredCatalogRecord<CatalogCategoryDefinition>);
}
