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
import { entityIdSchema } from '@/subapps/catalog/schema/zod/common.schema';
import type { XChangeExportAudience } from '@/subapps/catalog/types/xchange-export';

/** Χωρίς `priceListId` ⇒ η δημόσια τιμή καταλόγου· με `priceListId` ⇒ το κοινό **εκείνης** της λίστας (απόφαση Ε1). */
export function xchangeAudienceOf(search: URLSearchParams): XChangeExportAudience {
  const raw = search.get(XCHANGE_PRICE_LIST_PARAM);
  if (raw === null) return { kind: 'public' };
  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) badRequest(`${XCHANGE_PRICE_LIST_PARAM} is invalid`);
  return { kind: 'priceList', priceListId: parsed.data };
}

export function xchangeLanguageOf(search: URLSearchParams) {
  const raw = search.get(XCHANGE_LANGUAGE_PARAM);
  if (raw === null) return DEFAULT_LANGUAGE;
  if (!isHumanLanguage(raw)) badRequest(`${XCHANGE_LANGUAGE_PARAM} is invalid`);
  return raw;
}
