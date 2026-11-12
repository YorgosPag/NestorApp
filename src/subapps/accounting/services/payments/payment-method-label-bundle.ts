/**
 * @fileoverview Η ετικέτα τρόπου πληρωμής **έξω** από το i18next — email πωλήσεων / λογιστηρίου, server
 *   (ADR-ACC-030 §3).
 * @module subapps/accounting/services/payments/payment-method-label-bundle
 *
 * 🔑 Τα **ίδια** κλειδιά με την UI (`accounting:common.paymentMethods.*` — `PaymentMethodSelector`, Βιβλίο Ε-Ε),
 * μόνο ο μεταφραστής αλλάζει: `createBundleTranslate` στη γλώσσα του **παραλήπτη** (πρότυπο `uom-label-bundle` ·
 * `floor-label-bundle`).
 *
 * 🔴 Πριν: **δύο** χειρόγραφοι πίνακες (`base-email-template.ts` · `sales-accounting/notification-helpers.ts`) με
 * κλειδιά που **δεν υπάρχουν** στον `PaymentMethod` (`credit_card`, `debit_card`) και χωρίς `card` / `iris` /
 * `credit` / `mixed` ⇒ τα email έγραφαν ωμό «card» ή «iris».
 */

import elAccounting from '@/i18n/locales/el/accounting.json';
import enAccounting from '@/i18n/locales/en/accounting.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ accounting: elAccounting }, 'accounting', 'el'),
  en: createBundleTranslate({ accounting: enAccounting }, 'accounting', 'en'),
};

/**
 * Η ετικέτα του τρόπου πληρωμής στη γλώσσα του παραλήπτη. Άγνωστος τρόπος ⇒ ο ίδιος ο κωδικός (ορατή απουσία,
 * ποτέ το κλειδί i18n ή κενό).
 */
export function paymentMethodLabelIn(method: string, language: HumanLanguage): string {
  const key = `common.paymentMethods.${method}`;
  const label = TRANSLATORS[language](key);
  return label === key ? method : label;
}
