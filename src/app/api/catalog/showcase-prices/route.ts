/**
 * GET /api/catalog/showcase-prices?supplier=<χώρος>&model=<ρίζα> — **η τιμή του δικού μου κοινού** στη δημόσια βιτρίνα
 * (ADR-923 §5.13 Σ6 · Δ2, νησίδα αγοραστή).
 *
 * 🔒 `private, no-store` (`catalogReadRoute` → `withPrivateNoStore`): η απάντηση εξαρτάται από τον χώρο του καλούντα.
 * 🔒 Το κοινό το αποφασίζει ο διακομιστής από τη σύνδεση (`ctx.companyId` + σχέση), ποτέ από το αίτημα. Το αίτημα ονομάζει μόνο
 *    **ποιο δημόσιο μοντέλο**. Κλειστός διακόπτης, εαυτός, ανύπαρκτο, κρυφό και ξένο δίνουν την **ίδια** κενή απάντηση.
 * Auth: `catalog:pricing:view` · Rate: standard.
 *
 * @module app/api/catalog/showcase-prices/route
 */

import 'server-only';

import { badRequest } from '@/lib/api/define-route';
import { readBuyerShowcasePrices } from '@/services/public-catalog/public-catalog-prices';
import { SHOWCASE_MODEL_PARAM, SHOWCASE_SUPPLIER_PARAM } from '@/subapps/catalog/catalog-routes';
import { entityIdSchema } from '@/subapps/catalog/schema/zod/common.schema';
import { catalogReadRoute } from '../_shared/catalog-route';

function idParam(search: URLSearchParams, name: string): string {
  const parsed = entityIdSchema.safeParse(search.get(name));
  if (!parsed.success) badRequest(`${name} is invalid`);
  return parsed.data;
}

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, async (auth, _params, search) => ({
  prices: await readBuyerShowcasePrices(auth, { supplierCompanyId: idParam(search, SHOWCASE_SUPPLIER_PARAM), modelId: idParam(search, SHOWCASE_MODEL_PARAM) }),
}));
