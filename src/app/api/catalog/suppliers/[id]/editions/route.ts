/**
 * `GET /api/catalog/suppliers/[id]/editions` — τα έντυπα ενός προμηθευτή που βλέπει **ο αγοραστής** (ADR-923 §5.15). `id` = η
 * σχέση του.
 * 🔒 Το κοινό το αποφασίζει ο διακομιστής από τη σύνδεση και τη σχέση, ποτέ από το αίτημα. Ξένη, ανύπαρκτη και ανενεργή σχέση
 *    δίνουν την **ίδια** απάντηση (κενή λίστα ή μόνο ό,τι βλέπει και ο ανώνυμος). `private, no-store` από την ασπίδα.
 * Auth: `catalog:pricing:view` · Rate: standard.
 * @module app/api/catalog/suppliers/[id]/editions/route
 */

import 'server-only';

import { readCatalogEditionsFor, supplierOfBuyerRelationship } from '@/server/catalog/editions/catalog-edition-reads.server';
import { catalogReadRoute } from '../../../_shared/catalog-route';

export const GET = catalogReadRoute<unknown, { id: string }>({ category: 'STANDARD', authority: 'pricingView' }, async (auth, params) => {
  const supplierCompanyId = await supplierOfBuyerRelationship(auth, params.id);
  return {
    editions: supplierCompanyId === null ? [] : await readCatalogEditionsFor(supplierCompanyId, { kind: 'buyer', buyerCompanyId: auth.companyId }),
  };
});
