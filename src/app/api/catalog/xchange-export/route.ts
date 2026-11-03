/**
 * GET /api/catalog/xchange-export?language=el[&priceListId=…] — ο κατάλογος του χώρου ως έγγραφο ETIM xChange 2.0, με την αναφορά
 * εξαγωγής δίπλα του (ADR-923 §5.14 · κενό α · Ζ5).
 *
 * 🔒 Κριτής `catalog:pricing:view`: το αρχείο κουβαλά τιμές. Μόνο ο ίδιος ο χώρος· ξένη λίστα ≡ ανύπαρκτη. Rate: standard.
 * 🔑 Χωρίς `priceListId` ⇒ η δημόσια τιμή καταλόγου (ανώνυμος θεατής)· με `priceListId` ⇒ το κοινό **εκείνης** της λίστας
 *    (απόφαση Ε1). Ανάγνωση χωρίς εγγραφή, άρα GET, με τον ίδιο φάκελο απάντησης με τις άλλες όψεις τιμών.
 * 🔒 Κανένα προϊόν για το κοινό ⇒ 422 `xchangeNothingToExport` με την αιτία (§5.14.1 · Ε3): το σχήμα δεν δέχεται κενό αρχείο.
 *    Ο προέλεγχος (`./preview`) το λέει πριν το κλικ.
 */

import 'server-only';

import { exportXChangeCatalog } from '@/server/catalog/xchange-export.server';
import { catalogReadRoute } from '../_shared/catalog-route';
import { xchangeAudienceOf, xchangeLanguageOf } from '../_shared/xchange-export-params';

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, (auth, _params, search) =>
  exportXChangeCatalog(auth, { audience: xchangeAudienceOf(search), language: xchangeLanguageOf(search) }),
);
