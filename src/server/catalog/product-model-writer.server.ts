import 'server-only';

/**
 * Ο **γραφέας μοντέλων** (ADR-923 §5.10 Δ2): μοντέλο-ρίζα (κοινές τιμές) ή υπο-μοντέλο (1ο επίπεδο σε σχήμα δύο
 * επιπέδων). Λεπτός πάνω στη μηχανή του συνόλου (`commitAggregate`): εδώ ζει μόνο το «ποια είναι η ρίζα;».
 *
 * - Κωδικός, οικογένεια, σχήμα παραλλαγών και γονέας **αμετάβλητα** (η αλλαγή σχήματος θα άλλαζε ποιος κατέχει
 *   κάθε τιμή — Akeneo: «family variant cannot be changed»).
 * - Η αλλαγή της ρίζας ξαναϋπολογίζει **στην ίδια συναλλαγή** την πληρότητα κάθε απογόνου (≤ 200).
 * - Διαγραφή = soft, **σε καταρράκτη** (Akeneo: η διαγραφή μοντέλου σβήνει τα παιδιά του), με απελευθέρωση κρατήσεων.
 * @module server/catalog/product-model-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import type { StoredCatalogProductModelDefinition } from '@/subapps/catalog/types/product-derived';
import { commitAggregate, committedRecord } from './catalog-aggregate.server';
import { readOwned, runCatalogTransaction, type CatalogTx, type StoredCatalogRecord } from './catalog-store.server';

type StoredModel = StoredCatalogRecord<StoredCatalogProductModelDefinition>;

/** Η ρίζα ενός υπάρχοντος μοντέλου: ο γονέας του, ή το ίδιο. */
async function rootOfModel(scope: CatalogTx, id: string): Promise<string> {
  const model = await readOwned<StoredCatalogProductModelDefinition>(scope, 'productModel', id);
  return model.parentId ?? model.id;
}

export async function createCatalogProductModel(ctx: AuthContext, definition: CatalogProductModelDefinition): Promise<StoredModel> {
  return runCatalogTransaction(ctx, async (scope) => {
    const committed = await commitAggregate(scope, definition.parentId, [{ op: 'create', kind: 'productModel', definition }]);
    return committedRecord<StoredCatalogProductModelDefinition>(committed, committed.createdIds[0]);
  });
}

export async function updateCatalogProductModel(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CatalogProductModelDefinition,
): Promise<StoredModel> {
  return runCatalogTransaction(ctx, async (scope) => {
    const rootId = await rootOfModel(scope, id);
    const committed = await commitAggregate(scope, rootId, [{ op: 'update', kind: 'productModel', id, expectedRevision, definition }]);
    return committedRecord<StoredCatalogProductModelDefinition>(committed, id);
  });
}

export async function deleteCatalogProductModel(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredModel> {
  return runCatalogTransaction(ctx, async (scope) => {
    const rootId = await rootOfModel(scope, id);
    const committed = await commitAggregate(scope, rootId, [{ op: 'delete', kind: 'productModel', id, expectedRevision }]);
    return committedRecord<StoredCatalogProductModelDefinition>(committed, id);
  });
}
