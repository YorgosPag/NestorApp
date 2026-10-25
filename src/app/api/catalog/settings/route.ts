/**
 * PUT /api/catalog/settings — οι ρυθμίσεις του καταλόγου του χώρου (γλώσσες ανά κανάλι, ADR-923 §5.10 Δ6).
 * Το **πρώτο** αποθηκευμένο έγγραφο ζητά `expectedRevision: 0`. Είναι **δομή** ⇒ `catalog:schema:manage`.
 * Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { saveCatalogSettings } from '@/server/catalog/catalog-settings-writer.server';
import { saveCatalogSettingsBodySchema } from '@/subapps/catalog/schema/zod/product-requests.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const PUT = catalogActionRoute({ category: 'STANDARD' }, saveCatalogSettingsBodySchema, (auth, body) =>
  saveCatalogSettings(auth, body.expectedRevision, body.definition),
);
