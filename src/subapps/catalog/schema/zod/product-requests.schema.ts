/**
 * Zod schemas των **αιτημάτων** δεδομένων καταλόγου (ADR-923 §5.10 · 2β) — δομή του σώματος, πάνω στους
 * **υπάρχοντες** ορισμούς (`product.schema.ts`). Η σημασιολογία ζει στη μηχανή του συνόλου.
 * @module subapps/catalog/schema/zod/product-requests.schema
 */

import { z } from 'zod';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { entityIdSchema, expectedRevisionSchema } from './common.schema';
import { catalogSettingsSchema, createProductBodySchema, productDefinitionSchema } from './product.schema';

/** Δημιουργία SKU με **προ-γεννημένο** id (αισιόδοξη οθόνη) — ο διακομιστής το ελέγχει, δεν το εμπιστεύεται. */
export const createProductRequestSchema = createProductBodySchema.extend({ id: entityIdSchema.optional() });

const variantCreateSchema = z.object({
  id: entityIdSchema.nullable().default(null),
  expectedRevision: z.null().default(null),
  definition: productDefinitionSchema,
});
const variantUpdateSchema = z.object({ id: entityIdSchema, expectedRevision: expectedRevisionSchema, definition: productDefinitionSchema });

/**
 * Η δέσμη παραλλαγών (επικόλληση TSV): `expectedRevision: null` = νέα παραλλαγή, αριθμός = CAS υπάρχουσας. Το
 * σύνολο φράζεται από το όριο απογόνων — η δέσμη δεν μπορεί να είναι μεγαλύτερη από ένα μοντέλο.
 */
export const variantBatchBodySchema = z.object({
  upserts: z.array(z.union([variantUpdateSchema, variantCreateSchema])).max(CATALOG_LIMITS.maxDescendantsPerModel),
  deletes: z
    .array(z.object({ id: entityIdSchema, expectedRevision: expectedRevisionSchema }))
    .max(CATALOG_LIMITS.maxDescendantsPerModel)
    .default([]),
});

/** Ρυθμίσεις: το **πρώτο** αποθηκευμένο έγγραφο ζητά `expectedRevision: 0` («διάβασα τις προεπιλογές»). */
export const saveCatalogSettingsBodySchema = z.object({
  expectedRevision: z.number().int().min(0),
  definition: catalogSettingsSchema,
});

/** Μία σελίδα της εργασίας επανυπολογισμού παραγώγων. */
export const recomputeCatalogDerivedBodySchema = z.object({
  familyId: entityIdSchema.nullable().default(null),
  cursor: z.string().max(200).nullable().default(null),
});
