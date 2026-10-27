/**
 * POST /api/catalog/price-quote — «δες την τιμή σαν τον Χ»: ο διακομιστής χτίζει τον θεατή από αποθηκευμένες εγγραφές,
 * επιλέγει λίστα κατά κοινό και επιλύει (ADR-923 §5.11 «3β» αποφάσεις Α + Δ). Μόνο εσωτερικά στη 3β (§12 🔒).
 * Auth: `catalog:pricing:manage` · Rate: standard.
 */

import 'server-only';

import { quoteCatalogPrice } from '@/server/catalog/price-quote.server';
import { priceQuoteBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'pricing' }, priceQuoteBodySchema, (auth, body) =>
  quoteCatalogPrice(auth, body),
);
