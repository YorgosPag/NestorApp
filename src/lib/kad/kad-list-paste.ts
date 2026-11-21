/**
 * @fileoverview **«Επικόλληση λίστας ΓΕΜΗ»** — ελεύθερο κείμενο με κωδικούς → σχέδιο προσθήκης ΚΑΔ.
 * @related lib/kad/kad-resolve.ts · components/contacts/dynamic/KadBulkPaste.tsx
 * @module lib/kad/kad-list-paste
 *
 * Ο άνθρωπος αντιγράφει από τη σελίδα δημοσιότητας του ΓΕΜΗ ή από έγγραφο: 8ψήφιοι ή με τελείες,
 * με οποιονδήποτε διαχωριστή (αλλαγή γραμμής, κόμμα, κενό, `|`), ανάμεσα σε περιγραφές. Κάθε
 * ακολουθία ψηφίων/τελειών είναι υποψήφιος· ό,τι δεν επιλύεται **φαίνεται** ως ✗, δεν χάνεται σιωπηλά.
 */

import { isSelectableKad, resolveKad } from './kad-resolve';
import type { KadCatalog, KadCatalogEntry } from './kad-types';

/** Η τύχη ενός υποψηφίου της επικόλλησης. */
export type KadPasteStatus = 'add' | 'unresolved' | 'duplicate' | 'primary';

export interface KadPasteItem {
  /** Το κομμάτι όπως γράφτηκε. */
  readonly raw: string;
  readonly status: KadPasteStatus;
  /** Η γραμμή του καταλόγου — λείπει μόνο όταν `status === 'unresolved'`. */
  readonly entry?: KadCatalogEntry;
}

const CANDIDATE = /\d[\d.]*\d|\d/g;
/** Μικρότερα κομμάτια (π.χ. «1» από αρίθμηση γραμμών) δεν είναι ΚΑΔ — ούτε ✗, απλώς θόρυβος. */
const MIN_CANDIDATE_DIGITS = 4;

/** Κείμενο → υποψήφιοι κωδικοί, με τη σειρά που γράφτηκαν. */
export function extractKadTokens(text: string): string[] {
  const matches = text.match(CANDIDATE) ?? [];
  return matches.filter((token) => token.replace(/\./g, '').length >= MIN_CANDIDATE_DIGITS);
}

/**
 * Κείμενο → σχέδιο: κάθε υποψήφιος επιλύεται· όσοι υπάρχουν ήδη (ή επαναλαμβάνονται στην ίδια
 * επικόλληση) σημειώνονται `duplicate`, ο κύριος `primary`. Προστίθενται ΜΟΝΟ τα `add`.
 */
export function planKadListPaste(
  catalog: KadCatalog,
  text: string,
  existing: { readonly primaryCode: string; readonly secondaryCodes: readonly string[] },
): KadPasteItem[] {
  const seen = new Set(existing.secondaryCodes.map((code) => code.trim()));
  const primary = existing.primaryCode.trim();
  return extractKadTokens(text).map((raw): KadPasteItem => {
    const entry = resolveKad(catalog, raw);
    if (entry === null || !isSelectableKad(entry)) return { raw, status: 'unresolved' };
    if (entry.code === primary) return { raw, status: 'primary', entry };
    if (seen.has(entry.code)) return { raw, status: 'duplicate', entry };
    seen.add(entry.code);
    return { raw, status: 'add', entry };
  });
}
