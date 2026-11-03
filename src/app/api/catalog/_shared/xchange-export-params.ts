/**
 * Οι παράμετροι της εξαγωγής ETIM xChange (ADR-923 §5.14 · §5.14.1): **ένας** αναγνώστης για το αρχείο και τον προέλεγχο, ώστε
 * το ίδιο ερώτημα να σημαίνει το ίδιο κοινό και στα δύο.
 *
 * 🔑 Άκυρη παράμετρος ⇒ 400, ποτέ σιωπηλά «δημόσια» ή «ελληνικά».
 */

import 'server-only';

import { badRequest } from '@/lib/api/define-route';
import { DEFAULT_LANGUAGE, isHumanLanguage } from '@/i18n/languages';
import { XCHANGE_LANGUAGE_PARAM, XCHANGE_PRICE_LIST_PARAM } from '@/subapps/catalog/catalog-routes';
import { isEnterpriseIdOfPrefix } from '@/services/enterprise-id-parse';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import type { XChangeExportAudience } from '@/subapps/catalog/types/xchange-export';

/**
 * Χωρίς `priceListId` ⇒ η δημόσια τιμή καταλόγου· με `priceListId` ⇒ το κοινό **εκείνης** της λίστας (απόφαση Ε1).
 *
 * 🔑 Η μορφή κρίνεται από το **μητρώο ταυτοτήτων** (πρόθεμα `cprl` + uuid v4), όχι από «1–128 χαρακτήρες»: κάτι που δεν
 * μπορεί καν να είναι τιμοκατάλογος είναι **λάθος αίτημα** (400), όχι «δεν βρέθηκε» (404) — ADR-923 §5.14.1 Ζ24.
 * Έγκυρη μορφή χωρίς έγγραφο μένει 404, από τον αναγνώστη.
 */
export function xchangeAudienceOf(search: URLSearchParams): XChangeExportAudience {
  const raw = search.get(XCHANGE_PRICE_LIST_PARAM);
  if (raw === null) return { kind: 'public' };
  if (!isEnterpriseIdOfPrefix(raw, ENTERPRISE_ID_PREFIXES.CATALOG_PRICE_LIST)) badRequest(`${XCHANGE_PRICE_LIST_PARAM} is invalid`);
  return { kind: 'priceList', priceListId: raw };
}

export function xchangeLanguageOf(search: URLSearchParams) {
  const raw = search.get(XCHANGE_LANGUAGE_PARAM);
  if (raw === null) return DEFAULT_LANGUAGE;
  if (!isHumanLanguage(raw)) badRequest(`${XCHANGE_LANGUAGE_PARAM} is invalid`);
  return raw;
}
