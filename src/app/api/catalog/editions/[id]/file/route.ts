/**
 * `GET /api/catalog/editions/[id]/file` — η βραχύβια άδεια ανάγνωσης ενός εντύπου για **τον ιδιοκτήτη του** (ADR-923 §5.15.3):
 * βλέπει στον προβολέα ακριβώς ό,τι θα δει το κοινό του, πριν και αφού το μοιραστεί.
 * 🔒 Κρίση πρώτα, υπογραφή μετά· `inline`, 15′, ποτέ `attachment` (Η4). Ξένο, αποσυρμένο, ανύπαρκτο ⇒ **ίδιο** 404. Η προβολή
 *    δεν μετρά λήψη.
 * Auth: `catalog:pricing:view` · Rate: standard.
 * @module app/api/catalog/editions/[id]/file/route
 */

import 'server-only';

import { notFound } from '@/lib/api/define-route';
import { signOwnedCatalogEditionFile } from '@/server/catalog/editions/catalog-edition-reads.server';
import { catalogReadRoute } from '../../../_shared/catalog-route';

export const GET = catalogReadRoute<unknown, { id: string }>({ category: 'STANDARD', authority: 'pricingView' }, async (auth, params) => {
  const signed = await signOwnedCatalogEditionFile(auth, params.id);
  return signed ?? notFound('Catalog edition not found');
});
