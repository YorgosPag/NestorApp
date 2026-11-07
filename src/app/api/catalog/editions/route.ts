/**
 * `/api/catalog/editions` — οι δημοσιευμένες εκδόσεις καταλόγου του χώρου (ADR-923 §5.15).
 *
 * - `GET` — η οθόνη του ιδιοκτήτη (με τις αποσυρμένες, χωρίς διαδρομή αποθήκευσης). Auth: `catalog:pricing:view` · Rate: standard.
 * - `POST { runId, audience }` — «Δημοσίευση σε…»: μια έτοιμη έκδοση του εκδότη, χωρίς τιμές (Θ4), γίνεται έντυπο που διαβάζει
 *   το κοινό. Ιδεμπότητο. Auth: `catalog:pricing:publish` (δημοσίευση ≠ συντήρηση, SAP) · Rate: sensitive.
 * 🔒 Ο ένας γραφέας (`catalog-edition-writer.server.ts`)· η συλλογή είναι `read/write: false`.
 * @module app/api/catalog/editions/route
 */

import 'server-only';

import { publishCatalogEdition } from '@/server/catalog/editions/catalog-edition-writer.server';
import { readOwnedCatalogEditions } from '@/server/catalog/editions/catalog-edition-reads.server';
import { publishCatalogEditionBodySchema } from '@/subapps/catalog/schema/zod/catalog-edition.schema';
import { catalogCreateRoute, catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, async (auth) => ({
  editions: await readOwnedCatalogEditions(auth),
}));

export const POST = catalogCreateRoute({ category: 'SENSITIVE', authority: 'pricingPublish' }, publishCatalogEditionBodySchema, async (auth, body) => ({
  editionId: (await publishCatalogEdition(auth, body)).id,
}));
