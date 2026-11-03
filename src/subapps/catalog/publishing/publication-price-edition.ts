/**
 * Η **έκδοση τιμών όπως τυπώνεται** (ADR-923 §5.6.1 αποφάσεις 4 · 76, §5.13 Σ7): ποια έκδοση, από πότε, και **έως πότε**
 * όταν την έχει ήδη κόψει επόμενη δημοσιευμένη. Το χαρτί ζει χρόνια: αντικατεστημένη έκδοση με μόνο «ισχύς από» θα
 * έλεγε σε όποιον το κρατά ότι οι τιμές ισχύουν ακόμη.
 *
 * 🔑 Το «έως» **παράγεται** από τη μία χρονογραμμή (`publishedTimeline`), όπως στην οθόνη των εκδόσεων: ημιανοιχτό
 *    διάστημα, άρα «έως 1/12» είναι η μέρα που αρχίζει η επόμενη (`lib/pricing/validity`).
 * 🔑 Το κλειδί ιδεμποτίας δεν χρειάζεται νέο συστατικό: η δημοσίευση της επόμενης γράφει την προηγούμενη ως `superseded`
 *    (`price-publication.server.ts`), άρα το `revision` της τυπωμένης έκδοσης αλλάζει μαζί με το «έως» της.
 * Καθαρό.
 * @module subapps/catalog/publishing/publication-price-edition
 */

import type { HumanLanguage } from '@/i18n/languages';
import { publishedTimeline, type PriceVersionRef } from '../pricing/version-timeline';
import { formatPublicationDate } from './layout-text';

export interface PublicationPriceEdition {
  readonly versionNumber: number;
  readonly validFrom: string;
  /** Η αρχή της επόμενης δημοσιευμένης έκδοσης· `null` = καμία ακόμη. */
  readonly validUntil: string | null;
}

/** Το κείμενο του υποσέλιδου, στη γλώσσα της έκδοσης. Οι ημερομηνίες έρχονται ήδη μορφοποιημένες. */
export interface PriceEditionWords {
  readonly open: (version: number, from: string) => string;
  readonly closed: (version: number, from: string, until: string) => string;
}

/** Η τυπωμένη έκδοση μέσα στις εκδόσεις της λίστας της. Έκδοση εκτός χρονογραμμής δεν έχει «έως». */
export function publicationPriceEdition(version: PriceVersionRef & { readonly validFrom: string }, versions: readonly PriceVersionRef[]): PublicationPriceEdition {
  const entry = publishedTimeline(versions).find((candidate) => candidate.version.id === version.id);
  const untilMs = entry?.window.untilMs ?? null;
  return { versionNumber: version.number, validFrom: version.validFrom, validUntil: untilMs === null ? null : new Date(untilMs).toISOString() };
}

/** «Τιμές έκδοσης 3, ισχύς από 1/10/2026», ή με «έως» όταν η έκδοση έχει αντικατασταθεί. */
export function priceEditionLine(edition: PublicationPriceEdition, language: HumanLanguage, words: PriceEditionWords): string {
  const from = formatPublicationDate(edition.validFrom, language);
  if (edition.validUntil === null) return words.open(edition.versionNumber, from);
  return words.closed(edition.versionNumber, from, formatPublicationDate(edition.validUntil, language));
}
