/**
 * @fileoverview **Η γλώσσα του εγγράφου** — κάθε κείμενο, ποσό, ποσοστό, ημερομηνία και μονάδα του συμφωνητικού
 *   περνά από εδώ, στη γλώσσα **του εγγράφου**, όχι της οθόνης (ADR-928 §5.17 · §5.2.2).
 * @related i18n/bundle-translate.ts · lib/uom/uom-label-bundle.ts (ίδιο ιδίωμα) · lib/money/amount-in-words
 * @module subapps/procurement/subcontracts/document/document-locale
 *
 * 🔑 Ένα αγγλικό συμφωνητικό τυπώνεται αγγλικά ενώ η οθόνη είναι ελληνική, και ο server (Φ4, Typst) δεν έχει καν
 *    γλώσσα οθόνης. Γι' αυτό **ρητά** bundles, όχι το καθολικό i18next.
 * 🔑 Η προεπισκόπηση και το PDF καλούν την **ίδια** πόρτα ⇒ ίδιο κείμενο, ίδια μορφή αριθμού.
 */

import elDocument from '@/i18n/locales/el/subcontract-document.json';
import enDocument from '@/i18n/locales/en/subcontract-document.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import type { HumanLanguage } from '@/i18n/languages';
import { formatPercentageIn } from '@/lib/intl-formatting';
import { amountInWords } from '@/lib/money/amount-in-words/amount-in-words';
import { formatMinorIn, type MinorAmount } from '@/lib/money/money';
import { BP_PER_WHOLE, type BasisPoints } from '@/lib/pricing/discount-rule';
import { parseCalendarDay } from '@/lib/date/calendar-day';
import { uomLabelIn } from '@/lib/uom/uom-label-bundle';

const NAMESPACE = 'subcontract-document';

/** Οι γλώσσες για τις οποίες υπάρχουν κείμενα εγγράφου. Ρήτρες σε άλλη γλώσσα δεν αρκούν για ολόκληρο έγγραφο. */
export const DOCUMENT_LANGUAGES: readonly HumanLanguage[] = ['el', 'en'];

export function isDocumentLanguage(value: string): value is HumanLanguage {
  return (DOCUMENT_LANGUAGES as readonly string[]).includes(value);
}

/** Τα εργαλεία απόδοσης μιας γλώσσας. */
export interface DocumentLocale {
  readonly language: HumanLanguage;
  /** Κείμενο του namespace `subcontract-document`· λείπον κλειδί ⇒ το κλειδί φαίνεται (όχι σιωπηλό κενό). */
  readonly phrase: BundleTranslate;
  readonly money: (minor: MinorAmount) => string;
  readonly percent: (basisPoints: BasisPoints) => string;
  readonly number: (value: number) => string;
  readonly day: (calendarDay: string) => string;
  readonly words: (minor: MinorAmount) => string | null;
  readonly unit: (code: string) => string;
  /** «α, β και γ» — η σύνδεση λίστας της γλώσσας (CLDR), ποτέ κόμματα γραμμένα στο χέρι. */
  readonly list: (items: readonly string[]) => string;
}

const BUNDLES: Readonly<Record<HumanLanguage, unknown>> = { el: elDocument, en: enDocument };

function dayFormatter(language: HumanLanguage): (calendarDay: string) => string {
  const format = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (calendarDay) => {
    const day = parseCalendarDay(calendarDay);
    return day === null ? calendarDay : format.format(new Date(Date.UTC(day.year, day.month - 1, day.day)));
  };
}

function buildLocale(language: HumanLanguage): DocumentLocale {
  const numberFormat = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
  const listFormat = new Intl.ListFormat(language, { style: 'long', type: 'conjunction' });
  return {
    language,
    phrase: createBundleTranslate({ [NAMESPACE]: BUNDLES[language] }, NAMESPACE, language),
    money: (minor) => formatMinorIn(minor, language),
    percent: (basisPoints) => formatPercentageIn(language, (basisPoints / BP_PER_WHOLE) * 100, { maximumFractionDigits: 2 }),
    number: (value) => numberFormat.format(value),
    day: dayFormatter(language),
    words: (minor) => amountInWords(minor, language),
    unit: (code) => uomLabelIn(code, language),
    list: (items) => listFormat.format(items),
  };
}

const LOCALES: Readonly<Record<HumanLanguage, DocumentLocale>> = { el: buildLocale('el'), en: buildLocale('en') };

export function documentLocaleOf(language: HumanLanguage): DocumentLocale {
  return LOCALES[language];
}
