/**
 * @fileoverview **Το όνομα της χώρας, ΕΚΤΟΣ React** — από τα ίδια locale με την οθόνη (ADR-ACC-018 §14).
 * @module utils/address/country-label-text
 *
 * 🔑 Ίδιο κλειδί με την UI (`countryLabelKey` → `common:countries.*`), ίδιος κανόνας για άγνωστη χώρα (η ίδια η
 * τιμή, ποτέ κενό) — μόνο ο μεταφραστής αλλάζει: `createBundleTranslate` **στη γλώσσα του εγγράφου**. Το PDF του
 * τιμολογίου φτιάχνεται και στον διακομιστή (αποστολή email), όπου δεν υπάρχει i18next.
 *
 * ⚠️ Ξεχωριστό αρχείο, **όχι** μέσα στο `country-codes.ts`: εκείνο το εισάγει μισή εφαρμογή, και ένα
 * `import … common.json` εκεί θα έβαζε δύο locale σε κάθε καταναλωτή (ίδιο ιδίωμα με `constants/global-role-text.ts`).
 */

import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import { countryLabelKey } from './country-codes';

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ common: elCommon }, 'common', 'el'),
  en: createBundleTranslate({ common: enCommon }, 'common', 'en'),
};

/** Η χώρα στη γλώσσα του εγγράφου· άγνωστη χώρα ⇒ η αποθηκευμένη τιμή αυτούσια· κενή ⇒ `''`. */
export function countryLabelIn(country: string | null | undefined, language: HumanLanguage): string {
  const key = countryLabelKey(country);
  return key ? TRANSLATORS[language](key) : (country?.trim() ?? '');
}
