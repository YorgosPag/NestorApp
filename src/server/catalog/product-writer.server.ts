import 'server-only';

/**
 * Ο **γραφέας SKU** (ADR-923 §5.10 Δ2–Δ3) — μεμονωμένα και σε **δέσμη** (Θωράκιση 5). Λεπτός πάνω στη μηχανή
 * του συνόλου: εδώ ζει μόνο το «ποια είναι η ρίζα;» και η μετάφραση της δέσμης σε αλλαγές.
 *
 * - Ταυτότητα **τυχαία** (ο πελάτης μπορεί να την προ-γεννήσει για αισιόδοξη οθόνη — ελέγχεται, ADR-866 επίπεδο Β).
 * - Μοντέλο και οικογένεια **αμετάβλητα** (μετακίνηση SKU σε άλλο μοντέλο = νέο SKU).
 * - Η **δέσμη** (`PUT …/product-models/[id]/variants`, επικόλληση TSV): **μία** συναλλαγή, CAS **ανά παραλλαγή**,
 *   κρίση **όλου** του συνόλου μία φορά — ή γράφονται όλες, ή καμία (Google Sheets paste = μία πράξη αναίρεσης).
 * @module server/catalog/product-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import type { CatalogProductDefinition } from '@/subapps/catalog/types/product';
import type { VariantBatch, VariantBatchResultOf } from '@/subapps/catalog/types/product-requests';
import type {
  StoredCatalogProductDefinition,
  StoredCatalogProductModelDefinition,
} from '@/subapps/catalog/types/product-derived';
import { commitAggregate, committedRecord, type HolderChange } from './catalog-aggregate.server';
import {
  readOwned,
  readOwnedOrNull,
  runCatalogTransaction,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';

type StoredProduct = StoredCatalogRecord<StoredCatalogProductDefinition>;
type StoredModel = StoredCatalogRecord<StoredCatalogProductModelDefinition>;

/** Η ρίζα του μοντέλου `modelId` — αν δεν υπάρχει, το ίδιο το id (η τοποθέτηση θα πει `unknownReference`). */
async function rootOfModelId(scope: CatalogTx, modelId: string | null): Promise<string | null> {
  if (modelId === null) return null;
  const model = await readOwnedOrNull<StoredCatalogProductModelDefinition>(scope, 'productModel', modelId);
  return model ? model.parentId ?? model.id : modelId;
}

async function rootOfProduct(scope: CatalogTx, id: string): Promise<string | null> {
  const product = await readOwned<StoredCatalogProductDefinition>(scope, 'product', id);
  return rootOfModelId(scope, product.modelId);
}

export async function createCatalogProduct(
  ctx: AuthContext,
  definition: CatalogProductDefinition,
  requestedId: string | null = null,
): Promise<StoredProduct> {
  return runCatalogTransaction(ctx, async (scope) => {
    const rootId = await rootOfModelId(scope, definition.modelId);
    const committed = await commitAggregate(scope, rootId, [{ op: 'create', kind: 'product', definition, requestedId }]);
    return committedRecord<StoredCatalogProductDefinition>(committed, committed.createdIds[0]);
  });
}

export async function updateCatalogProduct(
  ctx: AuthContext,
  id: string,
  expectedRevision: number,
  definition: CatalogProductDefinition,
): Promise<StoredProduct> {
  return runCatalogTransaction(ctx, async (scope) => {
    const rootId = await rootOfProduct(scope, id);
    const committed = await commitAggregate(scope, rootId, [{ op: 'update', kind: 'product', id, expectedRevision, definition }]);
    return committedRecord<StoredCatalogProductDefinition>(committed, id);
  });
}

export async function deleteCatalogProduct(ctx: AuthContext, id: string, expectedRevision: number): Promise<StoredProduct> {
  return runCatalogTransaction(ctx, async (scope) => {
    const rootId = await rootOfProduct(scope, id);
    const committed = await commitAggregate(scope, rootId, [{ op: 'delete', kind: 'product', id, expectedRevision }]);
    return committedRecord<StoredCatalogProductDefinition>(committed, id);
  });
}

// ── Η δέσμη παραλλαγών ──────────────────────────────────────────────────────

// Τα συμβόλαια της δέσμης ζουν στο κοινό `types/product-requests` (ένας ορισμός για οθόνη και διακομιστή).
export type { VariantBatch, VariantUpsert } from '@/subapps/catalog/types/product-requests';
export type VariantBatchResult = VariantBatchResultOf<StoredModel, StoredProduct>;

/** Κάθε παραλλαγή της δέσμης ανήκει **σε αυτό** το μοντέλο — αλλιώς είναι λάθος δέσμη, όχι μετακίνηση. */
function assertBatchBelongs(modelId: string, batch: VariantBatch): void {
  assertNoIssues(
    batch.upserts.flatMap((upsert, index) =>
      upsert.definition.modelId === modelId ? [] : [{ code: 'unknownReference' as const, path: `upserts[${index}].definition.modelId` }],
    ),
  );
}

function batchChanges(batch: VariantBatch): HolderChange[] {
  const upserts = batch.upserts.map((upsert): HolderChange =>
    upsert.expectedRevision === null
      ? { op: 'create', kind: 'product', definition: upsert.definition, requestedId: upsert.id }
      : { op: 'update', kind: 'product', id: upsert.id, expectedRevision: upsert.expectedRevision, definition: upsert.definition },
  );
  const deletes = batch.deletes.map((item): HolderChange => ({ op: 'delete', kind: 'product', ...item }));
  return [...upserts, ...deletes];
}

/** `PUT /api/catalog/product-models/[id]/variants` — μία συναλλαγή, CAS ανά παραλλαγή, κρίση όλου του συνόλου. */
export async function saveCatalogVariants(ctx: AuthContext, modelId: string, batch: VariantBatch): Promise<VariantBatchResult> {
  assertBatchBelongs(modelId, batch);
  return runCatalogTransaction(ctx, async (scope) => {
    const model = await readOwned<StoredCatalogProductModelDefinition>(scope, 'productModel', modelId);
    const rootId = model.parentId ?? model.id;
    const committed = await commitAggregate(scope, rootId, batchChanges(batch));
    let created = 0;
    const variants = batch.upserts.map((upsert) => {
      const id = upsert.expectedRevision === null ? committed.createdIds[created++] : upsert.id;
      return committedRecord<StoredCatalogProductDefinition>(committed, id);
    });
    return { model: committedRecord<StoredCatalogProductModelDefinition>(committed, rootId), variants };
  });
}
