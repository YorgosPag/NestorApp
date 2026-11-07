/**
 * `GET /api/catalog/suppliers/[id]/editions/[editionId]/file` — η βραχύβια άδεια ανάγνωσης ενός εντύπου για **τον αγοραστή**
 * (ADR-923 §5.15 Η4). `id` = η σχέση του.
 * 🔒 Κρίση πρώτα, υπογραφή μετά· `inline`, 15′, ποτέ `attachment`. Κρυφό, ξένο, αποσυρμένο, ανύπαρκτο ⇒ **ίδιο** 404. Η προβολή
 *    δεν μετρά λήψη. Ο προβολέας τη ζητά με `urlDelivery: 'direct'`.
 * Auth: `catalog:pricing:view` · Rate: standard.
 * @module app/api/catalog/suppliers/[id]/editions/[editionId]/file/route
 */

import 'server-only';

import { notFound } from '@/lib/api/define-route';
import { signCatalogEditionFile, supplierOfBuyerRelationship } from '@/server/catalog/editions/catalog-edition-reads.server';
import { catalogReadRoute } from '../../../../../_shared/catalog-route';

export const GET = catalogReadRoute<unknown, { id: string; editionId: string }>({ category: 'STANDARD', authority: 'pricingView' }, async (auth, params) => {
  const supplierCompanyId = await supplierOfBuyerRelationship(auth, params.id);
  const signed = supplierCompanyId === null
    ? null
    : await signCatalogEditionFile(supplierCompanyId, { kind: 'buyer', buyerCompanyId: auth.companyId }, params.editionId);
  return signed ?? notFound('Catalog edition not found');
});
