/**
 * Zod των **σωμάτων αιτήματος** της τιμολόγησης (ADR-923 §5.11 «3β») — δομή του συνόρου· η σημασία (ασάφεια,
 * φράχτης, κατάσταση έκδοσης) κρίνεται στους γραφείς με τις ίδιες συναρτήσεις του πελάτη, ώστε να φτάνει ως εύρημα.
 * Τα συμβόλαια (τύποι) ζουν στο `types/price-list-requests.ts`.
 * @module subapps/catalog/schema/zod/price-list-requests.schema
 */

import { z } from 'zod';
import type {
  CreatePriceVersionRequest,
  PriceLineBatch,
  PriceHistoryRequest,
  PriceQuoteRequest,
  PublishPriceVersionRequest,
  UpdatePriceVersionRequest,
} from '../../types/price-list-requests';
import { PRICE_LINES_PER_TRANSACTION, PRICE_VERSION_BASES } from '../../vocabulary/pricing';
import { entityIdSchema, expectedRevisionSchema } from './common.schema';
import {
  customerAssignmentDefinitionSchema,
  customerGroupDefinitionSchema,
  discountConditionDefinitionSchema,
  discountGroupDefinitionSchema,
  isoInstantSchema,
  priceAudienceSchema,
  priceLineInputSchema,
  priceLineSubjectSchema,
  priceListDefinitionSchema,
} from './price-list.schema';

/** Το `linesRevision` ξεκινά από 0 (κενή έκδοση) — όχι από 1 όπως η αναθεώρηση εγγραφής. */
const linesRevisionSchema = z.number().int().min(0);

/** Το αποτύπωμα fnv1a64 (16 δεκαεξαδικά). */
const diffDigestSchema = z.string().regex(/^[0-9a-f]{16}$/);

const createBody = <T extends z.ZodTypeAny>(definition: T) => z.object({ definition });
const updateBody = <T extends z.ZodTypeAny>(definition: T) => z.object({ expectedRevision: expectedRevisionSchema, definition });

export const createPriceListBodySchema = createBody(priceListDefinitionSchema);
export const updatePriceListBodySchema = updateBody(priceListDefinitionSchema);
export const createDiscountGroupBodySchema = createBody(discountGroupDefinitionSchema);
export const updateDiscountGroupBodySchema = updateBody(discountGroupDefinitionSchema);
export const createCustomerGroupBodySchema = createBody(customerGroupDefinitionSchema);
export const updateCustomerGroupBodySchema = updateBody(customerGroupDefinitionSchema);
export const createCustomerAssignmentBodySchema = createBody(customerAssignmentDefinitionSchema);
export const updateCustomerAssignmentBodySchema = updateBody(customerAssignmentDefinitionSchema);
/**
 * Η συνθήκη δεν έχει κωδικό (τυχαίο id `cdcnd`) ⇒ ο πελάτης **μπορεί** να προ-γεννήσει το id της αισιόδοξης εγγραφής και ο
 * διακομιστής το **επαληθεύει** (ADR-866 επ. Β · ADR-923 §5.11 «3δ» Γ5) — το ίδιο ιδίωμα με τα SKU (`createProductRequestSchema`).
 */
export const createDiscountConditionBodySchema = createBody(discountConditionDefinitionSchema).extend({ id: entityIdSchema.optional() });
export const updateDiscountConditionBodySchema = updateBody(discountConditionDefinitionSchema);

export const createPriceVersionBodySchema: z.ZodType<CreatePriceVersionRequest, z.ZodTypeDef, unknown> = z.object({
  validFrom: isoInstantSchema.nullable(),
  basedOn: z.enum(PRICE_VERSION_BASES),
});

export const updatePriceVersionBodySchema: z.ZodType<UpdatePriceVersionRequest, z.ZodTypeDef, unknown> = z.object({
  expectedRevision: expectedRevisionSchema,
  validFrom: isoInstantSchema.nullable(),
});

export const priceLineBatchBodySchema: z.ZodType<PriceLineBatch, z.ZodTypeDef, unknown> = z.object({
  expectedLinesRevision: linesRevisionSchema,
  upserts: z.array(priceLineInputSchema).max(PRICE_LINES_PER_TRANSACTION),
  deletes: z.array(priceLineSubjectSchema).max(PRICE_LINES_PER_TRANSACTION),
});

export const publishPriceVersionBodySchema: z.ZodType<PublishPriceVersionRequest, z.ZodTypeDef, unknown> = z.object({
  expectedRevision: expectedRevisionSchema,
  expectedLinesRevision: linesRevisionSchema,
  confirmedDiffDigest: diffDigestSchema.nullable(),
});

/** Σώμα χωρίς πεδία (σπορά · προεπισκόπηση) — ρητά κενό αντικείμενο, ώστε άγνωστο πεδίο να μην περνά σιωπηλά. */
export const emptyBodySchema = z.object({}).strict();

export const priceQuoteBodySchema: z.ZodType<PriceQuoteRequest, z.ZodTypeDef, unknown> = z.object({
  viewAs: priceAudienceSchema,
  subject: priceLineSubjectSchema,
  quantity: z.number().positive().finite(),
  at: isoInstantSchema.nullable(),
  priceListId: entityIdSchema.nullable(),
});

export const priceHistoryBodySchema: z.ZodType<PriceHistoryRequest, z.ZodTypeDef, unknown> = z.object({
  priceListId: entityIdSchema,
  subject: priceLineSubjectSchema,
});
