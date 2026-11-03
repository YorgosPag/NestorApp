/**
 * **Η τιμή μιας δημόσιας ιδιότητας ως κείμενο** (ADR-923 §5.13 Σ4): καθαρή, κοινή για οθόνη και δοκιμές.
 *
 * Το `richText` μένει έξω: δεν είναι απλό κείμενο, το αποδίδει η οθόνη αφού περάσει τη γραμματική.
 *
 * @module subapps/catalog/public/public-value-text
 */

import { resolveLocalizedText } from '@/i18n/localized-text';
import type { HumanLanguage } from '@/i18n/languages';
import type { PublicCatalogValue } from './public-catalog-schema';

export type PublicValueText = (value: Exclude<PublicCatalogValue, { type: 'richText' | 'boolean' }>, language: HumanLanguage) => string;

export const publicValueText: PublicValueText = (value, language) => {
  switch (value.type) {
    case 'text':
      return value.text;
    case 'number':
      return value.value;
    case 'measurement':
      return `${value.value} ${value.unitCode}`;
    case 'date':
      return value.date;
    case 'option':
      return resolveLocalizedText(value.option.labels, language);
    case 'options':
      return value.options.map((option) => resolveLocalizedText(option.labels, language)).join(', ');
  }
};

/** Η τιμή στη ζητούμενη γλώσσα, αλλιώς στην πρώτη που υπάρχει. Κάθε ιδιότητα του εγγράφου έχει τουλάχιστον μία. */
export function publicValueIn(values: Readonly<Partial<Record<HumanLanguage, PublicCatalogValue>>>, language: HumanLanguage): PublicCatalogValue | null {
  return values[language] ?? Object.values(values)[0] ?? null;
}
