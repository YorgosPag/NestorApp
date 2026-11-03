/**
 * GET /api/catalog/xchange-export?language=el[&priceListId=…] — ο κατάλογος του χώρου ως έγγραφο ETIM xChange 2.0, με την αναφορά
 * εξαγωγής δίπλα του (ADR-923 §5.14 · κενό α · Ζ5).
 *
 * 🔒 Κριτής `catalog:pricing:view`: το αρχείο κουβαλά τιμές. Μόνο ο ίδιος ο χώρος· ξένη λίστα ≡ ανύπαρκτη. Rate: standard.
 * 🔑 Χωρίς `priceListId` ⇒ η δημόσια τιμή καταλόγου (ανώνυμος θεατής)· με `priceListId` ⇒ το κοινό **εκείνης** της λίστας
 *    (απόφαση Ε1). Ανάγνωση χωρίς εγγραφή, άρα GET, με τον ίδιο φάκελο απάντησης με τις άλλες όψεις τιμών.
 */

import 'server-only';

import { badRequest } from '@/lib/api/define-route';
import { DEFAULT_LANGUAGE, isHumanLanguage } from '@/i18n/languages';
import { exportXChangeCatalog } from '@/server/catalog/xchange-export.server';
import { XCHANGE_LANGUAGE_PARAM, XCHANGE_PRICE_LIST_PARAM } from '@/subapps/catalog/catalog-routes';
import { entityIdSchema } from '@/subapps/catalog/schema/zod/common.schema';
import type { XChangeExportAudience } from '@/subapps/catalog/types/xchange-export';
import { catalogReadRoute } from '../_shared/catalog-route';

/** Άκυρη παράμετρος ⇒ 400, ποτέ σιωπηλά «δημόσια» ή «ελληνικά». */
function audienceOf(search: URLSearchParams): XChangeExportAudience {
  const raw = search.get(XCHANGE_PRICE_LIST_PARAM);
  if (raw === null) return { kind: 'public' };
  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) badRequest(`${XCHANGE_PRICE_LIST_PARAM} is invalid`);
  return { kind: 'priceList', priceListId: parsed.data };
}

function languageOf(search: URLSearchParams) {
  const raw = search.get(XCHANGE_LANGUAGE_PARAM);
  if (raw === null) return DEFAULT_LANGUAGE;
  if (!isHumanLanguage(raw)) badRequest(`${XCHANGE_LANGUAGE_PARAM} is invalid`);
  return raw;
}

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, (auth, _params, search) =>
  exportXChangeCatalog(auth, { audience: audienceOf(search), language: languageOf(search) }),
);
