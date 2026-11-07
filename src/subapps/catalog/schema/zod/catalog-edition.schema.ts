/**
 * @fileoverview Σχήματα των αιτήσεων δημοσιευμένων εκδόσεων καταλόγου (ADR-923 §5.15).
 * 🔑 Το κοινό είναι το **ένα** `priceAudienceSchema`, στενεμένο με τον φρουρό της πολιτικής: κανένα δεύτερο σχήμα κοινού.
 * @module subapps/catalog/schema/zod/catalog-edition.schema
 */

import { z } from 'zod';

import { isCatalogEditionAudience } from '../../publishing/catalog-edition-policy';
import { entityIdSchema } from './common.schema';
import { priceAudienceSchema } from './price-list.schema';

export const catalogEditionAudienceSchema = priceAudienceSchema.refine(isCatalogEditionAudience, {
  message: 'catalog-edition-audience',
});

/** «Δημοσίευση σε…»: ποια έκδοση του εκδότη, σε ποιο κοινό. Τίτλος, γλώσσα και αρχείο έρχονται από τον διακομιστή, ποτέ από το αίτημα. */
export const publishCatalogEditionBodySchema = z.object({
  runId: entityIdSchema,
  audience: catalogEditionAudienceSchema,
});
export type PublishCatalogEditionBody = z.infer<typeof publishCatalogEditionBodySchema>;

/** «Απόσυρση»: σώμα χωρίς πεδία· η ταυτότητα είναι στη διαδρομή. */
export const withdrawCatalogEditionBodySchema = z.object({}).strict();
