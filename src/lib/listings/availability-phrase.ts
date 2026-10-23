/**
 * @fileoverview **Η ΦΡΑΣΗ ΤΗΣ ΥΠΟΣΧΕΣΗΣ** — «Γ΄ τρίμηνο 2027» · «Σεπτέμβριος 2027» · «15 Σεπτεμβρίου 2027».
 * @related ADR-919 §3 (Δ2) · §11 · services/demand/listing-announcement-copy.ts · lib/intl-formatting.ts
 * @module lib/listings/availability-phrase
 *
 * 🔑 **ΕΝΑΣ μορφοποιητής για email, κουδούνι, κάρτα, σελίδα, showcase και απάντηση ζήτησης.** Πριν από αυτό το
 * αρχείο η φράση ζούσε μόνο στον διακομιστή (`promisePhrase`) με καρφωμένο `'el'`. Μια δεύτερη εκδοχή στην οθόνη θα
 * απέκλινε στην πρώτη διόρθωση (π.χ. «Γ΄ τρ.» vs «Γ΄ τρίμηνο»), και ο ζητών θα διάβαζε στο email άλλη υπόσχεση από
 * αυτή της σελίδας.
 *
 * 🔑 **Με την ακρίβεια που δηλώθηκε, ποτέ ψεύτικη ακρίβεια ημέρας** (Δ2): το διάστημα αποθηκεύεται, η φράση
 * ξαναγράφει την ακρίβεια από το `precision`, όχι από το μήκος του διαστήματος.
 *
 * ⚠️ **Καθαρό, με `t` και `locale` ως ορίσματα.** Ο διακομιστής περνά τον μεταφραστή του bundle της γλώσσας του
 * παραλήπτη (`createBundleTranslate`)· η οθόνη το `t` του i18next. ⚠️ Τα τακτικά τριμήνου είναι **ρητά κλειδιά, όχι
 * ICU `select`**: ο αποδότης του διακομιστή δεν τον υποστηρίζει (το έπιασε η άγκυρα Π1 του βήματος 6).
 */

import { formatCalendarDate, formatCalendarMonth } from '@/lib/intl-formatting';
import type { ScheduledAvailability } from '@/types/availability-history';

/** Η υπογραφή που ικανοποιούν και το i18next `t` και το `BundleTranslate`. */
export type AvailabilityPhraseT = (key: string, params?: Readonly<Record<string, unknown>>) => string;

/**
 * Στατικά, ώστε να τα βλέπουν οι πύλες i18n (3.8 · 3.34). Τα διαβάζει και ο επιλογέας τριμήνου της φόρμας.
 * ⚠️ **Αντικείμενο, όχι πίνακας**: ο γεννήτορας του shell slice (CHECK 3.34) διπλώνει μόνο object literals με
 * κλειδιά-συμβολοσειρές· ο υπολογισμένος δείκτης σε αυτό λύνεται στατικά (ταξιδεύουν και τα τέσσερα).
 */
export const QUARTER_ORDINAL_KEYS = {
  '1': 'common-shared:listingAvailability.quarterOrdinals.1',
  '2': 'common-shared:listingAvailability.quarterOrdinals.2',
  '3': 'common-shared:listingAvailability.quarterOrdinals.3',
  '4': 'common-shared:listingAvailability.quarterOrdinals.4',
} as const;

export type QuarterOrdinal = keyof typeof QUARTER_ORDINAL_KEYS;

/** Τα τρίμηνα με τη σειρά τους — ο δείκτης `0..3` είναι `floor((μήνας - 1) / 3)`. */
export const QUARTER_ORDINALS: readonly QuarterOrdinal[] = ['1', '2', '3', '4'];

/** Η υπόσχεση ως φράση στη γλώσσα `locale`. Η αρχή του διαστήματος ορίζει τρίμηνο/μήνα/ημέρα. */
export function availabilityPromisePhrase(
  promise: Pick<ScheduledAvailability, 'precision' | 'window'>,
  t: AvailabilityPhraseT,
  locale: string,
): string {
  const start = promise.window.start;
  if (promise.precision === 'day') return formatCalendarDate(start, locale);
  if (promise.precision === 'month') return formatCalendarMonth(start.slice(0, 7), locale);
  const month = Number(start.slice(5, 7));
  const ordinal = t(QUARTER_ORDINAL_KEYS[QUARTER_ORDINALS[Math.floor((month - 1) / 3)]]);
  return t('common-shared:listingAvailability.quarter', { ordinal, year: start.slice(0, 4) });
}
